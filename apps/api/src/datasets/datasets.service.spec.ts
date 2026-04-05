import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DatasetsService } from './datasets.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const WORKSPACE_A = 'workspace-a';
const WORKSPACE_B = 'workspace-b';
const DATASET_ID = 'dataset-1';
const USER_ID = 'user-1';

const mockDataset = {
  id: DATASET_ID,
  workspaceId: WORKSPACE_A,
  name: 'Test Dataset',
  description: null,
  status: 'active',
  createdBy: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockVersion = {
  id: 'version-1',
  datasetId: DATASET_ID,
  versionNumber: 1,
  storagePath: 'workspaces/workspace-a/datasets/dataset-1/v1/data.csv',
  rowCount: 3,
  columnCount: 2,
  fileSizeBytes: BigInt(100),
  columns: ['name', 'age'],
  status: 'latest',
  createdAt: new Date(),
};

const mockPrisma = {
  dataset: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  datasetVersion: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  evaluationJob: {
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};
// Assign after declaration to avoid self-referential type inference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<unknown>) => fn(mockPrisma));

const mockStorage = {
  buildKey: jest.fn().mockReturnValue('some/storage/path'),
  upload: jest.fn().mockResolvedValue(undefined),
  getBuffer: jest.fn(),
};

describe('DatasetsService', () => {
  let service: DatasetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatasetsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    service = module.get<DatasetsService>(DatasetsService);
    jest.clearAllMocks();
  });

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns datasets scoped to workspace', async () => {
      mockPrisma.dataset.findMany.mockResolvedValue([
        { ...mockDataset, versions: [mockVersion] },
      ]);
      const result = await service.findAll(WORKSPACE_A);
      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
      expect(mockPrisma.dataset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workspaceId: WORKSPACE_A } }),
      );
    });

    it('returns nextCursor when over page size', async () => {
      const datasets = Array.from({ length: 26 }, (_, i) => ({
        ...mockDataset,
        id: `ds-${i}`,
        versions: [],
      }));
      mockPrisma.dataset.findMany.mockResolvedValue(datasets);
      const result = await service.findAll(WORKSPACE_A, 25);
      expect(result.items).toHaveLength(25);
      expect(result.nextCursor).toBe('ds-25');
    });

    it('serialises fileSizeBytes as string', async () => {
      mockPrisma.dataset.findMany.mockResolvedValue([
        { ...mockDataset, versions: [mockVersion] },
      ]);
      const result = await service.findAll(WORKSPACE_A);
      expect(typeof result.items[0]!.versions[0]!.fileSizeBytes).toBe('string');
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the dataset when workspaceId matches', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue({ ...mockDataset, versions: [] });
      const result = await service.findOne(DATASET_ID, WORKSPACE_A);
      expect(result.id).toBe(DATASET_ID);
      expect(mockPrisma.dataset.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: DATASET_ID, workspaceId: WORKSPACE_A } }),
      );
    });

    it('throws NotFoundException when workspaceId belongs to another user', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue(null);
      await expect(service.findOne(DATASET_ID, WORKSPACE_B)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a dataset', async () => {
      mockPrisma.dataset.create.mockResolvedValue(mockDataset);
      const result = await service.create({ workspaceId: WORKSPACE_A, name: 'Test Dataset' }, USER_ID);
      expect(result.id).toBe(DATASET_ID);
      expect(mockPrisma.dataset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ workspaceId: WORKSPACE_A, name: 'Test Dataset' }),
        }),
      );
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundException when updating a dataset in another workspace', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue(null);
      await expect(
        service.update(DATASET_ID, WORKSPACE_B, { name: 'Hacked' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates successfully when workspaceId matches', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue(mockDataset);
      mockPrisma.dataset.update.mockResolvedValue({ ...mockDataset, name: 'Updated' });
      const result = await service.update(DATASET_ID, WORKSPACE_A, { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('throws NotFoundException when deleting a dataset in another workspace', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue(null);
      await expect(service.delete(DATASET_ID, WORKSPACE_B)).rejects.toThrow(NotFoundException);
    });

    it('deletes dataset and related jobs in transaction', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue({ id: DATASET_ID });
      const txMock = {
        evaluationJob: { deleteMany: jest.fn().mockResolvedValue({}) },
        dataset: { delete: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation((fn: (tx: typeof txMock) => Promise<void>) =>
        fn(txMock),
      );
      await service.delete(DATASET_ID, WORKSPACE_A);
      expect(txMock.evaluationJob.deleteMany).toHaveBeenCalledWith({ where: { datasetId: DATASET_ID } });
      expect(txMock.dataset.delete).toHaveBeenCalledWith({ where: { id: DATASET_ID } });
    });
  });

  // ─── getVersions ─────────────────────────────────────────────────────────────

  describe('getVersions', () => {
    it('throws NotFoundException for cross-workspace version access', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue(null);
      await expect(service.getVersions(DATASET_ID, WORKSPACE_B)).rejects.toThrow(NotFoundException);
    });

    it('returns versions for the correct workspace', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue(mockDataset);
      mockPrisma.datasetVersion.findMany.mockResolvedValue([mockVersion]);
      const result = await service.getVersions(DATASET_ID, WORKSPACE_A);
      expect(result).toHaveLength(1);
      expect(result[0]!.fileSizeBytes).toBe('100');
    });
  });

  // ─── upload ──────────────────────────────────────────────────────────────────

  describe('upload', () => {
    const csvBuffer = Buffer.from('name,age\nAlice,30\nBob,25');

    it('throws NotFoundException when uploading to a dataset in another workspace', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue(mockDataset);
      await expect(
        service.upload(DATASET_ID, WORKSPACE_B, csvBuffer, 'data.csv', 'text/csv'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when dataset does not exist', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue(null);
      await expect(
        service.upload('no-such-id', WORKSPACE_A, csvBuffer, 'data.csv', 'text/csv'),
      ).rejects.toThrow(NotFoundException);
    });

    it('succeeds for the correct workspace', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue(mockDataset);
      mockPrisma.datasetVersion.findFirst.mockResolvedValue(null);
      mockPrisma.datasetVersion.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.datasetVersion.create.mockResolvedValue(mockVersion);

      const result = await service.upload(DATASET_ID, WORKSPACE_A, csvBuffer, 'data.csv', 'text/csv');
      expect(result.dataset.id).toBe(DATASET_ID);
      expect(mockStorage.upload).toHaveBeenCalled();
    });

    it('uses version 1 when no prior version exists', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue(mockDataset);
      mockPrisma.datasetVersion.findFirst.mockResolvedValue(null);
      mockPrisma.datasetVersion.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.datasetVersion.create.mockResolvedValue(mockVersion);

      await service.upload(DATASET_ID, WORKSPACE_A, csvBuffer, 'data.csv', 'text/csv');
      expect(mockPrisma.datasetVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionNumber: 1 }) }),
      );
    });

    it('increments version number when prior versions exist', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue(mockDataset);
      mockPrisma.datasetVersion.findFirst.mockResolvedValue({ versionNumber: 3 });
      mockPrisma.datasetVersion.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.datasetVersion.create.mockResolvedValue({ ...mockVersion, versionNumber: 4 });

      await service.upload(DATASET_ID, WORKSPACE_A, csvBuffer, 'data.csv', 'text/csv');
      expect(mockPrisma.datasetVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionNumber: 4 }) }),
      );
    });
  });

  // ─── upload — file parsing ────────────────────────────────────────────────────

  describe('upload — file parsing', () => {
    beforeEach(() => {
      mockPrisma.dataset.findUnique.mockResolvedValue(mockDataset);
      mockPrisma.datasetVersion.findFirst.mockResolvedValue(null);
      mockPrisma.datasetVersion.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.datasetVersion.create.mockResolvedValue(mockVersion);
    });

    it('parses valid CSV and passes correct rowCount to prisma', async () => {
      const buf = Buffer.from('a,b\n1,2\n3,4');
      await service.upload(DATASET_ID, WORKSPACE_A, buf, 'data.csv', 'text/csv');
      expect(mockPrisma.datasetVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ rowCount: 2 }) }),
      );
    });

    it('parses valid JSON array and passes correct rowCount to prisma', async () => {
      const buf = Buffer.from(JSON.stringify([{ a: 1 }, { a: 2 }]));
      await service.upload(DATASET_ID, WORKSPACE_A, buf, 'data.json', 'application/json');
      expect(mockPrisma.datasetVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ rowCount: 2 }) }),
      );
    });

    it('parses valid JSONL and passes correct rowCount to prisma', async () => {
      const buf = Buffer.from('{"a":1}\n{"a":2}\n{"a":3}');
      await service.upload(DATASET_ID, WORKSPACE_A, buf, 'data.jsonl', 'text/plain');
      expect(mockPrisma.datasetVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ rowCount: 3 }) }),
      );
    });

    it('throws BadRequestException for malformed JSONL', async () => {
      const buf = Buffer.from('{"a":1}\nNOT_JSON\n{"a":3}');
      await expect(
        service.upload(DATASET_ID, WORKSPACE_A, buf, 'data.jsonl', 'text/plain'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── preview ─────────────────────────────────────────────────────────────────

  describe('preview', () => {
    it('throws NotFoundException for cross-workspace preview access', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue(null);
      await expect(service.preview(DATASET_ID, WORKSPACE_B, 1)).rejects.toThrow(NotFoundException);
    });

    it('returns preview data for correct workspace', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue({ id: DATASET_ID });
      mockPrisma.datasetVersion.findUnique.mockResolvedValue(mockVersion);
      mockStorage.getBuffer.mockResolvedValue(Buffer.from('name,age\nAlice,30'));

      const result = await service.preview(DATASET_ID, WORKSPACE_A, 1);
      expect(result.columns).toContain('name');
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('throws NotFoundException when version not found', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue({ id: DATASET_ID });
      mockPrisma.datasetVersion.findUnique.mockResolvedValue(null);
      await expect(service.preview(DATASET_ID, WORKSPACE_A, 99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── compare ─────────────────────────────────────────────────────────────────

  describe('compare', () => {
    it('throws NotFoundException for cross-workspace compare access', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue(null);
      await expect(service.compare(DATASET_ID, WORKSPACE_B, 1, 2)).rejects.toThrow(NotFoundException);
    });

    it('returns diff result for correct workspace', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue({ id: DATASET_ID });
      mockPrisma.datasetVersion.findUnique
        .mockResolvedValueOnce({ ...mockVersion, versionNumber: 1, storagePath: 'path/v1.csv' })
        .mockResolvedValueOnce({ ...mockVersion, versionNumber: 2, storagePath: 'path/v2.csv' });
      mockStorage.getBuffer
        .mockResolvedValueOnce(Buffer.from('name,age\nAlice,30'))
        .mockResolvedValueOnce(Buffer.from('name,age\nAlice,30\nBob,25'));

      const result = await service.compare(DATASET_ID, WORKSPACE_A, 1, 2);
      expect(result.added).toBe(1);
      expect(result.removed).toBe(0);
      expect(result.rowCountDiff).toBe(1);
    });

    it('throws NotFoundException when version A not found', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue({ id: DATASET_ID });
      mockPrisma.datasetVersion.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockVersion, versionNumber: 2 });
      await expect(service.compare(DATASET_ID, WORKSPACE_A, 1, 2)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when version B not found', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue({ id: DATASET_ID });
      mockPrisma.datasetVersion.findUnique
        .mockResolvedValueOnce({ ...mockVersion, versionNumber: 1 })
        .mockResolvedValueOnce(null);
      await expect(service.compare(DATASET_ID, WORKSPACE_A, 1, 2)).rejects.toThrow(NotFoundException);
    });
  });
});
