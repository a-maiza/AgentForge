import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkspacesService } from '../workspaces.service';
import type { User } from '@prisma/client';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly workspacesService: WorkspacesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: User;
      params: Record<string, string>;
    }>();

    const workspaceId = request.params['workspaceId'];
    if (!workspaceId) return true;

    const member = await this.workspacesService.getMembership(workspaceId, request.user.id);
    if (!member) throw new NotFoundException('Workspace not found');

    return true;
  }
}
