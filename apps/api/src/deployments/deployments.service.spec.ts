import { NotFoundException, BadRequestException } from '@nestjs/common';
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
      providers: [DeploymentsService, { provide: PrismaService, useValue: mockPrisma }],
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
        service.deploy(
          PROMPT_ID,
          { environment: 'dev', promptVersionId: VERSION_ID, providerId: 'p1' },
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when version does not belong to prompt', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.promptVersion.findFirst.mockResolvedValue(null);

      await expect(
        service.deploy(
          PROMPT_ID,
          { environment: 'dev', promptVersionId: 'wrong-version', providerId: 'p1' },
          USER_ID,
        ),
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

  describe('promote', () => {
    it('promotes dev to staging', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.deployment.findFirst.mockResolvedValue({
        promptVersionId: VERSION_ID,
        versionLabel: '1.0.0.2',
        notes: null,
      });
      mockPrisma.deployment.updateMany.mockResolvedValue({});
      mockPrisma.deployment.create.mockResolvedValue({ id: 'd-2', environment: 'staging', versionLabel: '1.0.0.2' });

      const result = await service.promote(PROMPT_ID, { targetEnvironment: 'staging' }, USER_ID);
      expect(result.environment).toBe('staging');
    });

    it('throws BadRequestException when promoting to dev', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      await expect(
        service.promote(PROMPT_ID, { targetEnvironment: 'dev' }, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when no active deployment in source env', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.deployment.findFirst.mockResolvedValue(null);
      await expect(
        service.promote(PROMPT_ID, { targetEnvironment: 'staging' }, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rollback', () => {
    it('marks active deployment as rolled_back', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.deployment.findFirst.mockResolvedValue({ id: 'd-1' });
      mockPrisma.deployment.update.mockResolvedValue({ id: 'd-1', status: 'rolled_back', isLive: false, rolledBackAt: new Date() });

      const result = await service.rollback(PROMPT_ID, 'dev', USER_ID);
      expect(result.status).toBe('rolled_back');
    });

    it('throws NotFoundException when no active deployment to roll back', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.deployment.findFirst.mockResolvedValue(null);
      await expect(service.rollback(PROMPT_ID, 'dev', USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('goLive', () => {
    it('sets isLive true via transaction', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.deployment.findFirst.mockResolvedValue({ id: 'd-1', promptId: PROMPT_ID });
      mockPrisma.$transaction.mockResolvedValue([{ id: 'd-1', isLive: true, endpointHash: 'abc' }]);

      const result = await service.goLive(PROMPT_ID, 'dev', USER_ID);
      expect(result.isLive).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws NotFoundException when no active deployment', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.deployment.findFirst.mockResolvedValue(null);
      await expect(service.goLive(PROMPT_ID, 'dev', USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findHistory', () => {
    it('returns all deployments for the prompt', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue({ id: PROMPT_ID });
      mockPrisma.deployment.findMany.mockResolvedValue([
        { id: 'd-1', environment: 'dev', status: 'active' },
        { id: 'd-2', environment: 'dev', status: 'rolled_back' },
      ]);
      const result = await service.findHistory(PROMPT_ID, USER_ID);
      expect(result).toHaveLength(2);
    });

    it('throws NotFoundException when prompt not found', async () => {
      mockPrisma.prompt.findFirst.mockResolvedValue(null);
      await expect(service.findHistory('bad', USER_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
