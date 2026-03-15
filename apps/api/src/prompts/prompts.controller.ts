import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreatePromptSchema, UpdatePromptSchema, type UpdatePromptInput } from '@agentforge/shared';
import type { User } from '@prisma/client';

interface CreatePromptBody {
  name: string;
  description?: string;
  content: string;
}

@Controller('api/workspaces/:workspaceId/prompts')
@UseGuards(WorkspaceGuard)
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  @Get()
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.promptsService.findAll(workspaceId);
  }

  @Get(':id')
  findOne(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.promptsService.findOne(id, workspaceId);
  }

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(CreatePromptSchema)) body: CreatePromptBody,
    @CurrentUser() user: User,
  ) {
    return this.promptsService.create(workspaceId, body, user.id);
  }

  @Put(':id')
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePromptSchema)) body: UpdatePromptInput,
    @CurrentUser() user: User,
  ) {
    return this.promptsService.update(id, workspaceId, body, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.promptsService.delete(id, workspaceId);
  }

  @Get(':id/versions')
  getVersions(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.promptsService.getVersions(id, workspaceId);
  }

  @Get(':id/versions/:version')
  getVersion(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.promptsService.getVersion(id, version, workspaceId);
  }

  @Put(':id/dataset-config')
  saveDatasetConfig(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() body: { datasetId: string; datasetVersionId: string; variableMapping: Record<string, string>; isActive?: boolean },
  ) {
    return this.promptsService.saveDatasetConfig(id, workspaceId, body);
  }
}
