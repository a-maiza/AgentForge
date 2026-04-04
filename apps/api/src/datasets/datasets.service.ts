import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { parse } from 'csv-parse/sync';
import type { Dataset, DatasetVersion } from '@prisma/client';
import type { CreateDatasetDto } from './dto/create-dataset.dto';
import type { UpdateDatasetDto } from './dto/update-dataset.dto';

// fileSizeBytes is a Prisma BigInt — convert to string for JSON serialisation
type SerializedVersion = Omit<DatasetVersion, 'fileSizeBytes'> & { fileSizeBytes: string };
type SerializedDataset = Dataset & { versions: SerializedVersion[] };

function serializeVersion(v: DatasetVersion): SerializedVersion {
  return { ...v, fileSizeBytes: v.fileSizeBytes.toString() };
}

function serializeDataset(d: Dataset & { versions: DatasetVersion[] }): SerializedDataset {
  return { ...d, versions: d.versions.map(serializeVersion) };
}

export interface UploadResult {
  dataset: Dataset;
  version: SerializedVersion;
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

  async findAll(
    workspaceId: string,
    take = 25,
    cursor?: string,
  ): Promise<{ items: SerializedDataset[]; nextCursor: string | null }> {
    const rows = await this.prisma.dataset.findMany({
      where: { workspaceId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    let nextCursor: string | null = null;
    if (rows.length > take) {
      nextCursor = rows[take]!.id;
      rows.pop();
    }
    return { items: rows.map(serializeDataset), nextCursor };
  }

  async findOne(id: string, workspaceId: string): Promise<SerializedDataset> {
    const dataset = await this.prisma.dataset.findFirst({
      where: { id, workspaceId },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });
    if (!dataset) throw new NotFoundException('Dataset not found');
    return serializeDataset(dataset);
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
    const dataset = await this.prisma.dataset.findFirst({ where: { id, workspaceId }, select: { id: true } });
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
    const dataset = await this.prisma.dataset.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!dataset) throw new NotFoundException('Dataset not found');
    await this.prisma.$transaction(async (tx) => {
      // evaluation_results cascade from evaluation_jobs, but jobs reference the dataset
      await tx.evaluationJob.deleteMany({ where: { datasetId: id } });
      await tx.dataset.delete({ where: { id } });
    });
  }

  async upload(
    datasetId: string,
    fileBuffer: Buffer,
    filename: string,
    mimetype: string,
  ): Promise<UploadResult> {
    const dataset = await this.prisma.dataset.findUnique({
      where: { id: datasetId },
    });
    if (!dataset) throw new NotFoundException('Dataset not found');

    const parsed = this.parseFile(fileBuffer, mimetype, filename);

    const latestVersion = await this.prisma.datasetVersion.findFirst({
      where: { datasetId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

    // Mark existing versions as archived
    await this.prisma.datasetVersion.updateMany({
      where: { datasetId, status: 'latest' },
      data: { status: 'archived' },
    });

    const storagePath = this.storage.buildKey(
      dataset.workspaceId,
      datasetId,
      nextVersion,
      filename,
    );
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

    return { dataset, version: serializeVersion(version) };
  }

  async getVersions(datasetId: string, workspaceId: string): Promise<SerializedVersion[]> {
    const dataset = await this.prisma.dataset.findFirst({ where: { id: datasetId, workspaceId }, select: { id: true } });
    if (!dataset) throw new NotFoundException('Dataset not found');
    const versions = await this.prisma.datasetVersion.findMany({
      where: { datasetId },
      orderBy: { versionNumber: 'desc' },
    });
    return versions.map(serializeVersion);
  }

  async preview(
    datasetId: string,
    versionNumber: number,
    limit = 50,
  ): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
    const dataset = await this.prisma.dataset.findUnique({ where: { id: datasetId }, select: { id: true } });
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

  async compare(datasetId: string, versionA: number, versionB: number): Promise<CompareResult> {
    const dataset = await this.prisma.dataset.findUnique({ where: { id: datasetId }, select: { id: true } });
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
    const lower = filename.toLowerCase();
    const isJsonl = lower.endsWith('.jsonl');
    const isJson = !isJsonl && (mimetype === 'application/json' || lower.endsWith('.json'));

    if (isJsonl) {
      return this.parseJsonl(buffer);
    }

    if (isJson) {
      const text = buffer.toString('utf8');
      try {
        const data = JSON.parse(text) as unknown;
        const rows = Array.isArray(data)
          ? (data as Record<string, unknown>[])
          : [data as Record<string, unknown>];
        const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
        return { rows, columns };
      } catch {
        // Possibly JSONL with a .json extension — fall back to line-by-line
        try {
          return this.parseJsonl(buffer);
        } catch {
          throw new BadRequestException('Invalid JSON file: not a valid JSON array or JSONL');
        }
      }
    }

    // CSV (default)
    try {
      const records = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, unknown>[];
      const columns = records.length > 0 ? Object.keys(records[0] as Record<string, unknown>) : [];
      return { rows: records, columns };
    } catch {
      throw new BadRequestException('Invalid file: expected CSV, JSON array, or JSONL');
    }
  }

  private parseJsonl(buffer: Buffer): ParsedFile {
    const lines = buffer
      .toString('utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) throw new BadRequestException('JSONL file is empty');
    const rows = lines.map((line, i) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        throw new BadRequestException(`Invalid JSON on line ${i + 1}`);
      }
    });
    const columns = Object.keys(rows[0] as Record<string, unknown>);
    return { rows, columns };
  }
}
