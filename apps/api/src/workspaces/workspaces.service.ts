import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@agentforge/shared';
import type { CreateWorkspaceInput } from '@agentforge/shared';
import type { Workspace, WorkspaceMember, User } from '@prisma/client';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<(WorkspaceMember & { workspace: Workspace })[]> {
    return this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
    });
  }

  findById(id: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({ where: { id } });
  }

  async create(orgId: string, data: CreateWorkspaceInput, user: User): Promise<Workspace> {
    const existing = await this.prisma.workspace.findUnique({
      where: { orgId_slug: { orgId, slug: data.slug } },
    });
    if (existing) throw new ConflictException(`Slug "${data.slug}" already exists in this org`);

    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { orgId, name: data.name, slug: data.slug },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: user.id, role: UserRole.OWNER },
      });
      return workspace;
    });
  }

  async update(
    id: string,
    data: Partial<CreateWorkspaceInput>,
    userId: string,
  ): Promise<Workspace> {
    await this.assertMember(id, userId);
    return this.prisma.workspace.update({ where: { id }, data });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.assertRole(id, userId, [UserRole.OWNER]);
    await this.prisma.workspace.delete({ where: { id } });
  }

  getMembership(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    return this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  getMembers(workspaceId: string): Promise<(WorkspaceMember & { user: User })[]> {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true },
    });
  }

  private async assertMember(workspaceId: string, userId: string): Promise<WorkspaceMember> {
    const member = await this.getMembership(workspaceId, userId);
    if (!member) throw new NotFoundException('Workspace not found');
    return member;
  }

  private async assertRole(workspaceId: string, userId: string, roles: string[]): Promise<void> {
    const member = await this.assertMember(workspaceId, userId);
    if (!roles.includes(member.role)) throw new ForbiddenException('Insufficient permissions');
  }
}
