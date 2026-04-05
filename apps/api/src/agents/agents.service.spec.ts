import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  agent: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  agentVersion: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};
mockPrisma.$transaction.mockImplementation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fn: (tx: any) => Promise<unknown>) => fn(mockPrisma),
);

const WS_ID = 'ws-1';
const AGENT_ID = 'agent-1';
const USER_ID = 'user-1';

const mockAgent = {
  id: AGENT_ID,
  workspaceId: WS_ID,
  name: 'Test Agent',
  description: null,
  status: 'draft',
  currentVersion: null,
  createdBy: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockVersion = {
  id: 'v1',
  agentId: AGENT_ID,
  versionNumber: 1,
  workflowDefinition: { nodes: [], edges: [] },
  createdBy: USER_ID,
  createdAt: new Date(),
};

describe('AgentsService', () => {
  let service: AgentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<AgentsService>(AgentsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fn: (tx: any) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns items and no cursor when under page limit', async () => {
      mockPrisma.agent.findMany.mockResolvedValue([mockAgent]);
      const result = await service.findAll(WS_ID);
      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('returns nextCursor when results exceed take', async () => {
      const agents = Array.from({ length: 26 }, (_, i) => ({ ...mockAgent, id: `agent-${i}` }));
      mockPrisma.agent.findMany.mockResolvedValue(agents);
      const result = await service.findAll(WS_ID, 25);
      expect(result.items).toHaveLength(25);
      expect(result.nextCursor).toBe('agent-25');
    });

    it('uses cursor when provided', async () => {
      mockPrisma.agent.findMany.mockResolvedValue([mockAgent]);
      await service.findAll(WS_ID, 25, 'cursor-id');
      expect(mockPrisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { id: 'cursor-id' }, skip: 1 }),
      );
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns agent with versions', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue({ ...mockAgent, versions: [mockVersion] });
      const result = await service.findOne(AGENT_ID, WS_ID);
      expect(result.id).toBe(AGENT_ID);
      expect(result.versions).toHaveLength(1);
    });

    it('throws NotFoundException for unknown agent', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(null);
      await expect(service.findOne('bad-id', WS_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates an agent', async () => {
      mockPrisma.agent.create.mockResolvedValue(mockAgent);
      const result = await service.create(WS_ID, { name: 'Test Agent' }, USER_ID);
      expect(result.id).toBe(AGENT_ID);
      expect(mockPrisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Test Agent', status: 'draft' }) }),
      );
    });

    it('includes description when provided', async () => {
      mockPrisma.agent.create.mockResolvedValue({ ...mockAgent, description: 'Desc' });
      await service.create(WS_ID, { name: 'A', description: 'Desc' }, USER_ID);
      expect(mockPrisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ description: 'Desc' }) }),
      );
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates the agent', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue({ id: AGENT_ID });
      mockPrisma.agent.update.mockResolvedValue({ ...mockAgent, name: 'Updated' });
      const result = await service.update(AGENT_ID, WS_ID, { name: 'Updated' }, USER_ID);
      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundException for unknown agent', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(null);
      await expect(service.update('bad', WS_ID, { name: 'X' }, USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes the agent', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue({ id: AGENT_ID });
      mockPrisma.agent.delete.mockResolvedValue(mockAgent);
      await expect(service.delete(AGENT_ID, WS_ID)).resolves.toBeUndefined();
    });

    it('throws NotFoundException for unknown agent', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(null);
      await expect(service.delete('bad', WS_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getVersions ─────────────────────────────────────────────────────────────

  describe('getVersions', () => {
    it('returns versions list', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue({ id: AGENT_ID });
      mockPrisma.agentVersion.findMany.mockResolvedValue([mockVersion]);
      const result = await service.getVersions(AGENT_ID, WS_ID);
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException for unknown agent', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(null);
      await expect(service.getVersions('bad', WS_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── saveWorkflow ─────────────────────────────────────────────────────────────

  describe('saveWorkflow', () => {
    it('creates a new version and updates agent', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue({ id: AGENT_ID });
      mockPrisma.agentVersion.findFirst.mockResolvedValue(null);
      mockPrisma.agentVersion.create.mockResolvedValue(mockVersion);
      mockPrisma.agent.update.mockResolvedValue(mockAgent);

      const result = await service.saveWorkflow(
        AGENT_ID,
        WS_ID,
        { nodes: [], edges: [] },
        USER_ID,
      );
      expect(result.versionNumber).toBe(1);
      expect(mockPrisma.agentVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionNumber: 1 }) }),
      );
      expect(mockPrisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currentVersion: 'v1.0.0' }) }),
      );
    });

    it('increments version from last saved', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue({ id: AGENT_ID });
      mockPrisma.agentVersion.findFirst.mockResolvedValue({ versionNumber: 3 });
      mockPrisma.agentVersion.create.mockResolvedValue({ ...mockVersion, versionNumber: 4 });
      mockPrisma.agent.update.mockResolvedValue(mockAgent);

      const result = await service.saveWorkflow(AGENT_ID, WS_ID, { nodes: [], edges: [] }, USER_ID);
      expect(result.versionNumber).toBe(4);
    });

    it('throws NotFoundException for unknown agent', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(null);
      await expect(
        service.saveWorkflow('bad', WS_ID, {}, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── testRun ─────────────────────────────────────────────────────────────────

  describe('testRun', () => {
    it('returns empty trace when no versions', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue({ ...mockAgent, versions: [] });
      const result = await service.testRun(AGENT_ID, WS_ID, {});
      expect(result.trace).toHaveLength(0);
      expect(result.output).toBeNull();
    });

    it('throws NotFoundException for unknown agent', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(null);
      await expect(service.testRun('bad', WS_ID, {})).rejects.toThrow(NotFoundException);
    });

    it('executes a simple linear workflow', async () => {
      const workflow = {
        nodes: [
          { id: 'start', type: 'start', data: {} },
          { id: 'out', type: 'output', data: { outputKey: 'result' } },
        ],
        edges: [{ source: 'start', target: 'out' }],
      };
      mockPrisma.agent.findFirst.mockResolvedValue({
        ...mockAgent,
        versions: [{ ...mockVersion, workflowDefinition: workflow }],
      });

      const result = await service.testRun(AGENT_ID, WS_ID, { result: 'hello' });
      expect(result.trace).toHaveLength(2);
      expect(result.output).toBe('hello');
    });

    it('handles condition node', async () => {
      const workflow = {
        nodes: [{ id: 'cond', type: 'condition', data: {} }],
        edges: [],
      };
      mockPrisma.agent.findFirst.mockResolvedValue({
        ...mockAgent,
        versions: [{ ...mockVersion, workflowDefinition: workflow }],
      });

      const result = await service.testRun(AGENT_ID, WS_ID, {});
      const condStep = result.trace.find((s: unknown) => (s as { type: string }).type === 'condition');
      expect(condStep).toBeDefined();
    });
  });
});
