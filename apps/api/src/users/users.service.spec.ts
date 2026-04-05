import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

const mockUser = {
  id: 'user-1',
  clerkId: 'clerk-1',
  email: 'alice@example.com',
  name: 'Alice Smith',
  avatarUrl: 'https://example.com/avatar.jpg',
  createdAt: new Date(),
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('findByClerkId', () => {
    it('returns user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findByClerkId('clerk-1');
      expect(result?.clerkId).toBe('clerk-1');
    });

    it('returns null when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      expect(await service.findByClerkId('unknown')).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns user by id', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findById('user-1');
      expect(result?.id).toBe('user-1');
    });
  });

  describe('upsertFromClerk', () => {
    const clerkData = {
      id: 'clerk-1',
      email_addresses: [
        { email_address: 'alice@example.com', id: 'email-1' },
      ],
      first_name: 'Alice',
      last_name: 'Smith',
      image_url: 'https://example.com/avatar.jpg',
      primary_email_address_id: 'email-1',
    };

    it('upserts user from Clerk data', async () => {
      mockPrisma.user.upsert.mockResolvedValue(mockUser);
      const result = await service.upsertFromClerk(clerkData);
      expect(result.name).toBe('Alice Smith');
      expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clerkId: 'clerk-1' },
          create: expect.objectContaining({ email: 'alice@example.com', name: 'Alice Smith' }),
        }),
      );
    });

    it('uses email as name when names are null', async () => {
      mockPrisma.user.upsert.mockResolvedValue({ ...mockUser, name: 'alice@example.com' });
      const result = await service.upsertFromClerk({
        ...clerkData,
        first_name: null,
        last_name: null,
      });
      expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ name: 'alice@example.com' }),
        }),
      );
      expect(result.name).toBe('alice@example.com');
    });

    it('falls back to first email when primary not found', async () => {
      mockPrisma.user.upsert.mockResolvedValue(mockUser);
      await service.upsertFromClerk({
        ...clerkData,
        primary_email_address_id: 'nonexistent',
        email_addresses: [{ email_address: 'first@example.com', id: 'email-1' }],
      });
      expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ email: 'first@example.com' }),
        }),
      );
    });
  });

  describe('deleteByClerkId', () => {
    it('deletes user', async () => {
      mockPrisma.user.delete.mockResolvedValue(mockUser);
      const result = await service.deleteByClerkId('clerk-1');
      expect(result.clerkId).toBe('clerk-1');
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { clerkId: 'clerk-1' } });
    });
  });
});
