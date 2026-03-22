import { Injectable, NotFoundException } from '@nestjs/common';
import type { FailoverConfig } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertFailoverConfigDto } from './dto/upsert-failover-config.dto';

@Injectable()
export class FailoverConfigsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertPromptAccess(promptId: string, userId: string) {
    const prompt = await this.prisma.prompt.findFirst({
      where: { id: promptId, workspace: { members: { some: { userId } } } },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');
  }

  async findOne(promptId: string, userId: string): Promise<FailoverConfig> {
    await this.assertPromptAccess(promptId, userId);
    const config = await this.prisma.failoverConfig.findUnique({ where: { promptId } });
    if (!config) throw new NotFoundException('Failover config not found');
    return config;
  }

  async upsert(
    promptId: string,
    dto: UpsertFailoverConfigDto,
    userId: string,
  ): Promise<FailoverConfig> {
    await this.assertPromptAccess(promptId, userId);

    const data = {
      promptId,
      primaryProviderId: dto.primaryProviderId,
      secondaryProviderId: dto.secondaryProviderId,
      isActive: dto.isEnabled ?? true,
      timeoutMs: dto.timeoutMs ?? 30000,
      errorThreshold: dto.errorThreshold ?? 3,
      latencyThresholdMs: dto.maxLatencyMs ?? 5000,
      // Convert ms → seconds for storage
      recoveryIntervalSec:
        dto.recoveryCheckIntervalMs != null ? Math.round(dto.recoveryCheckIntervalMs / 1000) : 60,
    };

    return this.prisma.failoverConfig.upsert({
      where: { promptId },
      create: data,
      update: {
        primaryProviderId: data.primaryProviderId,
        secondaryProviderId: data.secondaryProviderId,
        isActive: data.isActive,
        timeoutMs: data.timeoutMs,
        errorThreshold: data.errorThreshold,
        latencyThresholdMs: data.latencyThresholdMs,
        recoveryIntervalSec: data.recoveryIntervalSec,
      },
    });
  }

  async remove(promptId: string, userId: string): Promise<void> {
    await this.assertPromptAccess(promptId, userId);
    const config = await this.prisma.failoverConfig.findUnique({ where: { promptId } });
    if (!config) throw new NotFoundException('Failover config not found');
    await this.prisma.failoverConfig.delete({ where: { promptId } });
  }
}
