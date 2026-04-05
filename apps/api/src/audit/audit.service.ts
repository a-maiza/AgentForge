import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { audit_action, Prisma } from '@prisma/client';

export interface CreateAuditLogDto {
  userId: string;
  workspaceId?: string;
  action: audit_action;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export interface AuditLogCursor {
  workspaceId: string;
  /** ISO date string — return logs older than this cursor */
  cursor?: string;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(dto: CreateAuditLogDto): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: dto.userId,
        ...(dto.workspaceId ? { workspaceId: dto.workspaceId } : {}),
        action: dto.action,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        ...(dto.metadata
          ? { metadata: dto.metadata as Prisma.InputJsonValue }
          : {}),
        ...(dto.ipAddress ? { ipAddress: dto.ipAddress } : {}),
      },
    });
  }

  async findByWorkspace({ workspaceId, cursor, limit = 50 }: AuditLogCursor) {
    const take = Math.min(limit, 200);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        workspaceId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      select: {
        id: true,
        userId: true,
        workspaceId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        metadata: true,
        ipAddress: true,
        createdAt: true,
      },
    });

    const hasMore = logs.length > take;
    const items = hasMore ? logs.slice(0, take) : logs;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : null;

    return { items, nextCursor, hasMore };
  }
}
