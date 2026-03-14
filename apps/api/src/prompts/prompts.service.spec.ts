import { Test, TestingModule } from '@nestjs/testing';
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
  $transaction: jest.fn(),
};

describe('PromptsService', () => {
  let service: PromptsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
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
          data: expect.arrayContaining([
            { promptId: 'p-1', name: 'user', type: 'string' },
          ]),
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

      await expect(
        service.update('bad-id', 'ws-1', { name: 'X' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes prompt when found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrisma.prompt.delete.mockResolvedValue({});

      await service.delete('p-1', 'ws-1');

      expect(mockPrisma.prompt.delete).toHaveBeenCalledWith({ where: { id: 'p-1' } });
    });

    it('throws NotFoundException when prompt not found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(null);

      await expect(service.delete('bad-id', 'ws-1')).rejects.toThrow(NotFoundException);
    });
  });
});
