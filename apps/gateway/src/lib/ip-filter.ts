import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../redis.js';

const BLOCKLIST_KEY = 'ip:blocklist';
const ALLOWLIST_KEY = 'ip:allowlist';

/**
 * Extract the real client IP, respecting X-Forwarded-For when the gateway is
 * deployed behind a trusted proxy (e.g. an Nginx ingress or a load balancer).
 */
function getClientIp(req: FastifyRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return (first ?? '').trim();
  }
  return req.socket.remoteAddress ?? '';
}

/**
 * Register a global `onRequest` hook that enforces IP-based access control.
 *
 * Logic (checked in this order):
 *  1. If the allowlist set is non-empty AND the IP is not in it → 403.
 *  2. If the IP is in the blocklist set → 403.
 *
 * Redis sets are populated externally (admin API, ops tooling, etc.).
 * An empty allowlist means "allow all" (opt-in allowlisting).
 */
export async function registerIpFilter(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    // Skip health checks so liveness probes are never blocked
    if (req.url === '/health' || req.url === '/healthz') return;

    const ip = getClientIp(req);
    if (!ip) return; // No IP resolvable — allow (edge case in tests)

    const [allowlistMembers, isBlocked] = await Promise.all([
      redis.smembers(ALLOWLIST_KEY),
      redis.sismember(BLOCKLIST_KEY, ip),
    ]);

    // Allowlist enforcement: if the set is populated the IP must be in it
    if (allowlistMembers.length > 0 && !allowlistMembers.includes(ip)) {
      req.log.warn({ ip }, 'IP not in allowlist — rejected');
      await reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'IP not allowed' });
      return;
    }

    // Blocklist enforcement
    if (isBlocked) {
      req.log.warn({ ip }, 'IP on blocklist — rejected');
      await reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'IP blocked' });
      return;
    }
  });
}
