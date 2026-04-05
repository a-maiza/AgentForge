import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PromptAiConfigsService } from './prompt-ai-configs.service';
import { PrismaService } from '../prisma/prisma.service';

const PROMPT_ID = 'prompt-1';
const WS_ID = 'ws-1';
const CFG_ID = 'cfg-1';
const PROV_ID = 'prov-1';

const mockConfig = {
  id: CFG_ID,
  promptId: PROMPT_ID,
  providerId: PROV_ID,
  modelName: 'gpt-4',
  temperature: 0.7,
  topP: null,
  topK: null,
  maxTokens: null,
  isActive: true,
};

const mockPrisma = {
  prompt: { findFirst: jest.fn() },
  promptAiConfig: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('PromptAiConfigsService', () => {
  let service: PromptAiConfigsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptAiConfigsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<PromptAiConfigsService>(PromptAiConfigsService);
    jest.clearAllMocks();
  });

  describe('findByPrompt', () => {
    it('returns configs for an accessible prompt', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.promptAiConfig.findMany.mockResolvedValue([mockConfig]);
      const result = await service.findByPrompt(PROMPT_ID, WS_ID);
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException when prompt not in workspace', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(null);
      await expect(service.findByPrompt(PROMPT_ID, WS_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsert', () => {
    const dto = {
      providerId: PROV_ID,
      modelName: 'gpt-4',
      temperature: 0.7,
      isActive: true,
    };

    it('creates config when none exists', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.promptAiConfig.findFirst.mockResolvedValue(null);
      mockPrisma.promptAiConfig.create.mockResolvedValue(mockConfig);

      const result = await service.upsert(PROMPT_ID, WS_ID, dto);
      expect(result.id).toBe(CFG_ID);
      expect(mockPrisma.promptAiConfig.create).toHaveBeenCalled();
    });

    it('updates config when one exists', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.promptAiConfig.findFirst.mockResolvedValue({ id: CFG_ID });
      mockPrisma.promptAiConfig.update.mockResolvedValue({ ...mockConfig, modelName: 'gpt-4-turbo' });

      const result = await service.upsert(PROMPT_ID, WS_ID, { ...dto, modelName: 'gpt-4-turbo' });
      expect(mockPrisma.promptAiConfig.update).toHaveBeenCalled();
      expect(result.modelName).toBe('gpt-4-turbo');
    });

    it('throws NotFoundException when prompt not accessible', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(null);
      await expect(service.upsert(PROMPT_ID, WS_ID, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes the config', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.promptAiConfig.findFirst.mockResolvedValue({ id: CFG_ID });
      mockPrisma.promptAiConfig.delete.mockResolvedValue(mockConfig);
      await expect(service.delete(PROMPT_ID, CFG_ID, WS_ID)).resolves.toBeUndefined();
    });

    it('throws NotFoundException when config not found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.promptAiConfig.findFirst.mockResolvedValue(null);
      await expect(service.delete(PROMPT_ID, 'bad', WS_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
