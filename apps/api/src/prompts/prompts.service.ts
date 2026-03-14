import { Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { VARIABLE_PATTERN } from '@agentforge/shared';
import type { UpdatePromptInput } from '@agentforge/shared';
import type { Prompt, PromptVersion, PromptVariable } from '@prisma/client';

interface CreatePromptData {
  name: string;
  description?: string;
  content: string;
}

@Injectable()
export class PromptsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(workspaceId: string): Promise<Prompt[]> {
    return this.prisma.prompt.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(
    id: string,
    workspaceId: string,
  ): Promise<Prompt & { versions: PromptVersion[]; variables: PromptVariable[] }> {
    const prompt = await this.prisma.prompt.findFirst({
      where: { id, workspaceId },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
        variables: true,
      },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');
    return prompt;
  }

  async create(workspaceId: string, data: CreatePromptData, userId: string): Promise<Prompt> {
    const variables = this.extractVariables(data.content);

    return this.prisma.$transaction(async (tx) => {
      const prompt = await tx.prompt.create({
        data: {
          workspaceId,
          name: data.name,
          status: 'draft',
          createdBy: userId,
          ...(data.description !== undefined && { description: data.description }),
        },
      });

      await tx.promptVersion.create({
        data: {
          promptId: prompt.id,
          versionNumber: 1,
          content: data.content,
          characterCount: data.content.length,
          createdBy: userId,
        },
      });

      if (variables.length > 0) {
        await tx.promptVariable.createMany({
          data: variables.map((name) => ({
            promptId: prompt.id,
            name,
            type: 'string' as const,
          })),
          skipDuplicates: true,
        });
      }

      return prompt;
    });
  }

  async update(
    id: string,
    workspaceId: string,
    data: UpdatePromptInput,
    userId: string,
  ): Promise<Prompt> {
    const existing = await this.prisma.prompt.findFirst({
      where: { id, workspaceId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!existing) throw new NotFoundException('Prompt not found');

    return this.prisma.$transaction(async (tx) => {
      const latestContent = existing.versions[0]?.content ?? '';
      const contentChanged = data.content !== undefined && data.content !== latestContent;

      if (contentChanged && data.content) {
        const nextVersion = (existing.versions[0]?.versionNumber ?? 0) + 1;

        await tx.promptVersion.create({
          data: {
            promptId: id,
            versionNumber: nextVersion,
            content: data.content,
            characterCount: data.content.length,
            createdBy: userId,
          },
        });

        const variables = this.extractVariables(data.content);

        await tx.promptVariable.deleteMany({
          where: { promptId: id, name: { notIn: variables } },
        });

        for (const name of variables) {
          await tx.promptVariable.upsert({
            where: { promptId_name: { promptId: id, name } },
            create: { promptId: id, name, type: 'string' },
            update: {},
          });
        }
      }

      return tx.prompt.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
        },
      });
    });
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    const prompt = await this.prisma.prompt.findFirst({ where: { id, workspaceId } });
    if (!prompt) throw new NotFoundException('Prompt not found');
    await this.prisma.prompt.delete({ where: { id } });
  }

  async getVersions(promptId: string, workspaceId: string): Promise<PromptVersion[]> {
    const prompt = await this.prisma.prompt.findFirst({
      where: { id: promptId, workspaceId },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');
    return this.prisma.promptVersion.findMany({
      where: { promptId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async getVersion(
    promptId: string,
    versionNumber: number,
    workspaceId: string,
  ): Promise<PromptVersion> {
    const prompt = await this.prisma.prompt.findFirst({
      where: { id: promptId, workspaceId },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');

    const version = await this.prisma.promptVersion.findUnique({
      where: { promptId_versionNumber: { promptId, versionNumber } },
    });
    if (!version) throw new NotFoundException('Version not found');
    return version;
  }

  extractVariables(content: string): string[] {
    const pattern = new RegExp(VARIABLE_PATTERN.source, VARIABLE_PATTERN.flags);
    const names = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) names.add(match[1]);
    }
    return [...names];
  }
}
