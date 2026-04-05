import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AiProvidersService } from './ai-providers.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';

const WS_ID = 'ws-1';
const PROV_ID = 'prov-1';

const mockProvider = {
  id: PROV_ID,
  workspaceId: WS_ID,
  name: 'OpenAI',
  providerType: 'openai',
  apiKeyEncrypted: 'encrypted-key',
  baseUrl: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Safe version (no apiKeyEncrypted)
const { apiKeyEncrypted: _dropped, ...safeProvider } = mockProvider;

const mockPrisma = {
  aiProvider: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockEncryption = {
  encrypt: jest.fn().mockReturnValue('encrypted-key'),
  decrypt: jest.fn().mockReturnValue('plaintext-api-key'),
};

// Inject a fake Redis client directly onto the service after instantiation
const mockRedis = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
};

// Block real ioredis from connecting — service imports { Redis } as named export
jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  })),
}));

describe('AiProvidersService', () => {
  let service: AiProvidersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProvidersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EncryptionService, useValue: mockEncryption },
      ],
    }).compile();
    service = module.get<AiProvidersService>(AiProvidersService);

    // Overwrite the private redis field with our controllable mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).redis = mockRedis;

    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockEncryption.encrypt.mockReturnValue('encrypted-key');
    mockEncryption.decrypt.mockReturnValue('plaintext-api-key');
  });

  describe('findAll', () => {
    it('returns providers from database and caches them', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.aiProvider.findMany.mockResolvedValue([mockProvider]);

      const result = await service.findAll(WS_ID);
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('apiKeyEncrypted');
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('returns cached providers without hitting DB', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([safeProvider]));
      const result = await service.findAll(WS_ID);
      expect(result[0]?.id).toBe(PROV_ID);
      expect(mockPrisma.aiProvider.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns sanitized provider', async () => {
      mockPrisma.aiProvider.findFirst.mockResolvedValue(mockProvider);
      const result = await service.findOne(PROV_ID, WS_ID);
      expect(result.id).toBe(PROV_ID);
      expect(result).not.toHaveProperty('apiKeyEncrypted');
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.aiProvider.findFirst.mockResolvedValue(null);
      await expect(service.findOne('bad', WS_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('encrypts the API key and invalidates cache', async () => {
      mockPrisma.aiProvider.create.mockResolvedValue(mockProvider);
      const result = await service.create(WS_ID, {
        name: 'OpenAI',
        providerType: 'openai',
        apiKey: 'sk-secret',
      });
      expect(mockEncryption.encrypt).toHaveBeenCalledWith('sk-secret');
      expect(result).not.toHaveProperty('apiKeyEncrypted');
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates and invalidates cache', async () => {
      mockPrisma.aiProvider.findFirst.mockResolvedValue({ id: PROV_ID });
      mockPrisma.aiProvider.update.mockResolvedValue({ ...mockProvider, name: 'Updated' });

      const result = await service.update(PROV_ID, WS_ID, { name: 'Updated' });
      expect(result.name).toBe('Updated');
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('re-encrypts key when provided in update', async () => {
      mockPrisma.aiProvider.findFirst.mockResolvedValue({ id: PROV_ID });
      mockPrisma.aiProvider.update.mockResolvedValue(mockProvider);
      await service.update(PROV_ID, WS_ID, { apiKey: 'new-secret' });
      expect(mockEncryption.encrypt).toHaveBeenCalledWith('new-secret');
    });

    it('throws NotFoundException for unknown provider', async () => {
      mockPrisma.aiProvider.findFirst.mockResolvedValue(null);
      await expect(service.update('bad', WS_ID, { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes and invalidates cache', async () => {
      mockPrisma.aiProvider.findFirst.mockResolvedValue({ id: PROV_ID });
      mockPrisma.aiProvider.delete.mockResolvedValue(mockProvider);
      await expect(service.delete(PROV_ID, WS_ID)).resolves.toBeUndefined();
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.aiProvider.findFirst.mockResolvedValue(null);
      await expect(service.delete('bad', WS_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDecryptedKey', () => {
    it('returns decrypted API key', async () => {
      mockPrisma.aiProvider.findFirst.mockResolvedValue({
        id: PROV_ID,
        apiKeyEncrypted: 'encrypted-key',
      });
      const key = await service.getDecryptedKey(PROV_ID, WS_ID);
      expect(key).toBe('plaintext-api-key');
      expect(mockEncryption.decrypt).toHaveBeenCalledWith('encrypted-key');
    });

    it('throws NotFoundException when provider not found', async () => {
      mockPrisma.aiProvider.findFirst.mockResolvedValue(null);
      await expect(service.getDecryptedKey('bad', WS_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
