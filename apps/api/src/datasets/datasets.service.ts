import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { parse } from 'csv-parse/sync';
import type { Dataset, DatasetVersion } from '@prisma/client';
import type { CreateDatasetDto } from './dto/create-dataset.dto';
import type { UpdateDatasetDto } from './dto/update-dataset.dto';

export interface UploadResult {
  dataset: Dataset;
  version: DatasetVersion;
}

interface ParsedFile {
  rows: Record<string, unknown>[];
  columns: string[];
}

export interface CompareResult {
  added: number;
  removed: number;
  modified: number;
  addedRows: Record<string, unknown>[];
  removedRows: Record<string, unknown>[];
  modifiedRows: Record<string, unknown>[];
  rowCountDiff: number;
  sizeChange: number;
}

@Injectable()
export class DatasetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  findAll(workspaceId: string): Promise<(Dataset & { versions: DatasetVersion[] })[]> {
    return this.prisma.dataset.findMany({
      where: { workspaceId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(
    id: string,
    workspaceId: string,
  ): Promise<Dataset & { versions: DatasetVersion[] }> {
    const dataset = await this.prisma.dataset.findFirst({
      where: { id, workspaceId },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });
    if (!dataset) throw new NotFoundException('Dataset not found');
    return dataset;
  }

  async create(dto: CreateDatasetDto, userId: string): Promise<Dataset> {
    return this.prisma.dataset.create({
      data: {
        workspaceId: dto.workspaceId,
        name: dto.name,
        ...(dto.description !== undefined && { description: dto.description }),
        createdBy: userId,
      },
    });
  }

  async update(id: string, workspaceId: string, dto: UpdateDatasetDto): Promise<Dataset> {
    const dataset = await this.prisma.dataset.findFirst({ where: { id, workspaceId } });
    if (!dataset) throw new NotFoundException('Dataset not found');
    return this.prisma.dataset.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    const dataset = await this.prisma.dataset.findFirst({ where: { id, workspaceId } });
    if (!dataset) throw new NotFoundException('Dataset not found');
    await this.prisma.dataset.delete({ where: { id } });
  }

  async upload(
    datasetId: string,
    workspaceId: string,
    fileBuffer: Buffer,
    filename: string,
    mimetype: string,
    userId: string,
  ): Promise<UploadResult> {
    const dataset = await this.prisma.dataset.findFirst({ where: { id: datasetId, workspaceId } });
    if (!dataset) throw new NotFoundException('Dataset not found');

    const parsed = this.parseFile(fileBuffer, mimetype, filename);

    const latestVersion = await this.prisma.datasetVersion.findFirst({
      where: { datasetId },
      orderBy: { versionNumber: 'desc' },
    });
    const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

    // Mark existing versions as archived
    await this.prisma.datasetVersion.updateMany({
      where: { datasetId, status: 'latest' },
      data: { status: 'archived' },
    });

    const storagePath = this.storage.buildKey(workspaceId, datasetId, nextVersion, filename);
    await this.storage.upload(storagePath, fileBuffer, mimetype);

    const version = await this.prisma.datasetVersion.create({
      data: {
        datasetId,
        versionNumber: nextVersion,
        storagePath,
        rowCount: parsed.rows.length,
        columnCount: parsed.columns.length,
        fileSizeBytes: BigInt(fileBuffer.length),
        columns: parsed.columns,
        status: 'latest',
      },
    });

    // Suppress unused variable warning
    void userId;

    return { dataset, version };
  }

  async getVersions(datasetId: string, workspaceId: string): Promise<DatasetVersion[]> {
    const dataset = await this.prisma.dataset.findFirst({ where: { id: datasetId, workspaceId } });
    if (!dataset) throw new NotFoundException('Dataset not found');
    return this.prisma.datasetVersion.findMany({
      where: { datasetId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async preview(
    datasetId: string,
    versionNumber: number,
    workspaceId: string,
    limit = 50,
  ): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
    const dataset = await this.prisma.dataset.findFirst({ where: { id: datasetId, workspaceId } });
    if (!dataset) throw new NotFoundException('Dataset not found');

    const version = await this.prisma.datasetVersion.findUnique({
      where: { datasetId_versionNumber: { datasetId, versionNumber } },
    });
    if (!version) throw new NotFoundException('Version not found');

    const buffer = await this.storage.getBuffer(version.storagePath);
    const parsed = this.parseFile(buffer, 'text/csv', version.storagePath);

    return {
      columns: parsed.columns,
      rows: parsed.rows.slice(0, limit),
    };
  }

  async compare(
    datasetId: string,
    versionA: number,
    versionB: number,
    workspaceId: string,
  ): Promise<CompareResult> {
    const dataset = await this.prisma.dataset.findFirst({ where: { id: datasetId, workspaceId } });
    if (!dataset) throw new NotFoundException('Dataset not found');

    const [va, vb] = await Promise.all([
      this.prisma.datasetVersion.findUnique({
        where: { datasetId_versionNumber: { datasetId, versionNumber: versionA } },
      }),
      this.prisma.datasetVersion.findUnique({
        where: { datasetId_versionNumber: { datasetId, versionNumber: versionB } },
      }),
    ]);
    if (!va) throw new NotFoundException(`Version ${versionA} not found`);
    if (!vb) throw new NotFoundException(`Version ${versionB} not found`);

    const [bufA, bufB] = await Promise.all([
      this.storage.getBuffer(va.storagePath),
      this.storage.getBuffer(vb.storagePath),
    ]);

    const parsedA = this.parseFile(bufA, 'text/csv', va.storagePath);
    const parsedB = this.parseFile(bufB, 'text/csv', vb.storagePath);

    // Hash rows for comparison
    const hashRow = (row: Record<string, unknown>) => JSON.stringify(row);
    const mapA = new Map(parsedA.rows.map((r, i) => [i, hashRow(r)]));
    const mapB = new Map(parsedB.rows.map((r, i) => [i, hashRow(r)]));

    const hashSetA = new Set(parsedA.rows.map(hashRow));
    const hashSetB = new Set(parsedB.rows.map(hashRow));

    const addedRows = parsedB.rows.filter((r) => !hashSetA.has(hashRow(r)));
    const removedRows = parsedA.rows.filter((r) => !hashSetB.has(hashRow(r)));

    // Modified = rows at same index that differ
    const minLen = Math.min(mapA.size, mapB.size);
    const modifiedRows: Record<string, unknown>[] = [];
    for (let i = 0; i < minLen; i++) {
      if (mapA.get(i) !== mapB.get(i)) {
        modifiedRows.push(parsedB.rows[i] as Record<string, unknown>);
      }
    }

    return {
      added: addedRows.length,
      removed: removedRows.length,
      modified: modifiedRows.length,
      addedRows,
      removedRows,
      modifiedRows,
      rowCountDiff: parsedB.rows.length - parsedA.rows.length,
      sizeChange: Number(vb.fileSizeBytes) - Number(va.fileSizeBytes),
    };
  }

  private parseFile(buffer: Buffer, mimetype: string, filename: string): ParsedFile {
    const isJson = mimetype === 'application/json' || filename.endsWith('.json');
    if (isJson) {
      const data = JSON.parse(buffer.toString('utf8')) as unknown;
      const rows = Array.isArray(data)
        ? (data as Record<string, unknown>[])
        : [data as Record<string, unknown>];
      const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
      return { rows, columns };
    }
    // CSV
    try {
      const records = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, unknown>[];
      const columns = records.length > 0 ? Object.keys(records[0] as Record<string, unknown>) : [];
      return { rows: records, columns };
    } catch {
      throw new BadRequestException('Invalid CSV file');
    }
  }
}
