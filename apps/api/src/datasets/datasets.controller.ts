import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { DatasetsService } from './datasets.service';
import { UpdateDatasetDto } from './dto/update-dataset.dto';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import type { FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';

const ALLOWED_MIMETYPES = new Set([
  'text/csv',
  'application/csv',
  'application/json',
  'application/x-ndjson',
  'text/plain',
  'application/octet-stream',
]);

@Controller('api')
export class DatasetsController {
  constructor(
    private readonly datasets: DatasetsService,
    private readonly audit: AuditService,
  ) {}

  @Get('workspaces/:workspaceId/datasets')
  @UseGuards(WorkspaceGuard)
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.datasets.findAll(workspaceId);
  }

  @Get('workspaces/:workspaceId/datasets/:id')
  @UseGuards(WorkspaceGuard)
  findOne(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.datasets.findOne(id, workspaceId);
  }

  @Post('workspaces/:workspaceId/datasets')
  @UseGuards(WorkspaceGuard)
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() body: { name: string; description?: string },
    @CurrentUser() user: User,
    @Req() req: FastifyRequest,
  ) {
    const dataset = await this.datasets.create({ workspaceId, ...body }, user.id);
    void this.audit.log({
      userId: user.id,
      workspaceId,
      action: 'dataset_created',
      resourceType: 'dataset',
      resourceId: dataset.id,
      ipAddress: req.ip,
    });
    return dataset;
  }

  @Put('workspaces/:workspaceId/datasets/:id')
  @UseGuards(WorkspaceGuard)
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDatasetDto,
  ) {
    return this.datasets.update(id, workspaceId, dto);
  }

  @Delete('workspaces/:workspaceId/datasets/:id')
  @UseGuards(WorkspaceGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() req: FastifyRequest,
  ) {
    await this.datasets.delete(id, workspaceId);
    void this.audit.log({
      userId: user.id,
      workspaceId,
      action: 'dataset_deleted',
      resourceType: 'dataset',
      resourceId: id,
      ipAddress: req.ip,
    });
  }

  @Get('workspaces/:workspaceId/datasets/:id/versions')
  @UseGuards(WorkspaceGuard)
  getVersions(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.datasets.getVersions(id, workspaceId);
  }

  // Upload: workspace-scoped via WorkspaceGuard; workspaceId passed to service for double-check
  @Post('workspaces/:workspaceId/datasets/:id/upload')
  @UseGuards(WorkspaceGuard)
  async upload(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const data = await (
      req as unknown as {
        file(): Promise<{ filename: string; mimetype: string; toBuffer(): Promise<Buffer> }>;
      }
    ).file();

    const lower = data.filename.toLowerCase();
    const isAllowedExtension =
      lower.endsWith('.csv') || lower.endsWith('.json') || lower.endsWith('.jsonl');
    if (!isAllowedExtension && !ALLOWED_MIMETYPES.has(data.mimetype)) {
      throw new BadRequestException('Unsupported file type. Allowed: .csv, .json, .jsonl');
    }

    const buffer = await data.toBuffer();
    const result = await this.datasets.upload(id, workspaceId, buffer, data.filename, data.mimetype);

    void this.audit.log({
      userId: req.user.id,
      workspaceId,
      action: 'dataset_version_uploaded',
      resourceType: 'dataset_version',
      resourceId: result.version.id,
      metadata: { datasetId: id, versionNumber: result.version.versionNumber, filename: data.filename },
      ipAddress: req.ip,
    });

    return result;
  }

  @Get('workspaces/:workspaceId/datasets/:id/versions/:v/preview')
  @UseGuards(WorkspaceGuard)
  preview(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Param('v', ParseIntPipe) v: number,
  ) {
    return this.datasets.preview(id, workspaceId, v);
  }

  @Post('workspaces/:workspaceId/datasets/:id/versions/compare')
  @UseGuards(WorkspaceGuard)
  compare(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() body: { versionA: number; versionB: number },
  ) {
    return this.datasets.compare(id, workspaceId, body.versionA, body.versionB);
  }
}
