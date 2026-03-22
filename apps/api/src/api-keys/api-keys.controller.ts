import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';

@Controller('api/workspaces/:workspaceId/api-keys')
@UseGuards(WorkspaceGuard)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  findAll(@Param('workspaceId') workspaceId: string, @Query('status') status?: string) {
    return this.apiKeys.findAll(workspaceId, status);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateApiKeyDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.apiKeys.create(workspaceId, dto, req.user.id);
  }

  @Get(':id')
  findOne(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.apiKeys.findOne(id, workspaceId);
  }

  @Patch(':id/disable')
  @HttpCode(HttpStatus.OK)
  disable(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.apiKeys.disable(id, workspaceId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.apiKeys.remove(id, workspaceId);
  }
}
