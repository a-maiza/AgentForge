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
import { AuditService } from '../audit/audit.service';

@Controller('api/workspaces/:workspaceId/api-keys')
@UseGuards(WorkspaceGuard)
export class ApiKeysController {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  findAll(@Param('workspaceId') workspaceId: string, @Query('status') status?: string) {
    return this.apiKeys.findAll(workspaceId, status);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateApiKeyDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const result = await this.apiKeys.create(workspaceId, dto, req.user.id);
    void this.audit.log({
      userId: req.user.id,
      workspaceId,
      action: 'api_key_created',
      resourceType: 'api_key',
      resourceId: result.id,
      metadata: { name: dto.name, scope: dto.scope },
      ipAddress: req.ip,
    });
    return result;
  }

  @Get(':id')
  findOne(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.apiKeys.findOne(id, workspaceId);
  }

  @Patch(':id/disable')
  @HttpCode(HttpStatus.OK)
  async disable(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    const result = await this.apiKeys.disable(id, workspaceId);
    void this.audit.log({
      userId: req.user.id,
      workspaceId,
      action: 'api_key_disabled',
      resourceType: 'api_key',
      resourceId: id,
      ipAddress: req.ip,
    });
    return result;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    await this.apiKeys.remove(id, workspaceId);
    void this.audit.log({
      userId: req.user.id,
      workspaceId,
      action: 'api_key_deleted',
      resourceType: 'api_key',
      resourceId: id,
      ipAddress: req.ip,
    });
  }
}
