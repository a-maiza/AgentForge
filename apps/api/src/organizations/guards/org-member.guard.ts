import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationsService } from '../organizations.service';
import type { User } from '@prisma/client';

export const REQUIRED_ORG_ROLES = 'requiredOrgRoles';

@Injectable()
export class OrgMemberGuard implements CanActivate {
  constructor(
    private readonly orgsService: OrganizationsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: User;
      params: Record<string, string>;
    }>();

    const orgId = request.params['orgId'];
    if (!orgId) return true;

    const member = await this.orgsService.getMembership(orgId, request.user.id);
    if (!member) throw new NotFoundException('Organization not found');

    const requiredRoles = this.reflector.get<string[]>(REQUIRED_ORG_ROLES, context.getHandler());
    if (requiredRoles?.length && !requiredRoles.includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
