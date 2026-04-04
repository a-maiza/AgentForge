import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Deployment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { DeployPromptDto } from './dto/deploy-prompt.dto';
import type { PromoteDeploymentDto } from './dto/promote-deployment.dto';

const ENVIRONMENT_ORDER: Array<'dev' | 'staging' | 'prod'> = ['dev', 'staging', 'prod'];

@Injectable()
export class DeploymentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Authorization helper ────────────────────────────────────────────────────

  private async getPromptForUser(promptId: string, userId: string) {
    const prompt = await this.prisma.prompt.findFirst({
      where: {
        id: promptId,
        workspace: { members: { some: { userId } } },
      },
      select: { id: true },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');
    return prompt;
  }

  // ─── Semver label ────────────────────────────────────────────────────────────

  private async nextVersionLabel(promptId: string): Promise<string> {
    const latest = await this.prisma.deployment.findFirst({
      where: { promptId, status: 'active' },
      orderBy: { deployedAt: 'desc' },
      select: { versionLabel: true },
    });

    if (!latest) return '1.0.0.1';

    const parts = latest.versionLabel.split('.');
    const build = Number.parseInt(parts[3] ?? '0', 10);
    return `${parts[0]}.${parts[1]}.${parts[2]}.${build + 1}`;
  }

  // ─── Deploy ──────────────────────────────────────────────────────────────────

  async deploy(promptId: string, dto: DeployPromptDto, userId: string): Promise<Deployment> {
    await this.getPromptForUser(promptId, userId);

    // Validate promptVersion belongs to this prompt
    const version = await this.prisma.promptVersion.findFirst({
      where: { id: dto.promptVersionId, promptId },
    });
    if (!version) throw new NotFoundException('Prompt version not found');

    const versionLabel = await this.nextVersionLabel(promptId);

    return this.prisma.deployment.create({
      data: {
        promptId,
        promptVersionId: dto.promptVersionId,
        environment: dto.environment,
        status: 'active',
        versionLabel,
        isLive: false,
        deployedBy: userId,
        notes: dto.notes ?? null,
      },
    });
  }

  // ─── Promote ─────────────────────────────────────────────────────────────────

  async promote(promptId: string, dto: PromoteDeploymentDto, userId: string): Promise<Deployment> {
    await this.getPromptForUser(promptId, userId);

    const targetIdx = ENVIRONMENT_ORDER.indexOf(dto.targetEnvironment);
    if (targetIdx <= 0) {
      throw new BadRequestException('Cannot promote to dev; choose staging or prod');
    }

    const sourceEnv = ENVIRONMENT_ORDER[targetIdx - 1]!;

    const source = await this.prisma.deployment.findFirst({
      where: { promptId, environment: sourceEnv, status: 'active' },
      orderBy: { deployedAt: 'desc' },
      select: { promptVersionId: true, versionLabel: true, notes: true },
    });
    if (!source) {
      throw new NotFoundException(`No active deployment in ${sourceEnv} to promote`);
    }

    // Mark old active in target env as inactive
    await this.prisma.deployment.updateMany({
      where: { promptId, environment: dto.targetEnvironment, status: 'active' },
      data: { status: 'inactive' },
    });

    return this.prisma.deployment.create({
      data: {
        promptId,
        promptVersionId: source.promptVersionId,
        environment: dto.targetEnvironment,
        status: 'active',
        versionLabel: source.versionLabel,
        isLive: false,
        deployedBy: userId,
        notes: dto.notes ?? null,
      },
    });
  }

  // ─── Rollback ────────────────────────────────────────────────────────────────

  async rollback(promptId: string, environment: string, userId: string): Promise<Deployment> {
    await this.getPromptForUser(promptId, userId);

    const env = environment as 'dev' | 'staging' | 'prod';

    const current = await this.prisma.deployment.findFirst({
      where: { promptId, environment: env, status: 'active' },
      orderBy: { deployedAt: 'desc' },
    });
    if (!current) throw new NotFoundException('No active deployment to roll back');

    return this.prisma.deployment.update({
      where: { id: current.id },
      data: { status: 'rolled_back', isLive: false, rolledBackAt: new Date() },
    });
  }

  // ─── Go-live ─────────────────────────────────────────────────────────────────

  async goLive(promptId: string, environment: string, userId: string): Promise<Deployment> {
    await this.getPromptForUser(promptId, userId);

    const env = environment as 'dev' | 'staging' | 'prod';

    const deployment = await this.prisma.deployment.findFirst({
      where: { promptId, environment: env, status: 'active' },
      orderBy: { deployedAt: 'desc' },
    });
    if (!deployment) throw new NotFoundException('No active deployment in this environment');

    const endpointHash = randomBytes(16).toString('hex');

    const [updated] = await this.prisma.$transaction([
      this.prisma.deployment.update({
        where: { id: deployment.id },
        data: { isLive: true, endpointHash },
      }),
      // Update prompt status to live
      this.prisma.prompt.update({
        where: { id: promptId },
        data: { status: 'live' },
      }),
    ]);

    return updated;
  }

  // ─── List (pipeline state) ───────────────────────────────────────────────────

  async findAll(promptId: string, userId: string): Promise<Record<string, Deployment | null>> {
    await this.getPromptForUser(promptId, userId);

    const deployments = await this.prisma.deployment.findMany({
      where: { promptId, status: 'active' },
      orderBy: { deployedAt: 'desc' },
      include: {
        promptVersion: { select: { versionNumber: true, content: true } },
        deployer: { select: { name: true, email: true } },
      },
    });

    // Return latest active deployment per environment
    const result: Record<string, Deployment | null> = { dev: null, staging: null, prod: null };
    for (const env of ENVIRONMENT_ORDER) {
      result[env] = deployments.find((d) => d.environment === env) ?? null;
    }
    return result;
  }

  // ─── History ─────────────────────────────────────────────────────────────────

  async findHistory(promptId: string, userId: string): Promise<Deployment[]> {
    await this.getPromptForUser(promptId, userId);

    return this.prisma.deployment.findMany({
      where: { promptId },
      orderBy: { deployedAt: 'desc' },
      include: {
        promptVersion: { select: { versionNumber: true } },
        deployer: { select: { name: true, email: true } },
      },
    });
  }
}
