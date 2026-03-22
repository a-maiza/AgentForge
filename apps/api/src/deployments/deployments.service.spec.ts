import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DeploymentsService } from './deployments.service';
import { PrismaService } from '../prisma/prisma.service';

const USER_ID = 'user-1';
const PROMPT_ID = 'prompt-1';
const VERSION_ID = 'version-1';

const mockPrisma = {
  prompt: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  promptVersion: { findFirst: jest.fn() },
  deployment: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('DeploymentsService', () => {
  let service: DeploymentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DeploymentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(DeploymentsService);
    jest.clearAllMocks();
  });

  describe('nextVersionLabel (via deploy)', () => {
    it('returns 1.0.0.1 for first deployment', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.promptVersion.findFirst.mockResolvedValue({ id: VERSION_ID });
      mockPrisma.deployment.findFirst.mockResolvedValue(null); // no previous deployments
      mockPrisma.deployment.create.mockResolvedValue({ id: 'dep-1', versionLabel: '1.0.0.1' });

      const result = await service.deploy(
        PROMPT_ID,
        { environment: 'dev', promptVersionId: VERSION_ID, providerId: 'prov-1' },
        USER_ID,
      );

      expect(mockPrisma.deployment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionLabel: '1.0.0.1' }) }),
      );
      expect(result.versionLabel).toBe('1.0.0.1');
    });

    it('increments BUILD component on each deploy', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.promptVersion.findFirst.mockResolvedValue({ id: VERSION_ID });
      // Simulate existing deployment with label 1.0.0.5
      mockPrisma.deployment.findFirst.mockResolvedValue({ versionLabel: '1.0.0.5' });
      mockPrisma.deployment.create.mockResolvedValue({ id: 'dep-2', versionLabel: '1.0.0.6' });

      await service.deploy(
        PROMPT_ID,
        { environment: 'dev', promptVersionId: VERSION_ID, providerId: 'prov-1' },
        USER_ID,
      );

      expect(mockPrisma.deployment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionLabel: '1.0.0.6' }) }),
      );
    });
  });

  describe('deploy', () => {
    it('throws NotFoundException when prompt not found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(null);

      await expect(
        service.deploy(PROMPT_ID, { environment: 'dev', promptVersionId: VERSION_ID, providerId: 'p1' }, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when version does not belong to prompt', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.promptVersion.findFirst.mockResolvedValue(null);

      await expect(
        service.deploy(PROMPT_ID, { environment: 'dev', promptVersionId: 'wrong-version', providerId: 'p1' }, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns record with null for environments with no deployment', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.deployment.findMany.mockResolvedValue([
        { id: 'd1', environment: 'dev', deployedAt: new Date() },
      ]);

      const result = await service.findAll(PROMPT_ID, USER_ID);

      expect(result['dev']).toBeDefined();
      expect(result['staging']).toBeNull();
      expect(result['prod']).toBeNull();
    });
  });
});
