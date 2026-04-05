import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FailoverConfigsService } from './failover-configs.service';
import { PrismaService } from '../prisma/prisma.service';

const PROMPT_ID = 'prompt-1';
const USER_ID = 'user-1';

const mockPrompt = { id: PROMPT_ID, workspaceId: 'ws-1' };
const mockConfig = {
  id: 'cfg-1',
  promptId: PROMPT_ID,
  primaryProviderId: 'prov-a',
  secondaryProviderId: 'prov-b',
  isActive: true,
  timeoutMs: 30000,
  errorThreshold: 3,
  latencyThresholdMs: 5000,
  recoveryIntervalSec: 60,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  prompt: { findFirst: jest.fn() },
  failoverConfig: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
};

describe('FailoverConfigsService', () => {
  let service: FailoverConfigsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FailoverConfigsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<FailoverConfigsService>(FailoverConfigsService);
    jest.clearAllMocks();
  });

  describe('findOne', () => {
    it('returns config when prompt accessible', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(mockPrompt);
      mockPrisma.failoverConfig.findUnique.mockResolvedValue(mockConfig);
      const result = await service.findOne(PROMPT_ID, USER_ID);
      expect(result.id).toBe('cfg-1');
    });

    it('throws NotFoundException when prompt not accessible', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(null);
      await expect(service.findOne(PROMPT_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when config not found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(mockPrompt);
      mockPrisma.failoverConfig.findUnique.mockResolvedValue(null);
      await expect(service.findOne(PROMPT_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsert', () => {
    const dto = {
      primaryProviderId: 'prov-a',
      secondaryProviderId: 'prov-b',
      isEnabled: true,
      timeoutMs: 5000,
      errorThreshold: 2,
      maxLatencyMs: 3000,
      recoveryCheckIntervalMs: 30000,
    };

    it('upserts the config', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(mockPrompt);
      mockPrisma.failoverConfig.upsert.mockResolvedValue(mockConfig);
      const result = await service.upsert(PROMPT_ID, dto, USER_ID);
      expect(result.id).toBe('cfg-1');
      expect(mockPrisma.failoverConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { promptId: PROMPT_ID },
          create: expect.objectContaining({ recoveryIntervalSec: 30 }),
        }),
      );
    });

    it('uses default recoveryIntervalSec when not provided', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(mockPrompt);
      mockPrisma.failoverConfig.upsert.mockResolvedValue(mockConfig);
      const { recoveryCheckIntervalMs: _ms, ...dtoWithout } = dto;
      await service.upsert(PROMPT_ID, dtoWithout, USER_ID);
      expect(mockPrisma.failoverConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ recoveryIntervalSec: 60 }),
        }),
      );
    });

    it('throws NotFoundException when prompt not accessible', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(null);
      await expect(service.upsert(PROMPT_ID, dto, USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the config', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(mockPrompt);
      mockPrisma.failoverConfig.findUnique.mockResolvedValue(mockConfig);
      mockPrisma.failoverConfig.delete.mockResolvedValue(mockConfig);
      await expect(service.remove(PROMPT_ID, USER_ID)).resolves.toBeUndefined();
    });

    it('throws NotFoundException when config does not exist', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(mockPrompt);
      mockPrisma.failoverConfig.findUnique.mockResolvedValue(null);
      await expect(service.remove(PROMPT_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
