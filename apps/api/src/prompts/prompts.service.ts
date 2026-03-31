import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
    await this.prisma.$transaction(async (tx) => {
      // evaluation_jobs.prompt_version_id and deployments.prompt_version_id have no
      // onDelete: Cascade — must be cleaned up before prompt_versions are deleted
      const versions = await tx.promptVersion.findMany({
        where: { promptId: id },
        select: { id: true },
      });
      const versionIds = versions.map((v) => v.id);
      if (versionIds.length > 0) {
        await tx.evaluationJob.deleteMany({ where: { promptVersionId: { in: versionIds } } });
        await tx.deployment.deleteMany({ where: { promptVersionId: { in: versionIds } } });
      }
      await tx.prompt.delete({ where: { id } });
    });
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

  async getDatasetConfig(promptId: string, workspaceId: string): Promise<unknown> {
    const prompt = await this.prisma.prompt.findFirst({ where: { id: promptId, workspaceId } });
    if (!prompt) throw new NotFoundException('Prompt not found');
    return this.prisma.promptDatasetConfig.findFirst({
      where: { promptId },
      include: {
        dataset: { select: { id: true, name: true } },
        datasetVersion: { select: { id: true, versionNumber: true } },
      },
    });
  }

  async saveDatasetConfig(
    promptId: string,
    workspaceId: string,
    data: {
      datasetId: string;
      datasetVersionId?: string;
      variableMapping: Record<string, string>;
      isActive?: boolean;
    },
  ): Promise<unknown> {
    const prompt = await this.prisma.prompt.findFirst({ where: { id: promptId, workspaceId } });
    if (!prompt) throw new NotFoundException('Prompt not found');

    const existing = await this.prisma.promptDatasetConfig.findFirst({
      where: { promptId, datasetId: data.datasetId },
    });

    // Resolve the dataset version — use provided ID or fall back to latest
    const versionId =
      data.datasetVersionId ??
      (
        await this.prisma.datasetVersion.findFirst({
          where: { datasetId: data.datasetId, status: 'latest' },
          orderBy: { versionNumber: 'desc' },
        })
      )?.id;
    if (!versionId) throw new NotFoundException('No dataset version found');

    if (existing) {
      return this.prisma.promptDatasetConfig.update({
        where: { id: existing.id },
        data: {
          datasetVersion: { connect: { id: versionId } },
          variableMapping: data.variableMapping,
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });
    }

    return this.prisma.promptDatasetConfig.create({
      data: {
        prompt: { connect: { id: promptId } },
        dataset: { connect: { id: data.datasetId } },
        datasetVersion: { connect: { id: versionId } },
        variableMapping: data.variableMapping,
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async compareVersions(
    promptId: string,
    workspaceId: string,
    versionA: number,
    versionB: number,
  ): Promise<{
    versionA: number;
    versionB: number;
    hunks: { type: 'added' | 'removed' | 'unchanged'; line: string }[];
  }> {
    const prompt = await this.prisma.prompt.findFirst({ where: { id: promptId, workspaceId } });
    if (!prompt) throw new NotFoundException('Prompt not found');

    const [va, vb] = await Promise.all([
      this.prisma.promptVersion.findUnique({
        where: { promptId_versionNumber: { promptId, versionNumber: versionA } },
      }),
      this.prisma.promptVersion.findUnique({
        where: { promptId_versionNumber: { promptId, versionNumber: versionB } },
      }),
    ]);
    if (!va) throw new NotFoundException(`Version ${versionA} not found`);
    if (!vb) throw new NotFoundException(`Version ${versionB} not found`);

    const linesA = va.content.split('\n');
    const linesB = vb.content.split('\n');
    const hunks = this.computeLineDiff(linesA, linesB);

    return { versionA, versionB, hunks };
  }

  private computeLineDiff(
    linesA: string[],
    linesB: string[],
  ): { type: 'added' | 'removed' | 'unchanged'; line: string }[] {
    // LCS-based line diff
    const m = linesA.length;
    const n = linesB.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i]![j] =
          linesA[i - 1] === linesB[j - 1]
            ? dp[i - 1]![j - 1]! + 1
            : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }

    const result: { type: 'added' | 'removed' | 'unchanged'; line: string }[] = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
        result.unshift({ type: 'unchanged', line: linesA[i - 1]! });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
        result.unshift({ type: 'added', line: linesB[j - 1]! });
        j--;
      } else {
        result.unshift({ type: 'removed', line: linesA[i - 1]! });
        i--;
      }
    }
    return result;
  }

  async regressionTest(
    promptId: string,
    workspaceId: string,
    baselineVersionNumber?: number,
  ): Promise<{
    latestVersion: number;
    baselineVersion: number;
    improved: string[];
    degraded: string[];
    unchanged: string[];
    scoreDelta: Record<string, number>;
  }> {
    const prompt = await this.prisma.prompt.findFirst({
      where: { id: promptId, workspaceId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');

    const latestVersionNumber = prompt.versions[0]?.versionNumber ?? 1;
    const resolvedBaseline = baselineVersionNumber ?? latestVersionNumber - 1;

    if (resolvedBaseline < 1) {
      throw new NotFoundException('No baseline version available — prompt has only one version');
    }

    // Find the most recent completed evaluation jobs for each version
    const [latestJob, baselineJob] = await Promise.all([
      this.prisma.evaluationJob.findFirst({
        where: {
          promptId,
          promptVersion: { versionNumber: latestVersionNumber },
          status: 'completed',
        },
        orderBy: { completedAt: 'desc' },
        include: { results: true },
      }),
      this.prisma.evaluationJob.findFirst({
        where: {
          promptId,
          promptVersion: { versionNumber: resolvedBaseline },
          status: 'completed',
        },
        orderBy: { completedAt: 'desc' },
        include: { results: true },
      }),
    ]);

    if (!latestJob) throw new NotFoundException('No completed evaluation found for latest version');
    if (!baselineJob)
      throw new NotFoundException(
        `No completed evaluation found for baseline version ${resolvedBaseline}`,
      );

    const latestScores = new Map(latestJob.results.map((r) => [r.metricName, r.score]));
    const baselineScores = new Map(baselineJob.results.map((r) => [r.metricName, r.score]));

    const improved: string[] = [];
    const degraded: string[] = [];
    const unchanged: string[] = [];
    const scoreDelta: Record<string, number> = {};

    for (const [metric, latestScore] of latestScores) {
      const baseScore = baselineScores.get(metric);
      if (baseScore === undefined) continue;
      const delta = latestScore - baseScore;
      scoreDelta[metric] = delta;
      if (delta > 0.01) improved.push(metric);
      else if (delta < -0.01) degraded.push(metric);
      else unchanged.push(metric);
    }

    return {
      latestVersion: latestVersionNumber,
      baselineVersion: resolvedBaseline,
      improved,
      degraded,
      unchanged,
      scoreDelta,
    };
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
