import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

const mockOrg = { id: ORG_ID, name: 'Test Org', slug: 'test-org', plan: 'free', createdAt: new Date() };
const mockUser = { id: USER_ID, clerkId: 'clerk-1', email: 'a@b.com', name: 'Alice', avatarUrl: null, createdAt: new Date() };
const ownerMember = { id: 'm1', orgId: ORG_ID, userId: USER_ID, role: 'owner', joinedAt: new Date() };
const adminMember = { id: 'm2', orgId: ORG_ID, userId: OTHER_USER_ID, role: 'admin', joinedAt: new Date() };
const viewerMember = { id: 'm3', orgId: ORG_ID, userId: 'viewer', role: 'viewer', joinedAt: new Date() };

const mockPrisma = {
  orgMember: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};
mockPrisma.$transaction.mockImplementation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fn: (tx: any) => Promise<unknown>) => fn(mockPrisma),
);

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizationsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<OrganizationsService>(OrganizationsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fn: (tx: any) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  describe('findAllForUser', () => {
    it('returns org memberships', async () => {
      mockPrisma.orgMember.findMany.mockResolvedValue([{ ...ownerMember, org: mockOrg }]);
      const result = await service.findAllForUser(USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0]?.org.id).toBe(ORG_ID);
    });
  });

  describe('findById', () => {
    it('returns org by id', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      const result = await service.findById(ORG_ID);
      expect(result?.id).toBe(ORG_ID);
    });

    it('returns null for unknown org', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      expect(await service.findById('bad')).toBeNull();
    });
  });

  describe('create', () => {
    it('creates org and sets creator as owner', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      mockPrisma.organization.create.mockResolvedValue(mockOrg);
      mockPrisma.orgMember.create.mockResolvedValue(ownerMember);

      const result = await service.create({ name: 'Test Org', slug: 'test-org' }, mockUser);
      expect(result.id).toBe(ORG_ID);
      expect(mockPrisma.orgMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'owner' }) }),
      );
    });

    it('throws ConflictException if slug taken', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      await expect(
        service.create({ name: 'X', slug: 'test-org' }, mockUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates org when requester is owner', async () => {
      mockPrisma.orgMember.findUnique.mockResolvedValue(ownerMember);
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      mockPrisma.organization.update.mockResolvedValue({ ...mockOrg, name: 'Updated' });

      const result = await service.update(ORG_ID, { name: 'Updated' }, USER_ID);
      expect(result.name).toBe('Updated');
    });

    it('throws ForbiddenException for viewer role', async () => {
      mockPrisma.orgMember.findUnique.mockResolvedValue(viewerMember);
      await expect(service.update(ORG_ID, { name: 'X' }, 'viewer')).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException on slug collision', async () => {
      mockPrisma.orgMember.findUnique.mockResolvedValue(ownerMember);
      mockPrisma.organization.findFirst.mockResolvedValue({ id: 'other-org' });
      await expect(
        service.update(ORG_ID, { slug: 'taken' }, USER_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('deletes org when requester is owner', async () => {
      mockPrisma.orgMember.findUnique.mockResolvedValue(ownerMember);
      mockPrisma.organization.delete.mockResolvedValue(mockOrg);
      await expect(service.delete(ORG_ID, USER_ID)).resolves.toBeUndefined();
    });

    it('throws ForbiddenException for admin role', async () => {
      mockPrisma.orgMember.findUnique.mockResolvedValue(adminMember);
      await expect(service.delete(ORG_ID, OTHER_USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMembers', () => {
    it('returns members with user', async () => {
      mockPrisma.orgMember.findMany.mockResolvedValue([{ ...ownerMember, user: mockUser }]);
      const result = await service.getMembers(ORG_ID);
      expect(result[0]?.user.id).toBe(USER_ID);
    });
  });

  describe('addMember', () => {
    it('adds a new member', async () => {
      mockPrisma.orgMember.findUnique
        .mockResolvedValueOnce(ownerMember) // assertRole check
        .mockResolvedValueOnce(null); // existing member check
      mockPrisma.orgMember.create.mockResolvedValue({ ...adminMember, userId: 'new-user' });

      const result = await service.addMember(ORG_ID, 'new-user', 'admin', USER_ID);
      expect(result.role).toBe('admin');
    });

    it('throws ConflictException if already a member', async () => {
      mockPrisma.orgMember.findUnique
        .mockResolvedValueOnce(ownerMember) // assertRole
        .mockResolvedValueOnce(adminMember); // already exists
      await expect(
        service.addMember(ORG_ID, OTHER_USER_ID, 'admin', USER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if requester not in org', async () => {
      mockPrisma.orgMember.findUnique.mockResolvedValue(null);
      await expect(
        service.addMember(ORG_ID, 'new', 'admin', 'outsider'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeMember', () => {
    it('removes a member', async () => {
      mockPrisma.orgMember.findUnique.mockResolvedValue(ownerMember);
      mockPrisma.orgMember.delete.mockResolvedValue(adminMember);
      await expect(service.removeMember(ORG_ID, OTHER_USER_ID, USER_ID)).resolves.toBeUndefined();
    });
  });

  describe('getMembership', () => {
    it('returns membership', async () => {
      mockPrisma.orgMember.findUnique.mockResolvedValue(ownerMember);
      const result = await service.getMembership(ORG_ID, USER_ID);
      expect(result?.role).toBe('owner');
    });
  });
});
