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
import type { WorkspacesService } from './workspaces.service';
import { WorkspaceGuard } from './guards/workspace.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateWorkspaceSchema,
  type CreateWorkspaceInput,
} from '@agentforge/shared';
import type { User } from '@prisma/client';

@Controller('api')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('workspaces')
  findAll(@CurrentUser() user: User) {
    return this.workspacesService.findAllForUser(user.id);
  }

  @Get('organizations/:orgId/workspaces/:workspaceId')
  @UseGuards(WorkspaceGuard)
  findOne(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.findById(workspaceId);
  }

  @Post('organizations/:orgId/workspaces')
  create(
    @Param('orgId') orgId: string,
    @Body(new ZodValidationPipe(CreateWorkspaceSchema)) body: CreateWorkspaceInput,
    @CurrentUser() user: User,
  ) {
    return this.workspacesService.create(orgId, body, user);
  }

  @Put('organizations/:orgId/workspaces/:workspaceId')
  @UseGuards(WorkspaceGuard)
  update(
    @Param('workspaceId') workspaceId: string,
    @Body() body: Partial<CreateWorkspaceInput>,
    @CurrentUser() user: User,
  ) {
    return this.workspacesService.update(workspaceId, body, user.id);
  }

  @Delete('organizations/:orgId/workspaces/:workspaceId')
  @UseGuards(WorkspaceGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('workspaceId') workspaceId: string, @CurrentUser() user: User) {
    return this.workspacesService.delete(workspaceId, user.id);
  }

  @Get('organizations/:orgId/workspaces/:workspaceId/members')
  @UseGuards(WorkspaceGuard)
  getMembers(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getMembers(workspaceId);
  }
}
