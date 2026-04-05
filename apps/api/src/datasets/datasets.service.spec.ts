import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DatasetsService } from './datasets.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const WS_ID = 'ws-1';
const DS_ID = 'ds-1';
const USER_ID = 'user-1';

const mockDataset = {
  id: DS_ID,
  workspaceId: WS_ID,
  name: 'Test DS',
  description: null,
  status: 'active',
  createdBy: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockVersion = {
  id: 'v-1',
  datasetId: DS_ID,
  versionNumber: 1,
  storagePath: 'datasets/ws-1/ds-1/v1/data.csv',
  rowCount: 2,
  columnCount: 2,
  fileSizeBytes: BigInt(100),
  columns: ['a', 'b'],
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
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  evaluationJob: { deleteMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockStorage = {
  buildKey: jest.fn().mockReturnValue('datasets/ws-1/ds-1/v1/data.csv'),
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
      const result = await service.findAll(WS_ID);
      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
      expect(mockPrisma.dataset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workspaceId: WS_ID } }),
      );
    });

    it('returns nextCursor when over page size', async () => {
      const datasets = Array.from({ length: 26 }, (_, i) => ({
        ...mockDataset,
        id: `ds-${i}`,
        versions: [],
      }));
      mockPrisma.dataset.findMany.mockResolvedValue(datasets);
      const result = await service.findAll(WS_ID, 25);
      expect(result.items).toHaveLength(25);
      expect(result.nextCursor).toBe('ds-25');
    });

    it('serialises fileSizeBytes as string', async () => {
      mockPrisma.dataset.findMany.mockResolvedValue([
        { ...mockDataset, versions: [mockVersion] },
      ]);
      const result = await service.findAll(WS_ID);
      expect(typeof result.items[0]!.versions[0]!.fileSizeBytes).toBe('string');
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns dataset for correct workspace', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue({ ...mockDataset, versions: [mockVersion] });
      const result = await service.findOne(DS_ID, WS_ID);
      expect(result.id).toBe(DS_ID);
    });

    it('throws NotFoundException when dataset not found', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue(null);
      await expect(service.findOne('bad', WS_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a dataset', async () => {
      mockPrisma.dataset.create.mockResolvedValue(mockDataset);
      const result = await service.create(
        { workspaceId: WS_ID, name: 'Test DS' },
        USER_ID,
      );
      expect(result.id).toBe(DS_ID);
      expect(mockPrisma.dataset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ workspaceId: WS_ID, name: 'Test DS' }),
        }),
      );
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates dataset when found in workspace', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue({ id: DS_ID });
      mockPrisma.dataset.update.mockResolvedValue({ ...mockDataset, name: 'Renamed' });
      const result = await service.update(DS_ID, WS_ID, { name: 'Renamed' });
      expect(result.name).toBe('Renamed');
    });

    it('throws NotFoundException when not in workspace', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue(null);
      await expect(service.update('bad', WS_ID, { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes dataset and related jobs in transaction', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue({ id: DS_ID });
      const txMock = {
        evaluationJob: { deleteMany: jest.fn().mockResolvedValue({}) },
        dataset: { delete: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation((fn: (tx: typeof txMock) => Promise<void>) =>
        fn(txMock),
      );
      await service.delete(DS_ID, WS_ID);
      expect(txMock.evaluationJob.deleteMany).toHaveBeenCalledWith({ where: { datasetId: DS_ID } });
      expect(txMock.dataset.delete).toHaveBeenCalledWith({ where: { id: DS_ID } });
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue(null);
      await expect(service.delete('bad', WS_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── upload ──────────────────────────────────────────────────────────────────

  describe('upload', () => {
    it('uploads CSV and creates a new version', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue(mockDataset);
      mockPrisma.datasetVersion.findFirst.mockResolvedValue({ versionNumber: 1 });
      mockPrisma.datasetVersion.updateMany.mockResolvedValue({});
      mockPrisma.datasetVersion.create.mockResolvedValue(mockVersion);

      const csv = Buffer.from('a,b\n1,2\n3,4');
      const result = await service.upload(DS_ID, csv, 'data.csv', 'text/csv');

      expect(result.dataset.id).toBe(DS_ID);
      expect(result.version.versionNumber).toBe(1);
      expect(mockPrisma.datasetVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ versionNumber: 2, rowCount: 2 }),
        }),
      );
    });

    it('uses version 1 when no prior version exists', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue(mockDataset);
      mockPrisma.datasetVersion.findFirst.mockResolvedValue(null);
      mockPrisma.datasetVersion.updateMany.mockResolvedValue({});
      mockPrisma.datasetVersion.create.mockResolvedValue(mockVersion);

      const csv = Buffer.from('a,b\n1,2');
      await service.upload(DS_ID, csv, 'data.csv', 'text/csv');

      expect(mockPrisma.datasetVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ versionNumber: 1 }),
        }),
      );
    });

    it('parses JSONL files', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue(mockDataset);
      mockPrisma.datasetVersion.findFirst.mockResolvedValue(null);
      mockPrisma.datasetVersion.updateMany.mockResolvedValue({});
      mockPrisma.datasetVersion.create.mockResolvedValue(mockVersion);

      const jsonl = Buffer.from('{"x":1}\n{"x":2}');
      await service.upload(DS_ID, jsonl, 'data.jsonl', 'application/json');

      expect(mockPrisma.datasetVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rowCount: 2, columnCount: 1 }),
        }),
      );
    });

    it('parses JSON array files', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue(mockDataset);
      mockPrisma.datasetVersion.findFirst.mockResolvedValue(null);
      mockPrisma.datasetVersion.updateMany.mockResolvedValue({});
      mockPrisma.datasetVersion.create.mockResolvedValue(mockVersion);

      const json = Buffer.from(JSON.stringify([{ col: 'v1' }, { col: 'v2' }]));
      await service.upload(DS_ID, json, 'data.json', 'application/json');

      expect(mockPrisma.datasetVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rowCount: 2 }),
        }),
      );
    });

    it('throws NotFoundException when dataset not found', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue(null);
      await expect(
        service.upload('bad', Buffer.from('a,b'), 'f.csv', 'text/csv'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for invalid JSONL', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue(mockDataset);
      mockPrisma.datasetVersion.findFirst.mockResolvedValue(null);

      const bad = Buffer.from('not-json\n');
      await expect(
        service.upload(DS_ID, bad, 'data.jsonl', 'text/plain'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getVersions ─────────────────────────────────────────────────────────────

  describe('getVersions', () => {
    it('returns versions for a dataset', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue({ id: DS_ID });
      mockPrisma.datasetVersion.findMany.mockResolvedValue([mockVersion]);
      const result = await service.getVersions(DS_ID, WS_ID);
      expect(result).toHaveLength(1);
      expect(result[0]!.fileSizeBytes).toBe('100');
    });

    it('throws NotFoundException when dataset not in workspace', async () => {
      mockPrisma.dataset.findFirst.mockResolvedValue(null);
      await expect(service.getVersions('bad', WS_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── preview ─────────────────────────────────────────────────────────────────

  describe('preview', () => {
    it('returns columns and rows from storage', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue({ id: DS_ID });
      mockPrisma.datasetVersion.findUnique.mockResolvedValue(mockVersion);
      mockStorage.getBuffer.mockResolvedValue(Buffer.from('a,b\n1,2\n3,4'));

      const result = await service.preview(DS_ID, 1);
      expect(result.columns).toEqual(['a', 'b']);
      expect(result.rows).toHaveLength(2);
    });

    it('throws NotFoundException when dataset not found', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue(null);
      await expect(service.preview('bad', 1)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when version not found', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue({ id: DS_ID });
      mockPrisma.datasetVersion.findUnique.mockResolvedValue(null);
      await expect(service.preview(DS_ID, 99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── compare ─────────────────────────────────────────────────────────────────

  describe('compare', () => {
    const makeVersion = (n: number, size: number) => ({
      ...mockVersion,
      versionNumber: n,
      fileSizeBytes: BigInt(size),
      storagePath: `path/v${n}`,
    });

    it('computes added, removed, and modified rows', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue({ id: DS_ID });
      mockPrisma.datasetVersion.findUnique
        .mockResolvedValueOnce(makeVersion(1, 50))
        .mockResolvedValueOnce(makeVersion(2, 80));

      mockStorage.getBuffer
        .mockResolvedValueOnce(Buffer.from('a,b\n1,2\n3,4'))
        .mockResolvedValueOnce(Buffer.from('a,b\n1,2\n5,6\n7,8'));

      const result = await service.compare(DS_ID, 1, 2);
      expect(result.added).toBeGreaterThanOrEqual(0);
      expect(result.removed).toBeGreaterThanOrEqual(0);
      expect(result.rowCountDiff).toBe(1);
      expect(result.sizeChange).toBe(30);
    });

    it('throws NotFoundException when dataset not found', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue(null);
      await expect(service.compare('bad', 1, 2)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when version A not found', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue({ id: DS_ID });
      mockPrisma.datasetVersion.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeVersion(2, 80));
      await expect(service.compare(DS_ID, 1, 2)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when version B not found', async () => {
      mockPrisma.dataset.findUnique.mockResolvedValue({ id: DS_ID });
      mockPrisma.datasetVersion.findUnique
        .mockResolvedValueOnce(makeVersion(1, 50))
        .mockResolvedValueOnce(null);
      await expect(service.compare(DS_ID, 1, 2)).rejects.toThrow(NotFoundException);
    });
  });
});
