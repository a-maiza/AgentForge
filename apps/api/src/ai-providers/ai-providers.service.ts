import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import type { AiProvider } from '@prisma/client';
import type { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import type { UpdateAiProviderDto } from './dto/update-ai-provider.dto';

type AiProviderSafe = Omit<AiProvider, 'apiKeyEncrypted'>;

@Injectable()
export class AiProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async findAll(workspaceId: string): Promise<AiProviderSafe[]> {
    const providers = await this.prisma.aiProvider.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return providers.map(this.sanitize);
  }

  async findOne(id: string, workspaceId: string): Promise<AiProviderSafe> {
    const provider = await this.prisma.aiProvider.findFirst({ where: { id, workspaceId } });
    if (!provider) throw new NotFoundException('AI provider not found');
    return this.sanitize(provider);
  }

  async create(dto: CreateAiProviderDto): Promise<AiProviderSafe> {
    const apiKeyEncrypted = this.encryption.encrypt(dto.apiKey);
    const provider = await this.prisma.aiProvider.create({
      data: {
        workspaceId: dto.workspaceId,
        name: dto.name,
        providerType: dto.providerType,
        apiKeyEncrypted,
        ...(dto.baseUrl !== undefined && { baseUrl: dto.baseUrl }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return this.sanitize(provider);
  }

  async update(id: string, workspaceId: string, dto: UpdateAiProviderDto): Promise<AiProviderSafe> {
    const provider = await this.prisma.aiProvider.findFirst({ where: { id, workspaceId } });
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
    return this.sanitize(updated);
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    const provider = await this.prisma.aiProvider.findFirst({ where: { id, workspaceId } });
    if (!provider) throw new NotFoundException('AI provider not found');
    await this.prisma.aiProvider.delete({ where: { id } });
  }

  /** Decrypt key only for internal use (e.g. LiteLLM calls) — never exposed via API */
  async getDecryptedKey(id: string, workspaceId: string): Promise<string> {
    const provider = await this.prisma.aiProvider.findFirst({ where: { id, workspaceId } });
    if (!provider) throw new NotFoundException('AI provider not found');
    return this.encryption.decrypt(provider.apiKeyEncrypted);
  }

  private sanitize(provider: AiProvider): AiProviderSafe {
    const { apiKeyEncrypted: _, ...safe } = provider;
    return safe;
  }
}
