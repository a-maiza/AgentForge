import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';
import { PrismaService } from '../prisma/prisma.service';

const JOB_ID = 'job-1';
const PROMPT_ID = 'prompt-1';
const USER_ID = 'user-1';

const mockJob = {
  id: JOB_ID,
  promptId: PROMPT_ID,
  promptVersionId: 'pv-1',
  datasetId: 'ds-1',
  datasetVersionId: 'dv-1',
  providerId: 'prov-1',
  modelName: 'gpt-4',
  modelConfig: {},
  metrics: ['f1'],
  status: 'pending',
  progress: 0,
  startedAt: null,
  completedAt: null,
  createdBy: USER_ID,
  createdAt: new Date(),
};

const mockBullJob = { remove: jest.fn().mockResolvedValue(undefined) };

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'bull-job-1' }),
  getJob: jest.fn().mockResolvedValue(null),
};

// Mock BullMQ to avoid real Redis connection
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => mockQueue),
}));

const mockPrisma = {
  prompt: { findUnique: jest.fn() },
  promptDatasetConfig: { findFirst: jest.fn() },
  promptAiConfig: { findFirst: jest.fn() },
  evaluationJob: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  evaluationTrace: { findMany: jest.fn() },
};

describe('EvaluationsService', () => {
  let service: EvaluationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EvaluationsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<EvaluationsService>(EvaluationsService);
    jest.clearAllMocks();
    mockQueue.getJob.mockResolvedValue(null);
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const baseDto = {
      promptId: PROMPT_ID,
      promptVersionId: 'pv-1',
      datasetId: 'ds-1',
      datasetVersionId: 'dv-1',
      providerId: 'prov-1',
      modelName: 'gpt-4',
      metrics: ['f1'],
    };

    it('creates a job with explicit dataset and provider', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.evaluationJob.create.mockResolvedValue(mockJob);

      const result = await service.create(baseDto, USER_ID);
      expect(result.id).toBe(JOB_ID);
      expect(mockQueue.add).toHaveBeenCalledWith('evaluate', { jobId: JOB_ID }, { jobId: JOB_ID });
    });

    it('resolves dataset from prompt config when not provided', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.promptDatasetConfig.findFirst.mockResolvedValue({
        datasetId: 'ds-1',
        datasetVersionId: 'dv-1',
      });
      mockPrisma.evaluationJob.create.mockResolvedValue(mockJob);

      const { datasetId: _a, datasetVersionId: _b, ...dtoPart } = baseDto;
      const result = await service.create(dtoPart, USER_ID);
      expect(result.id).toBe(JOB_ID);
    });

    it('throws BadRequestException when no dataset configured', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.promptDatasetConfig.findFirst.mockResolvedValue(null);

      const { datasetId: _a, ...dtoPart } = baseDto;
      await expect(service.create(dtoPart, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('resolves AI provider from prompt config when not provided', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.promptAiConfig.findFirst.mockResolvedValue({
        providerId: 'prov-1',
        modelName: 'gpt-4',
        temperature: 0.7,
        topP: null,
        maxTokens: null,
      });
      mockPrisma.evaluationJob.create.mockResolvedValue(mockJob);

      const { providerId: _a, modelName: _b, ...dtoPart } = baseDto;
      const result = await service.create(dtoPart, USER_ID);
      expect(result.id).toBe(JOB_ID);
    });

    it('throws BadRequestException when no AI provider configured', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.promptAiConfig.findFirst.mockResolvedValue(null);

      const { providerId: _a, ...dtoPart } = baseDto;
      await expect(service.create(dtoPart, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when prompt not found', async () => {
      mockPrisma.prompt.findUnique.mockResolvedValue(null);
      await expect(service.create(baseDto, USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns job with computed duration when both timestamps present', async () => {
      const start = new Date('2026-01-01T00:00:00Z');
      const end = new Date('2026-01-01T00:01:30Z');
      mockPrisma.evaluationJob.findUnique.mockResolvedValue({
        ...mockJob,
        startedAt: start,
        completedAt: end,
        prompt: { name: 'My Prompt' },
        provider: { name: 'OpenAI' },
        dataset: { name: 'Test DS' },
        results: [],
      });
      const result = await service.findOne(JOB_ID);
      expect(result['duration']).toBe(90);
      expect(result['promptName']).toBe('My Prompt');
    });

    it('returns job without duration when timestamps missing', async () => {
      mockPrisma.evaluationJob.findUnique.mockResolvedValue({
        ...mockJob,
        prompt: { name: 'P' },
        provider: { name: 'P' },
        dataset: { name: 'D' },
        results: [],
      });
      const result = await service.findOne(JOB_ID);
      expect(result['duration']).toBeUndefined();
    });

    it('throws NotFoundException for unknown job', async () => {
      mockPrisma.evaluationJob.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns items with no next cursor when under page limit', async () => {
      mockPrisma.evaluationJob.findMany.mockResolvedValue([
        { ...mockJob, prompt: { name: 'P' }, promptVersion: { versionNumber: 1 }, provider: { name: 'O' }, dataset: { name: 'D' } },
      ]);
      const result = await service.findAll();
      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('returns nextCursor when results exceed take', async () => {
      const jobs = Array.from({ length: 26 }, (_, i) => ({
        ...mockJob,
        id: `job-${i}`,
        prompt: { name: 'P' },
        promptVersion: { versionNumber: 1 },
        provider: { name: 'O' },
        dataset: { name: 'D' },
      }));
      mockPrisma.evaluationJob.findMany.mockResolvedValue(jobs);
      const result = await service.findAll({}, 25);
      expect(result.items).toHaveLength(25);
      expect(result.nextCursor).toBe('job-25');
    });

    it('filters by status', async () => {
      mockPrisma.evaluationJob.findMany.mockResolvedValue([]);
      await service.findAll({ status: 'completed' });
      expect(mockPrisma.evaluationJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'completed' }),
        }),
      );
    });
  });

  // ─── getTraces ───────────────────────────────────────────────────────────────

  describe('getTraces', () => {
    it('returns traces for a job', async () => {
      mockPrisma.evaluationJob.findUnique.mockResolvedValue({ id: JOB_ID });
      mockPrisma.evaluationTrace.findMany.mockResolvedValue([{ id: 'trace-1', rowIndex: 0 }]);
      const result = await service.getTraces(JOB_ID);
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException for unknown job', async () => {
      mockPrisma.evaluationJob.findUnique.mockResolvedValue(null);
      await expect(service.getTraces('bad')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── cancel ──────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('cancels the job and removes from queue', async () => {
      mockPrisma.evaluationJob.findUnique.mockResolvedValue({ id: JOB_ID });
      mockQueue.getJob.mockResolvedValue(mockBullJob);
      mockPrisma.evaluationJob.update.mockResolvedValue({ ...mockJob, status: 'cancelled' });

      const result = await service.cancel(JOB_ID);
      expect(result.status).toBe('cancelled');
      expect(mockBullJob.remove).toHaveBeenCalled();
    });

    it('cancels even when job not in queue', async () => {
      mockPrisma.evaluationJob.findUnique.mockResolvedValue({ id: JOB_ID });
      mockQueue.getJob.mockResolvedValue(null);
      mockPrisma.evaluationJob.update.mockResolvedValue({ ...mockJob, status: 'cancelled' });
      const result = await service.cancel(JOB_ID);
      expect(result.status).toBe('cancelled');
    });

    it('throws NotFoundException for unknown job', async () => {
      mockPrisma.evaluationJob.findUnique.mockResolvedValue(null);
      await expect(service.cancel('bad')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the job', async () => {
      mockPrisma.evaluationJob.findUnique.mockResolvedValue({ id: JOB_ID });
      mockQueue.getJob.mockResolvedValue(null);
      mockPrisma.evaluationJob.delete.mockResolvedValue(mockJob);
      await expect(service.remove(JOB_ID)).resolves.toBeUndefined();
    });

    it('throws NotFoundException for unknown job', async () => {
      mockPrisma.evaluationJob.findUnique.mockResolvedValue(null);
      await expect(service.remove('bad')).rejects.toThrow(NotFoundException);
    });
  });
});
