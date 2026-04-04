import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import { connectRedis } from './redis.js';
import { db } from './db.js';
import { healthRoutes } from './routes/health.js';
import { liveRoutes } from './routes/live.js';
import { registerIpFilter } from './lib/ip-filter.js';

const PORT = Number(process.env['PORT'] ?? 3002);
const HOST = '0.0.0.0';

const fastify = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] ?? 'info',
    ...(process.env['NODE_ENV'] !== 'production' && {
      transport: { target: 'pino-pretty', options: { colorize: true } },
    }),
  },
});

// ── Plugins ───────────────────────────────────────────────────────────────────

await fastify.register(cors, {
  origin: process.env['CORS_ORIGIN'] ?? '*',
  methods: ['GET', 'POST'],
});

await fastify.register(compress, { global: true });

// Global coarse rate limit (per IP); fine-grained per-key limits are in the route
await fastify.register(rateLimit, {
  global: true,
  max: 10_000,
  timeWindow: '1 minute',
});

// ── IP filter (allowlist / blocklist via Redis sets) ──────────────────────────

await registerIpFilter(fastify);

// ── Routes ────────────────────────────────────────────────────────────────────

await fastify.register(healthRoutes);
await fastify.register(liveRoutes);

// ── Start ─────────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  await connectRedis();
  fastify.log.info('Redis connected');

  await db.query('SELECT 1');
  fastify.log.info('PostgreSQL connected');

  await fastify.listen({ port: PORT, host: HOST });
}

start().catch((err: unknown) => {
  fastify.log.error(err, 'Failed to start gateway');
  process.exit(1);
});
