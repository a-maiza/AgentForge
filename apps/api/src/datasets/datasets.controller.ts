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
  Req,
} from '@nestjs/common';
import { DatasetsService } from './datasets.service';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UpdateDatasetDto } from './dto/update-dataset.dto';
import type { FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';

@Controller('api/datasets')
export class DatasetsController {
  constructor(private readonly datasets: DatasetsService) {}

  @Get()
  findAll(@Req() req: FastifyRequest & { user: User }) {
    // workspaceId from query — simplified: use first workspace. Real impl: @Query('workspaceId')
    const workspaceId = (req.query as Record<string, string>)['workspaceId'] ?? '';
    return this.datasets.findAll(workspaceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: FastifyRequest & { user: User }) {
    const workspaceId = (req.query as Record<string, string>)['workspaceId'] ?? '';
    return this.datasets.findOne(id, workspaceId);
  }

  @Post()
  create(@Body() dto: CreateDatasetDto, @Req() req: FastifyRequest & { user: User }) {
    return this.datasets.create(dto, req.user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDatasetDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const workspaceId = (req.query as Record<string, string>)['workspaceId'] ?? '';
    return this.datasets.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Req() req: FastifyRequest & { user: User }) {
    const workspaceId = (req.query as Record<string, string>)['workspaceId'] ?? '';
    await this.datasets.delete(id, workspaceId);
  }

  @Post(':id/upload')
  async upload(@Param('id') id: string, @Req() req: FastifyRequest & { user: User }) {
    // @fastify/multipart — consume via req.file()
    const data = await (req as unknown as { file(): Promise<{ filename: string; mimetype: string; toBuffer(): Promise<Buffer> }> }).file();
    const buffer = await data.toBuffer();
    return this.datasets.upload(id, (req.query as Record<string, string>)['workspaceId'] ?? '', buffer, data.filename, data.mimetype, req.user.id);
  }

  @Get(':id/versions')
  getVersions(@Param('id') id: string, @Req() req: FastifyRequest & { user: User }) {
    const workspaceId = (req.query as Record<string, string>)['workspaceId'] ?? '';
    return this.datasets.getVersions(id, workspaceId);
  }

  @Get(':id/versions/:v/preview')
  preview(
    @Param('id') id: string,
    @Param('v', ParseIntPipe) v: number,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const workspaceId = (req.query as Record<string, string>)['workspaceId'] ?? '';
    return this.datasets.preview(id, v, workspaceId);
  }

  @Post(':id/versions/compare')
  compare(
    @Param('id') id: string,
    @Body() body: { versionA: number; versionB: number },
    @Req() req: FastifyRequest & { user: User },
  ) {
    const workspaceId = (req.query as Record<string, string>)['workspaceId'] ?? '';
    return this.datasets.compare(id, body.versionA, body.versionB, workspaceId);
  }
}
