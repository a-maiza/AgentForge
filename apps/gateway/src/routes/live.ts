import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { redis, publisher, PROMPT_CACHE_TTL, AUTH_CACHE_TTL } from '../redis.js';
import { decryptApiKey } from '../crypto.js';
import { substituteVariables } from '../lib/variables.js';
import { estimateCostUsd } from '../lib/cost.js';
import { callLlm } from '../lib/llm.js';
import type { PromptConfig, CachedApiKey } from '../types.js';

const ENCRYPTION_KEY = process.env['ENCRYPTION_KEY'] ?? '';
const DEFAULT_TIMEOUT_MS = 30_000;

// ── Rate limiting ─────────────────────────────────────────────────────────────

const RATE_LIMIT_PER_MIN = 1_000;
const RATE_LIMIT_PER_DAY = 100_000;

async function checkRateLimit(keyId: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const minKey = `ratelimit:${keyId}:min`;
  const dayKey = `ratelimit:${keyId}:day`;

  const [minCount, dayCount] = await Promise.all([redis.incr(minKey), redis.incr(dayKey)]);

  // Set TTL only on first increment (INCR creates the key)
  if (minCount === 1) await redis.expire(minKey, 60);
  if (dayCount === 1) await redis.expire(dayKey, 86_400);

  if (minCount > RATE_LIMIT_PER_MIN) return { allowed: false, retryAfter: 60 };
  if (dayCount > RATE_LIMIT_PER_DAY) return { allowed: false, retryAfter: 86_400 };

  return { allowed: true, retryAfter: 0 };
}

// ── Prompt config cache ───────────────────────────────────────────────────────

async function getPromptConfig(hash: string): Promise<PromptConfig | null> {
  const cacheKey = `prompt:${hash}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as PromptConfig;

  // DB query: join deployment → prompt_version, prompt_ai_config, ai_providers, failover_configs
  const { rows } = await db.query<{
    deployment_id: string;
    workspace_id: string;
    prompt_content: string;
    model_name: string | null;
    temperature: number | null;
    top_p: number | null;
    max_tokens: number | null;
    provider_type: string | null;
    api_key_encrypted: string | null;
    base_url: string | null;
    fc_timeout_ms: number | null;
    fc_error_threshold: number | null;
    fc_latency_threshold_ms: number | null;
    sec_provider_type: string | null;
    sec_api_key_encrypted: string | null;
    sec_base_url: string | null;
    sec_model_name: string | null;
  }>(
    `SELECT
       d.id                          AS deployment_id,
       p.workspace_id,
       pv.content                    AS prompt_content,
       pac.model_name,
       pac.temperature,
       pac.top_p,
       pac.max_tokens,
       ap.provider_type,
       ap.api_key_encrypted,
       ap.base_url,
       fc.timeout_ms                 AS fc_timeout_ms,
       fc.error_threshold            AS fc_error_threshold,
       fc.latency_threshold_ms       AS fc_latency_threshold_ms,
       ap2.provider_type             AS sec_provider_type,
       ap2.api_key_encrypted         AS sec_api_key_encrypted,
       ap2.base_url                  AS sec_base_url,
       pac2.model_name               AS sec_model_name
     FROM deployments d
     JOIN prompts p             ON p.id = d.prompt_id
     JOIN prompt_versions pv    ON pv.id = d.prompt_version_id
     LEFT JOIN prompt_ai_configs pac  ON pac.prompt_id = d.prompt_id AND pac.is_active = true
     LEFT JOIN ai_providers ap        ON ap.id = pac.provider_id
     LEFT JOIN failover_configs fc    ON fc.prompt_id = d.prompt_id AND fc.is_active = true
     LEFT JOIN ai_providers ap2       ON ap2.id = fc.secondary_provider_id
     LEFT JOIN prompt_ai_configs pac2 ON pac2.provider_id = fc.secondary_provider_id
                                     AND pac2.prompt_id = d.prompt_id
     WHERE d.endpoint_hash = $1 AND d.is_live = true
     LIMIT 1`,
    [hash],
  );

  if (!rows[0] || !rows[0].provider_type) return null;

  const row = rows[0];
  const config: PromptConfig = {
    deploymentId: row.deployment_id,
    workspaceId: row.workspace_id,
    promptContent: row.prompt_content,
    modelName: row.model_name ?? '',
    temperature: row.temperature,
    topP: row.top_p,
    maxTokens: row.max_tokens,
    providerType: row.provider_type as string,
    apiKeyEncrypted: row.api_key_encrypted ?? '',
    baseUrl: row.base_url,
    failover:
      row.sec_provider_type != null
        ? {
            timeoutMs: row.fc_timeout_ms ?? DEFAULT_TIMEOUT_MS,
            errorThreshold: row.fc_error_threshold ?? 3,
            latencyThresholdMs: row.fc_latency_threshold_ms ?? 5_000,
            secondaryProviderType: row.sec_provider_type,
            secondaryApiKeyEncrypted: row.sec_api_key_encrypted ?? '',
            secondaryBaseUrl: row.sec_base_url,
            secondaryModelName: row.sec_model_name ?? row.model_name ?? '',
          }
        : null,
  };

  await redis.set(cacheKey, JSON.stringify(config), 'EX', PROMPT_CACHE_TTL);
  return config;
}

// ── API key validation ────────────────────────────────────────────────────────

async function validateApiKey(token: string, workspaceId: string): Promise<CachedApiKey | null> {
  const fingerprint = createHash('sha256').update(token).digest('hex');
  const cacheKey = `apikey:${fingerprint}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    const record = JSON.parse(cached) as CachedApiKey;
    if (record.workspaceId !== workspaceId) return null;
    if (record.status !== 'active') return null;
    return record;
  }

  // DB fallback: fetch all active keys for this workspace and bcrypt-compare
  const { rows } = await db.query<{
    id: string;
    key_hash: string;
    status: string;
    expires_at: Date | null;
  }>(
    `SELECT id, key_hash, status, expires_at
     FROM api_keys
     WHERE workspace_id = $1 AND status = 'active'`,
    [workspaceId],
  );

  for (const row of rows) {
    if (row.expires_at && row.expires_at < new Date()) continue;
    const match = await bcrypt.compare(token, row.key_hash);
    if (match) {
      const record: CachedApiKey = { id: row.id, workspaceId, status: row.status };
      await redis.set(cacheKey, JSON.stringify(record), 'EX', AUTH_CACHE_TTL);
      return record;
    }
  }

  return null;
}

// ── Failover error tracking ───────────────────────────────────────────────────

async function incrementErrorCount(hash: string): Promise<number> {
  const key = `failover:errors:${hash}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60); // 1-minute window
  return count;
}

async function resetErrorCount(hash: string): Promise<void> {
  await redis.del(`failover:errors:${hash}`);
}

// ── Route handler ─────────────────────────────────────────────────────────────

interface LiveParams {
  hash: string;
}

interface LiveBody {
  variables?: Record<string, string>;
}

export async function liveRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Params: LiveParams; Body: LiveBody }>(
    '/api/v1/live/:hash',
    async (req: FastifyRequest<{ Params: LiveParams; Body: LiveBody }>, reply: FastifyReply) => {
      const { hash } = req.params;
      const variables = req.body?.variables ?? {};

      // 1. Auth: extract Bearer token
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Missing or invalid Authorization header' });
      }
      const token = authHeader.slice(7);

      // 2. Look up prompt config (Redis → DB)
      const config = await getPromptConfig(hash);
      if (!config) {
        return reply.code(404).send({ error: 'Endpoint not found or not live' });
      }

      // 3. Validate API key for this workspace
      const apiKeyRecord = await validateApiKey(token, config.workspaceId);
      if (!apiKeyRecord) {
        return reply.code(401).send({ error: 'Invalid, disabled, or expired API key' });
      }

      // 4. Rate limiting
      const { allowed, retryAfter } = await checkRateLimit(apiKeyRecord.id);
      if (!allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(retryAfter))
          .send({ error: 'Rate limit exceeded' });
      }

      // 5. Substitute variables into prompt
      const prompt = substituteVariables(config.promptContent, variables);

      // 6. Check failover error counter to decide which provider to use
      const errorCount = config.failover
        ? parseInt((await redis.get(`failover:errors:${hash}`)) ?? '0', 10)
        : 0;
      const useFailover = config.failover != null && errorCount >= config.failover.errorThreshold;

      // 7. Call LLM (primary or secondary)
      let result;
      let isFailover = false;
      const timeoutMs = config.failover?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      try {
        if (useFailover && config.failover) {
          isFailover = true;
          result = await callLlm({
            prompt,
            providerType: config.failover.secondaryProviderType,
            apiKey: decryptApiKey(config.failover.secondaryApiKeyEncrypted, ENCRYPTION_KEY),
            baseUrl: config.failover.secondaryBaseUrl,
            modelName: config.failover.secondaryModelName,
            temperature: config.temperature,
            topP: config.topP,
            maxTokens: config.maxTokens,
            timeoutMs,
          });
        } else {
          result = await callLlm({
            prompt,
            providerType: config.providerType,
            apiKey: decryptApiKey(config.apiKeyEncrypted, ENCRYPTION_KEY),
            baseUrl: config.baseUrl,
            modelName: config.modelName,
            temperature: config.temperature,
            topP: config.topP,
            maxTokens: config.maxTokens,
            timeoutMs,
          });

          // Check latency threshold — trigger failover on next request if exceeded
          if (config.failover && result.latencyMs > config.failover.latencyThresholdMs) {
            await incrementErrorCount(hash);
          } else {
            // Successful fast call: reset error counter
            await resetErrorCount(hash);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (!useFailover && config.failover) {
          // Increment error counter; try secondary this time
          const newCount = await incrementErrorCount(hash);

          if (newCount >= config.failover.errorThreshold) {
            // Emit failover.triggered to Redis Pub/Sub
            await publisher.publish(
              'failover.triggered',
              JSON.stringify({
                hash,
                deploymentId: config.deploymentId,
                primaryProvider: config.providerType,
                secondaryProvider: config.failover.secondaryProviderType,
                reason: 'error_threshold',
                timestamp: new Date().toISOString(),
              }),
            );
          }

          // Retry immediately with secondary
          try {
            isFailover = true;
            result = await callLlm({
              prompt,
              providerType: config.failover.secondaryProviderType,
              apiKey: decryptApiKey(config.failover.secondaryApiKeyEncrypted, ENCRYPTION_KEY),
              baseUrl: config.failover.secondaryBaseUrl,
              modelName: config.failover.secondaryModelName,
              temperature: config.temperature,
              topP: config.topP,
              maxTokens: config.maxTokens,
              timeoutMs,
            });
          } catch (secondaryErr) {
            const secMsg =
              secondaryErr instanceof Error ? secondaryErr.message : String(secondaryErr);
            req.log.error(
              { hash, primaryError: errorMsg, secondaryError: secMsg },
              'Both providers failed',
            );
            return reply.code(502).send({ error: 'Both primary and secondary providers failed' });
          }
        } else {
          req.log.error({ hash, error: errorMsg }, 'LLM call failed');
          return reply.code(502).send({ error: 'LLM call failed' });
        }
      }

      // 8. Fire-and-forget: persist ApiCallLog
      const costUsd = estimateCostUsd(config.modelName, result.inputTokens, result.outputTokens);
      setImmediate(() => {
        db.query(
          `INSERT INTO api_call_logs
             (id, deployment_id, api_key_id, endpoint_hash, input_tokens, output_tokens,
              latency_ms, status_code, cost_usd, is_failover, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            config.deploymentId,
            apiKeyRecord.id,
            hash,
            result.inputTokens,
            result.outputTokens,
            result.latencyMs,
            200,
            costUsd,
            isFailover,
          ],
        ).catch((e: unknown) => req.log.error({ err: e }, 'Failed to persist ApiCallLog'));
      });

      // 9. Return response
      return {
        output: result.output,
        latency_ms: result.latencyMs,
        tokens: {
          input: result.inputTokens,
          output: result.outputTokens,
        },
        ...(isFailover && { failover: true }),
      };
    },
  );
}
