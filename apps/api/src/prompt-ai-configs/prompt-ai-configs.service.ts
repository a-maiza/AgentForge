import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PromptAiConfig } from '@prisma/client';
import type { UpsertPromptAiConfigDto } from './dto/upsert-prompt-ai-config.dto';

@Injectable()
export class PromptAiConfigsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPrompt(promptId: string, workspaceId: string): Promise<PromptAiConfig[]> {
    const prompt = await this.prisma.prompt.findFirst({ where: { id: promptId, workspaceId } });
    if (!prompt) throw new NotFoundException('Prompt not found');
    return this.prisma.promptAiConfig.findMany({
      where: { promptId },
      include: {
        provider: { select: { id: true, name: true, providerType: true, isActive: true } },
      },
    });
  }

  async upsert(
    promptId: string,
    workspaceId: string,
    dto: UpsertPromptAiConfigDto,
  ): Promise<PromptAiConfig> {
    const prompt = await this.prisma.prompt.findFirst({ where: { id: promptId, workspaceId } });
    if (!prompt) throw new NotFoundException('Prompt not found');

    const existing = await this.prisma.promptAiConfig.findFirst({
      where: { promptId, ...(dto.providerId ? { providerId: dto.providerId } : {}) },
    });

    const data = {
      ...(dto.modelName !== undefined && { modelName: dto.modelName }),
      ...(dto.temperature !== undefined && { temperature: dto.temperature }),
      ...(dto.topP !== undefined && { topP: dto.topP }),
      ...(dto.topK !== undefined && { topK: dto.topK }),
      ...(dto.maxTokens !== undefined && { maxTokens: dto.maxTokens }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    if (existing) {
      return this.prisma.promptAiConfig.update({
        where: { id: existing.id },
        data: {
          ...data,
          ...(dto.providerId ? { providerId: dto.providerId } : {}),
        },
      });
    }

    return this.prisma.promptAiConfig.create({
      data: {
        promptId,
        providerId: dto.providerId ?? '',
        modelName: dto.modelName ?? '',
        ...data,
      },
    });
  }

  async delete(promptId: string, configId: string, workspaceId: string): Promise<void> {
    const prompt = await this.prisma.prompt.findFirst({ where: { id: promptId, workspaceId } });
    if (!prompt) throw new NotFoundException('Prompt not found');
    const config = await this.prisma.promptAiConfig.findFirst({
      where: { id: configId, promptId },
    });
    if (!config) throw new NotFoundException('Config not found');
    await this.prisma.promptAiConfig.delete({ where: { id: configId } });
  }
}
