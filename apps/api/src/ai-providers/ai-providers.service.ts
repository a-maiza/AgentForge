import { Injectable, NotFoundException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import type { AiProvider } from '@prisma/client';
import type { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import type { UpdateAiProviderDto } from './dto/update-ai-provider.dto';

type AiProviderSafe = Omit<AiProvider, 'apiKeyEncrypted'>;

const PROVIDERS_TTL_S = 60;

function redisConnection(): { host: string; port: number } {
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const parsed = new URL(url);
  return { host: parsed.hostname, port: Number(parsed.port) || 6379 };
}

@Injectable()
export class AiProvidersService {
  private readonly redis = new Redis(redisConnection());

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  private cacheKey(workspaceId: string) {
    return `ai_providers:${workspaceId}`;
  }

  private async invalidate(workspaceId: string) {
    await this.redis.del(this.cacheKey(workspaceId));
  }

  async findAll(workspaceId: string): Promise<AiProviderSafe[]> {
    const key = this.cacheKey(workspaceId);
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as AiProviderSafe[];

    const providers = await this.prisma.aiProvider.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    const safe = providers.map(this.sanitize);
    await this.redis.set(key, JSON.stringify(safe), 'EX', PROVIDERS_TTL_S);
    return safe;
  }

  async findOne(id: string, workspaceId: string): Promise<AiProviderSafe> {
    const provider = await this.prisma.aiProvider.findFirst({ where: { id, workspaceId } });
    if (!provider) throw new NotFoundException('AI provider not found');
    return this.sanitize(provider);
  }

  async create(workspaceId: string, dto: CreateAiProviderDto): Promise<AiProviderSafe> {
    const apiKeyEncrypted = this.encryption.encrypt(dto.apiKey);
    const provider = await this.prisma.aiProvider.create({
      data: {
        workspaceId,
        name: dto.name,
        providerType: dto.providerType,
        apiKeyEncrypted,
        ...(dto.baseUrl !== undefined && { baseUrl: dto.baseUrl }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    await this.invalidate(workspaceId);
    return this.sanitize(provider);
  }

  async update(id: string, workspaceId: string, dto: UpdateAiProviderDto): Promise<AiProviderSafe> {
    const provider = await this.prisma.aiProvider.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!provider) throw new NotFoundException('AI provider not found');
    const updated = await this.prisma.aiProvider.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.providerType !== undefined && { providerType: dto.providerType }),
        ...(dto.apiKey !== undefined && { apiKeyEncrypted: this.encryption.encrypt(dto.apiKey) }),
        ...(dto.baseUrl !== undefined && { baseUrl: dto.baseUrl }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    await this.invalidate(workspaceId);
    return this.sanitize(updated);
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    const provider = await this.prisma.aiProvider.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!provider) throw new NotFoundException('AI provider not found');
    await this.prisma.aiProvider.delete({ where: { id } });
    await this.invalidate(workspaceId);
  }

  /** Decrypt key only for internal use (e.g. LiteLLM calls) — never exposed via API */
  async getDecryptedKey(id: string, workspaceId: string): Promise<string> {
    const provider = await this.prisma.aiProvider.findFirst({ where: { id, workspaceId }, select: { id: true, apiKeyEncrypted: true } });
    if (!provider) throw new NotFoundException('AI provider not found');
    return this.encryption.decrypt(provider.apiKeyEncrypted);
  }

  private sanitize(provider: AiProvider): AiProviderSafe {
    const { apiKeyEncrypted: _, ...safe } = provider;
    return safe;
  }
}
