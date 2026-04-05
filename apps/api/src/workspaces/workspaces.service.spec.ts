import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { PrismaService } from '../prisma/prisma.service';

const WS_ID = 'ws-1';
const ORG_ID = 'org-1';
const USER_ID = 'user-1';

const mockWorkspace = {
  id: WS_ID,
  orgId: ORG_ID,
  name: 'My Workspace',
  slug: 'my-ws',
  createdAt: new Date(),
};

const mockUser = { id: USER_ID, clerkId: 'clerk-1', email: 'a@b.com', name: 'Alice', avatarUrl: null, createdAt: new Date() };
const ownerMember = { id: 'm1', workspaceId: WS_ID, userId: USER_ID, role: 'owner' };
const viewerMember = { id: 'm2', workspaceId: WS_ID, userId: 'viewer', role: 'viewer' };

const mockPrisma = {
  workspace: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  workspaceMember: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  deployment: {
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};
mockPrisma.$transaction.mockImplementation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fn: (tx: any) => Promise<unknown>) => fn(mockPrisma),
);

describe('WorkspacesService', () => {
  let service: WorkspacesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkspacesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<WorkspacesService>(WorkspacesService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fn: (tx: any) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  describe('findAllForUser', () => {
    it('returns workspace memberships', async () => {
      mockPrisma.workspaceMember.findMany = jest
        .fn()
        .mockResolvedValue([{ ...ownerMember, workspace: mockWorkspace }]);
      // Inject via PrismaService directly
      const prisma = { workspaceMember: { findMany: jest.fn().mockResolvedValue([{ ...ownerMember, workspace: mockWorkspace }]) } };
      // Use the actual service method via the mock
      mockPrisma.workspaceMember.findMany.mockResolvedValue([{ ...ownerMember, workspace: mockWorkspace }]);
      const result = await service.findAllForUser(USER_ID);
      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('returns workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      const result = await service.findById(WS_ID);
      expect(result?.id).toBe(WS_ID);
    });

    it('returns null for unknown workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      expect(await service.findById('bad')).toBeNull();
    });
  });

  describe('create', () => {
    it('creates workspace and adds creator as owner', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.create.mockResolvedValue(mockWorkspace);
      mockPrisma.workspaceMember.create.mockResolvedValue(ownerMember);

      const result = await service.create(ORG_ID, { name: 'My Workspace', slug: 'my-ws' }, mockUser);
      expect(result.id).toBe(WS_ID);
      expect(mockPrisma.workspaceMember.create).toHaveBeenCalled();
    });

    it('throws ConflictException if slug exists in org', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      await expect(
        service.create(ORG_ID, { name: 'X', slug: 'my-ws' }, mockUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates workspace for a member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(ownerMember);
      mockPrisma.workspace.update.mockResolvedValue({ ...mockWorkspace, name: 'Updated' });
      const result = await service.update(WS_ID, { name: 'Updated' }, USER_ID);
      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundException for non-member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);
      await expect(service.update(WS_ID, { name: 'X' }, 'outsider')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes workspace for owner', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(ownerMember);
      mockPrisma.workspace.delete.mockResolvedValue(mockWorkspace);
      await expect(service.delete(WS_ID, USER_ID)).resolves.toBeUndefined();
    });

    it('throws ForbiddenException for viewer role', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(viewerMember);
      await expect(service.delete(WS_ID, 'viewer')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMembership', () => {
    it('returns membership when found', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(ownerMember);
      const result = await service.getMembership(WS_ID, USER_ID);
      expect(result?.role).toBe('owner');
    });

    it('returns null when not a member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);
      expect(await service.getMembership(WS_ID, 'outsider')).toBeNull();
    });
  });

  describe('getMembers', () => {
    it('returns members with user info', async () => {
      mockPrisma.workspaceMember.findMany.mockResolvedValue([{ ...ownerMember, user: mockUser }]);
      const result = await service.getMembers(WS_ID);
      expect(result[0]?.user.id).toBe(USER_ID);
    });
  });

  describe('activeDeploymentCount', () => {
    it('returns count of live deployments', async () => {
      mockPrisma.deployment.count.mockResolvedValue(3);
      const count = await service.activeDeploymentCount(WS_ID);
      expect(count).toBe(3);
    });
  });
});
