import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  prompt: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  promptVersion: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  promptVariable: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
  },
  promptDatasetConfig: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  datasetVersion: {
    findFirst: jest.fn(),
  },
  evaluationJob: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('PromptsService', () => {
  let service: PromptsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<PromptsService>(PromptsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── extractVariables ───────────────────────────────────────────────────────

  describe('extractVariables', () => {
    it('extracts unique variable names', () => {
      const vars = service.extractVariables(
        'Hello {{name}}, you are {{age}} years old, {{name}} again',
      );
      expect(vars).toHaveLength(2);
      expect(vars).toEqual(expect.arrayContaining(['name', 'age']));
    });

    it('returns empty array when no variables', () => {
      expect(service.extractVariables('No variables here')).toEqual([]);
    });

    it('handles empty string', () => {
      expect(service.extractVariables('')).toEqual([]);
    });

    it('accepts underscore-prefixed identifiers', () => {
      expect(service.extractVariables('{{_private}}')).toContain('_private');
    });

    it('accepts identifiers with numbers after first char', () => {
      expect(service.extractVariables('{{var1}} {{var_2}}')).toEqual(
        expect.arrayContaining(['var1', 'var_2']),
      );
    });

    it('ignores patterns starting with a digit', () => {
      const vars = service.extractVariables('{{valid}} {{123invalid}}');
      expect(vars).toContain('valid');
      expect(vars).not.toContain('123invalid');
    });

    it('handles adjacent variables', () => {
      const vars = service.extractVariables('{{a}}{{b}}{{c}}');
      expect(vars).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    });
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('queries prompts scoped to workspaceId', async () => {
      mockPrisma.prompt.findMany.mockResolvedValue([]);
      await service.findAll('ws-1');
      expect(mockPrisma.prompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workspaceId: 'ws-1' } }),
      );
    });

    it('returns nextCursor when results exceed take', async () => {
      const prompts = Array.from({ length: 26 }, (_, i) => ({ id: `p-${i}` }));
      mockPrisma.prompt.findMany.mockResolvedValue(prompts);
      const result = await service.findAll('ws-1', 25);
      expect(result.items).toHaveLength(25);
      expect(result.nextCursor).toBe('p-25');
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns prompt with versions and variables', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({
        id: 'p-1',
        versions: [{ versionNumber: 1, content: 'Hello' }],
        variables: [{ name: 'var' }],
      });
      const result = await service.findOne('p-1', 'ws-1');
      expect(result.id).toBe('p-1');
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(null);
      await expect(service.findOne('bad', 'ws-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates prompt with version 1 and extracted variables', async () => {
      const prompt = { id: 'p-1', workspaceId: 'ws-1' };
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
      );
      mockPrisma.prompt.create.mockResolvedValue(prompt);
      mockPrisma.promptVersion.create.mockResolvedValue({});
      mockPrisma.promptVariable.createMany.mockResolvedValue({ count: 1 });

      const result = await service.create(
        'ws-1',
        { name: 'Test', content: 'Hello {{user}}' },
        'user-1',
      );

      expect(mockPrisma.prompt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Test', workspaceId: 'ws-1', status: 'draft' }),
        }),
      );
      expect(mockPrisma.promptVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ versionNumber: 1, content: 'Hello {{user}}' }),
        }),
      );
      expect(mockPrisma.promptVariable.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([{ promptId: 'p-1', name: 'user', type: 'string' }]),
        }),
      );
      expect(result).toEqual(prompt);
    });

    it('does not call createMany when content has no variables', async () => {
      const prompt = { id: 'p-1' };
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
      );
      mockPrisma.prompt.create.mockResolvedValue(prompt);
      mockPrisma.promptVersion.create.mockResolvedValue({});

      await service.create('ws-1', { name: 'Test', content: 'No vars' }, 'user-1');

      expect(mockPrisma.promptVariable.createMany).not.toHaveBeenCalled();
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    const existingPrompt = {
      id: 'p-1',
      workspaceId: 'ws-1',
      versions: [{ versionNumber: 1, content: 'old content' }],
    };

    beforeEach(() => {
      mockPrisma.prompt.findFirst.mockResolvedValue(existingPrompt);
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
      );
      mockPrisma.prompt.update.mockResolvedValue({ id: 'p-1' });
    });

    it('creates a new version when content changes', async () => {
      mockPrisma.promptVersion.create.mockResolvedValue({});
      mockPrisma.promptVariable.deleteMany.mockResolvedValue({});
      mockPrisma.promptVariable.upsert.mockResolvedValue({});

      await service.update('p-1', 'ws-1', { content: 'new content {{var}}' }, 'user-1');

      expect(mockPrisma.promptVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            versionNumber: 2,
            content: 'new content {{var}}',
          }),
        }),
      );
    });

    it('does not create a new version when only name changes', async () => {
      await service.update('p-1', 'ws-1', { name: 'Renamed' }, 'user-1');

      expect(mockPrisma.promptVersion.create).not.toHaveBeenCalled();
      expect(mockPrisma.prompt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Renamed' }),
        }),
      );
    });

    it('does not create a new version when content is identical', async () => {
      await service.update('p-1', 'ws-1', { content: 'old content' }, 'user-1');

      expect(mockPrisma.promptVersion.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when prompt not found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(null);

      await expect(service.update('bad-id', 'ws-1', { name: 'X' }, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes prompt when found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });

      const txMock = {
        promptVersion: { findMany: jest.fn().mockResolvedValue([{ id: 'v-1' }]) },
        evaluationJob: { deleteMany: jest.fn().mockResolvedValue({}) },
        deployment: { deleteMany: jest.fn().mockResolvedValue({}) },
        prompt: { delete: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation((cb: (tx: typeof txMock) => Promise<void>) =>
        cb(txMock),
      );

      await service.delete('p-1', 'ws-1');

      expect(txMock.evaluationJob.deleteMany).toHaveBeenCalledWith({
        where: { promptVersionId: { in: ['v-1'] } },
      });
      expect(txMock.deployment.deleteMany).toHaveBeenCalledWith({
        where: { promptVersionId: { in: ['v-1'] } },
      });
      expect(txMock.prompt.delete).toHaveBeenCalledWith({ where: { id: 'p-1' } });
    });

    it('throws NotFoundException when prompt not found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(null);

      await expect(service.delete('bad-id', 'ws-1')).rejects.toThrow(NotFoundException);
    });

    it('skips deleteMany calls when prompt has no versions', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });
      const txMock = {
        promptVersion: { findMany: jest.fn().mockResolvedValue([]) },
        evaluationJob: { deleteMany: jest.fn() },
        deployment: { deleteMany: jest.fn() },
        prompt: { delete: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation((cb: (tx: typeof txMock) => Promise<void>) =>
        cb(txMock),
      );
      await service.delete('p-1', 'ws-1');
      expect(txMock.evaluationJob.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ─── getVersions ────────────────────────────────────────────────────────────

  describe('getVersions', () => {
    it('returns versions for a valid prompt', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrisma.promptVersion.findMany.mockResolvedValue([{ versionNumber: 1 }]);
      const result = await service.getVersions('p-1', 'ws-1');
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException when prompt not found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(null);
      await expect(service.getVersions('bad', 'ws-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getVersion ─────────────────────────────────────────────────────────────

  describe('getVersion', () => {
    it('returns a specific version', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrisma.promptVersion.findUnique.mockResolvedValue({ versionNumber: 2, content: 'v2' });
      const result = await service.getVersion('p-1', 2, 'ws-1');
      expect(result.versionNumber).toBe(2);
    });

    it('throws NotFoundException when version not found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrisma.promptVersion.findUnique.mockResolvedValue(null);
      await expect(service.getVersion('p-1', 99, 'ws-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when prompt not found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(null);
      await expect(service.getVersion('bad', 1, 'ws-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getDatasetConfig ───────────────────────────────────────────────────────

  describe('getDatasetConfig', () => {
    it('returns dataset config for a prompt', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrisma.promptDatasetConfig.findFirst.mockResolvedValue({ id: 'cfg-1' });
      const result = await service.getDatasetConfig('p-1', 'ws-1');
      expect(result).toEqual({ id: 'cfg-1' });
    });

    it('throws NotFoundException when prompt not found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(null);
      await expect(service.getDatasetConfig('bad', 'ws-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── saveDatasetConfig ──────────────────────────────────────────────────────

  describe('saveDatasetConfig', () => {
    const configData = {
      datasetId: 'ds-1',
      datasetVersionId: 'dv-1',
      variableMapping: { input: 'col_a' },
    };

    it('creates a new config when none exists', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrisma.promptDatasetConfig.findFirst.mockResolvedValue(null);
      mockPrisma.promptDatasetConfig.create.mockResolvedValue({ id: 'cfg-new' });

      const result = await service.saveDatasetConfig('p-1', 'ws-1', configData);
      expect(mockPrisma.promptDatasetConfig.create).toHaveBeenCalled();
      expect(result).toEqual({ id: 'cfg-new' });
    });

    it('updates existing config', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrisma.promptDatasetConfig.findFirst.mockResolvedValue({ id: 'cfg-1', promptId: 'p-1' });
      mockPrisma.promptDatasetConfig.update.mockResolvedValue({ id: 'cfg-1' });

      const result = await service.saveDatasetConfig('p-1', 'ws-1', configData);
      expect(mockPrisma.promptDatasetConfig.update).toHaveBeenCalled();
      expect(result).toEqual({ id: 'cfg-1' });
    });

    it('resolves latest version when versionId not provided', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrisma.promptDatasetConfig.findFirst.mockResolvedValue(null);
      mockPrisma.datasetVersion.findFirst.mockResolvedValue({ id: 'dv-latest' });
      mockPrisma.promptDatasetConfig.create.mockResolvedValue({ id: 'cfg-new' });

      await service.saveDatasetConfig('p-1', 'ws-1', {
        datasetId: 'ds-1',
        variableMapping: {},
      });
      expect(mockPrisma.datasetVersion.findFirst).toHaveBeenCalled();
    });

    it('throws NotFoundException when no dataset version found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrisma.promptDatasetConfig.findFirst.mockResolvedValue(null);
      mockPrisma.datasetVersion.findFirst.mockResolvedValue(null);

      await expect(
        service.saveDatasetConfig('p-1', 'ws-1', { datasetId: 'ds-1', variableMapping: {} }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── compareVersions ────────────────────────────────────────────────────────

  describe('compareVersions', () => {
    it('returns hunks for changed content', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrisma.promptVersion.findUnique
        .mockResolvedValueOnce({ versionNumber: 1, content: 'Hello world\nLine two' })
        .mockResolvedValueOnce({ versionNumber: 2, content: 'Hello world\nLine changed' });

      const result = await service.compareVersions('p-1', 'ws-1', 1, 2);
      expect(result.versionA).toBe(1);
      expect(result.versionB).toBe(2);
      expect(result.hunks.some((h) => h.type === 'removed')).toBe(true);
      expect(result.hunks.some((h) => h.type === 'added')).toBe(true);
    });

    it('returns only unchanged hunks for identical content', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrisma.promptVersion.findUnique
        .mockResolvedValueOnce({ versionNumber: 1, content: 'Same\nContent' })
        .mockResolvedValueOnce({ versionNumber: 2, content: 'Same\nContent' });

      const result = await service.compareVersions('p-1', 'ws-1', 1, 2);
      expect(result.hunks.every((h) => h.type === 'unchanged')).toBe(true);
    });

    it('throws NotFoundException when version A not found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrisma.promptVersion.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ versionNumber: 2, content: 'content' });
      await expect(service.compareVersions('p-1', 'ws-1', 1, 2)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when version B not found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrisma.promptVersion.findUnique
        .mockResolvedValueOnce({ versionNumber: 1, content: 'content' })
        .mockResolvedValueOnce(null);
      await expect(service.compareVersions('p-1', 'ws-1', 1, 2)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── regressionTest ─────────────────────────────────────────────────────────

  describe('regressionTest', () => {
    const makeJob = (results: { metricName: string; score: number }[]) => ({
      id: 'job-1',
      results,
    });

    it('returns improved/degraded/unchanged metrics', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({
        id: 'p-1',
        versions: [{ versionNumber: 3 }],
      });
      mockPrisma.evaluationJob.findFirst
        .mockResolvedValueOnce(makeJob([{ metricName: 'f1', score: 0.9 }]))
        .mockResolvedValueOnce(makeJob([{ metricName: 'f1', score: 0.7 }]));

      const result = await service.regressionTest('p-1', 'ws-1', 2);
      expect(result.improved).toContain('f1');
      expect(result.scoreDelta['f1']).toBeCloseTo(0.2);
    });

    it('throws NotFoundException when only one version exists', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({
        id: 'p-1',
        versions: [{ versionNumber: 1 }],
      });
      await expect(service.regressionTest('p-1', 'ws-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when no completed evaluation for latest', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({
        id: 'p-1',
        versions: [{ versionNumber: 2 }],
      });
      mockPrisma.evaluationJob.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeJob([]));
      await expect(service.regressionTest('p-1', 'ws-1')).rejects.toThrow(NotFoundException);
    });
  });
});
