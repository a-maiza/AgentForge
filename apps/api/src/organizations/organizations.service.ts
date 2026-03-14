import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@agentforge/shared';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '@agentforge/shared';
import type { Organization, OrgMember, User, user_role } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForUser(userId: string): Promise<(OrgMember & { org: Organization })[]> {
    return this.prisma.orgMember.findMany({
      where: { userId },
      include: { org: true },
    });
  }

  findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  async create(data: CreateOrganizationInput, user: User): Promise<Organization> {
    const existing = await this.prisma.organization.findUnique({
      where: { slug: data.slug },
    });
    if (existing) throw new ConflictException(`Slug "${data.slug}" is already taken`);

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: data.name, slug: data.slug, plan: 'free' },
      });
      await tx.orgMember.create({
        data: {
          orgId: org.id,
          userId: user.id,
          role: UserRole.OWNER as user_role,
          joinedAt: new Date(),
        },
      });
      return org;
    });
  }

  async update(id: string, data: UpdateOrganizationInput, userId: string): Promise<Organization> {
    await this.assertRole(id, userId, [UserRole.OWNER, UserRole.ADMIN]);

    if (data.slug) {
      const conflict = await this.prisma.organization.findFirst({
        where: { slug: data.slug, NOT: { id } },
      });
      if (conflict) throw new ConflictException(`Slug "${data.slug}" is already taken`);
    }

    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
      },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.assertRole(id, userId, [UserRole.OWNER]);
    await this.prisma.organization.delete({ where: { id } });
  }

  getMembers(orgId: string): Promise<(OrgMember & { user: User })[]> {
    return this.prisma.orgMember.findMany({
      where: { orgId },
      include: { user: true },
    });
  }

  async addMember(
    orgId: string,
    targetUserId: string,
    role: string,
    requesterId: string,
  ): Promise<OrgMember> {
    await this.assertRole(orgId, requesterId, [UserRole.OWNER, UserRole.ADMIN]);

    const existing = await this.prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: targetUserId } },
    });
    if (existing) throw new ConflictException('User is already a member');

    return this.prisma.orgMember.create({
      data: {
        orgId,
        userId: targetUserId,
        role: role as user_role,
        joinedAt: new Date(),
      },
    });
  }

  async removeMember(orgId: string, targetUserId: string, requesterId: string): Promise<void> {
    await this.assertRole(orgId, requesterId, [UserRole.OWNER, UserRole.ADMIN]);
    await this.prisma.orgMember.delete({
      where: { orgId_userId: { orgId, userId: targetUserId } },
    });
  }

  getMembership(orgId: string, userId: string): Promise<OrgMember | null> {
    return this.prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
  }

  private async assertRole(orgId: string, userId: string, roles: string[]): Promise<void> {
    const member = await this.getMembership(orgId, userId);
    if (!member) throw new NotFoundException('Organization not found');
    if (!roles.includes(member.role)) throw new ForbiddenException('Insufficient permissions');
  }
}
