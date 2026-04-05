import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiKeysService } from './api-keys.service';
import { PrismaService } from '../prisma/prisma.service';

const WORKSPACE_ID = 'ws-1';
const USER_ID = 'user-1';

const mockPrisma = {
  apiKey: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('ApiKeysService', () => {
  let service: ApiKeysService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ApiKeysService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(ApiKeysService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('returns full key with correct workspace prefix', async () => {
      const fakeKey = {
        id: 'key-1',
        workspaceId: WORKSPACE_ID,
        name: 'Test Key',
        prefix: 'sk_ws_',
        keyHash: 'hash',
        type: 'workspace',
        status: 'active',
        expiresAt: null,
        lastUsedAt: null,
        createdBy: USER_ID,
        createdAt: new Date(),
      };
      mockPrisma.apiKey.create.mockResolvedValue(fakeKey);

      const result = await service.create(
        WORKSPACE_ID,
        { name: 'Test Key', scope: 'workspace' },
        USER_ID,
      );

      expect(result.key).toMatch(/^sk_ws_/);
      expect(result).not.toHaveProperty('keyHash');
    });

    it('returns org-prefixed key for organization scope', async () => {
      const fakeKey = {
        id: 'key-2',
        workspaceId: WORKSPACE_ID,
        name: 'Org Key',
        prefix: 'sk_org_',
        keyHash: 'hash',
        type: 'org',
        status: 'active',
        expiresAt: null,
        lastUsedAt: null,
        createdBy: USER_ID,
        createdAt: new Date(),
      };
      mockPrisma.apiKey.create.mockResolvedValue(fakeKey);

      const result = await service.create(
        WORKSPACE_ID,
        { name: 'Org Key', scope: 'organization' },
        USER_ID,
      );

      expect(result.key).toMatch(/^sk_org_/);
    });

    it('returns readonly-prefixed key for readonly scope', async () => {
      const fakeKey = {
        id: 'key-3',
        workspaceId: WORKSPACE_ID,
        name: 'RO Key',
        prefix: 'sk_ro_',
        keyHash: 'hash',
        type: 'readonly',
        status: 'active',
        expiresAt: null,
        lastUsedAt: null,
        createdBy: USER_ID,
        createdAt: new Date(),
      };
      mockPrisma.apiKey.create.mockResolvedValue(fakeKey);

      const result = await service.create(
        WORKSPACE_ID,
        { name: 'RO Key', scope: 'readonly' },
        USER_ID,
      );

      expect(result.key).toMatch(/^sk_ro_/);
    });
  });

  describe('findAll', () => {
    it('omits keyHash from response', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([
        { id: 'k1', keyHash: 'secret', prefix: 'sk_ws_', workspaceId: WORKSPACE_ID },
      ]);

      const results = await service.findAll(WORKSPACE_ID);

      expect(results[0]).not.toHaveProperty('keyHash');
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when key not found in workspace', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);

      await expect(service.findOne('missing-id', WORKSPACE_ID)).rejects.toThrow(NotFoundException);
    });

    it('omits keyHash from response', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue({
        id: 'k1',
        keyHash: 'secret',
        prefix: 'sk_ws_',
        workspaceId: WORKSPACE_ID,
      });

      const result = await service.findOne('k1', WORKSPACE_ID);

      expect(result).not.toHaveProperty('keyHash');
    });
  });

  describe('disable', () => {
    it('sets status to disabled', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue({ id: 'k1' });
      mockPrisma.apiKey.update.mockResolvedValue({
        id: 'k1',
        keyHash: 'h',
        status: 'disabled',
        workspaceId: WORKSPACE_ID,
      });

      const result = await service.disable('k1', WORKSPACE_ID);
      expect(result.status).toBe('disabled');
      expect(result).not.toHaveProperty('keyHash');
    });

    it('throws NotFoundException when key not found', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);
      await expect(service.disable('bad', WORKSPACE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the key', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue({ id: 'k1' });
      mockPrisma.apiKey.delete.mockResolvedValue({});
      await expect(service.remove('k1', WORKSPACE_ID)).resolves.toBeUndefined();
      expect(mockPrisma.apiKey.delete).toHaveBeenCalledWith({ where: { id: 'k1' } });
    });

    it('throws NotFoundException when key not found', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);
      await expect(service.remove('bad', WORKSPACE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('filters by status when provided', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([]);
      await service.findAll(WORKSPACE_ID, 'active');
      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workspaceId: WORKSPACE_ID, status: 'active' }),
        }),
      );
    });
  });
});
