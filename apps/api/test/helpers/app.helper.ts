import type { CanActivate, INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaService } from '../../src/prisma/prisma.service';
import { WorkspaceGuard } from '../../src/workspaces/guards/workspace.guard';

/** Shared fake user injected into requests during integration tests. */
export const FAKE_USER = {
  id: 'user-test-id',
  clerkId: 'clerk_test',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Minimal mock PrismaService — no real DB connection. */
export const mockPrismaService = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $transaction: jest.fn().mockResolvedValue([]),
  prompt: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  promptVersion: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  promptVariable: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
  promptDatasetConfig: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  dataset: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  datasetVersion: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  evaluationJob: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
  evaluationResult: { findMany: jest.fn() },
  evaluationTrace: { findMany: jest.fn() },
  agent: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  apiKey: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  deployment: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  workspace: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  workspaceMember: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
  user: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), upsert: jest.fn() },
  organization: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), upsert: jest.fn() },
  auditLog: { create: jest.fn(), findMany: jest.fn() },
  aiProvider: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  failoverConfig: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
};

/**
 * Build a slim NestJS Fastify app that imports just the specified feature module.
 * No global APP_GUARD — services and WorkspaceGuard are overridden via the builder.
 */
export async function buildSlimApp(
  featureModule: Type<unknown>,
  serviceOverrides: Array<{ token: unknown; value: unknown }> = [],
): Promise<INestApplication> {
  let builder = Test.createTestingModule({
    imports: [featureModule],
  })
    .overrideGuard(WorkspaceGuard as Type<CanActivate>)
    .useValue({ canActivate: () => true })
    .overrideProvider(PrismaService)
    .useValue(mockPrismaService);

  for (const { token, value } of serviceOverrides) {
    builder = builder.overrideProvider(token as Type<unknown>).useValue(value);
  }

  const moduleRef = await builder.compile();

  const adapter = new FastifyAdapter({ logger: false });

  // Inject FAKE_USER via Fastify onRequest hook so @CurrentUser() works in controllers
  adapter.getInstance().addHook('onRequest', (_req, _reply, done) => {
    (_req as Record<string, unknown>)['user'] = FAKE_USER;
    done();
  });

  const app = moduleRef.createNestApplication<NestFastifyApplication>(adapter);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

/** Helper to get the HTTP server from a NestJS app (for use with supertest). */
export function getServer(app: INestApplication): unknown {
  return app.getHttpAdapter().getInstance().server;
}
