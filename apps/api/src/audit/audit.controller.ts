import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { OrgMemberGuard } from '../organizations/guards/org-member.guard';

@Controller('api')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /**
   * GET /api/workspaces/:workspaceId/audit-logs
   *
   * Returns a cursor-paginated list of audit events for the workspace.
   * Requires the caller to be a workspace member (enforced by WorkspaceGuard).
   * Admin-only enforcement can be layered on via OrgMemberGuard if needed.
   */
  @Get('workspaces/:workspaceId/audit-logs')
  @UseGuards(WorkspaceGuard)
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.findByWorkspace({
      workspaceId,
      ...(cursor ? { cursor } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    });
  }
}
