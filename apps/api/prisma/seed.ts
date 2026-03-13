import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Default Organization',
      slug: 'default',
      plan: 'free',
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'admin@agentforge.local' },
    update: {},
    create: {
      clerkId: 'local_admin',
      email: 'admin@agentforge.local',
      name: 'Admin',
    },
  });

  await prisma.orgMember.upsert({
    where: { orgId_userId: { orgId: org.id, userId: user.id } },
    update: {},
    create: {
      orgId: org.id,
      userId: user.id,
      role: 'owner',
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { orgId_slug: { orgId: org.id, slug: 'default' } },
    update: {},
    create: {
      orgId: org.id,
      name: 'Default Workspace',
      slug: 'default',
    },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: 'owner',
    },
  });

  console.log('Seed complete:', { org: org.slug, user: user.email, workspace: workspace.slug });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
