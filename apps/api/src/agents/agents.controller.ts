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
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateAgentSchema,
  UpdateAgentSchema,
  WorkflowDefinitionSchema,
  type CreateAgentInput,
  type UpdateAgentInput,
  type WorkflowDefinitionInput,
} from '@agentforge/shared';
import type { User } from '@prisma/client';

@Controller('api/workspaces/:workspaceId/agents')
@UseGuards(WorkspaceGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.agentsService.findAll(workspaceId);
  }

  @Get(':id')
  findOne(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.agentsService.findOne(id, workspaceId);
  }

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(CreateAgentSchema)) body: CreateAgentInput,
    @CurrentUser() user: User,
  ) {
    return this.agentsService.create(workspaceId, body, user.id);
  }

  @Put(':id')
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAgentSchema)) body: UpdateAgentInput,
    @CurrentUser() user: User,
  ) {
    return this.agentsService.update(id, workspaceId, body, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.agentsService.delete(id, workspaceId);
  }

  @Get(':id/versions')
  getVersions(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.agentsService.getVersions(id, workspaceId);
  }

  @Put(':id/workflow')
  saveWorkflow(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(WorkflowDefinitionSchema))
    body: WorkflowDefinitionInput & Record<string, unknown>,
    @CurrentUser() user: User,
  ) {
    return this.agentsService.saveWorkflow(id, workspaceId, body, user.id);
  }

  @Post(':id/test-run')
  testRun(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.agentsService.testRun(id, workspaceId, body);
  }
}
