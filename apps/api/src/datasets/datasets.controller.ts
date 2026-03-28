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
} from '@nestjs/common';
import { DatasetsService } from './datasets.service';
import { UpdateDatasetDto } from './dto/update-dataset.dto';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';

@Controller('api')
export class DatasetsController {
  constructor(private readonly datasets: DatasetsService) {}

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
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() body: { name: string; description?: string },
    @CurrentUser() user: User,
  ) {
    return this.datasets.create({ workspaceId, ...body }, user.id);
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
  async delete(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    await this.datasets.delete(id, workspaceId);
  }

  @Get('workspaces/:workspaceId/datasets/:id/versions')
  @UseGuards(WorkspaceGuard)
  getVersions(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.datasets.getVersions(id, workspaceId);
  }

  // These routes are not workspace-prefixed on the frontend — keep paths unchanged
  @Post('datasets/:id/upload')
  async upload(@Param('id') id: string, @Req() req: FastifyRequest & { user: User }) {
    const data = await (
      req as unknown as {
        file(): Promise<{ filename: string; mimetype: string; toBuffer(): Promise<Buffer> }>;
      }
    ).file();
    const buffer = await data.toBuffer();
    return this.datasets.upload(id, buffer, data.filename, data.mimetype);
  }

  @Get('datasets/:id/versions/:v/preview')
  preview(@Param('id') id: string, @Param('v', ParseIntPipe) v: number) {
    return this.datasets.preview(id, v);
  }

  @Post('datasets/:id/versions/compare')
  compare(@Param('id') id: string, @Body() body: { versionA: number; versionB: number }) {
    return this.datasets.compare(id, body.versionA, body.versionB);
  }
}
