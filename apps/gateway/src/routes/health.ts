import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { redis } from '../redis.js';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  /** Liveness probe — always returns 200 if the process is running */
  fastify.get('/health', async () => ({ status: 'ok' }));

  /** Readiness probe — checks both Redis and PostgreSQL connectivity */
  fastify.get('/ready', async (_req, reply) => {
    const checks: Record<string, string> = {};

    try {
      await redis.ping();
      checks['redis'] = 'ok';
    } catch {
      checks['redis'] = 'error';
    }

    try {
      await db.query('SELECT 1');
      checks['postgres'] = 'ok';
    } catch {
      checks['postgres'] = 'error';
    }

    const healthy = Object.values(checks).every((v) => v === 'ok');
    return reply.code(healthy ? 200 : 503).send({ status: healthy ? 'ok' : 'degraded', checks });
  });
}
