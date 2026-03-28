import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import type { ApiKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateApiKeyDto } from './dto/create-api-key.dto';

const API_KEY_PREFIXES: Record<string, string> = {
  organization: 'sk_org_',
  workspace: 'sk_ws_',
  readonly: 'sk_ro_',
};

// Map scope → Prisma enum type
const SCOPE_TO_TYPE: Record<string, 'org' | 'workspace' | 'readonly'> = {
  organization: 'org',
  workspace: 'workspace',
  readonly: 'readonly',
};

type ApiKeySafe = Omit<ApiKey, 'keyHash'>;

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitize(key: ApiKey): ApiKeySafe {
    const { keyHash: _kh, ...safe } = key;
    return safe;
  }

  async create(
    workspaceId: string,
    dto: CreateApiKeyDto,
    userId: string,
  ): Promise<ApiKeySafe & { key: string }> {
    const raw = randomBytes(32).toString('hex');
    const prefix = API_KEY_PREFIXES[dto.scope] ?? 'sk_ws_';
    const fullKey = `${prefix}${raw}`;
    const keyHash = await bcrypt.hash(fullKey, 12);
    const type = SCOPE_TO_TYPE[dto.scope] ?? 'workspace';

    const apiKey = await this.prisma.apiKey.create({
      data: {
        workspaceId,
        name: dto.name,
        prefix,
        keyHash,
        type,
        status: 'active',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdBy: userId,
      },
    });

    return { ...this.sanitize(apiKey), key: fullKey };
  }

  async findAll(workspaceId: string, status?: string): Promise<ApiKeySafe[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: {
        workspaceId,
        ...(status && { status: status as 'active' | 'disabled' | 'expired' }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((k) => this.sanitize(k));
  }

  async findOne(id: string, workspaceId: string): Promise<ApiKeySafe> {
    const key = await this.prisma.apiKey.findFirst({ where: { id, workspaceId } });
    if (!key) throw new NotFoundException('API key not found');
    return this.sanitize(key);
  }

  async disable(id: string, workspaceId: string): Promise<ApiKeySafe> {
    const key = await this.prisma.apiKey.findFirst({ where: { id, workspaceId } });
    if (!key) throw new NotFoundException('API key not found');

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: { status: 'disabled' },
    });
    return this.sanitize(updated);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const key = await this.prisma.apiKey.findFirst({ where: { id, workspaceId } });
    if (!key) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.delete({ where: { id } });
  }
}
