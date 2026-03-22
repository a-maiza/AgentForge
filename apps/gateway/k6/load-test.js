/**
 * k6 load test for the AgentForge Fastify Gateway
 * Target: POST /api/v1/live/:hash — 1 000 req/s sustained
 *
 * Usage:
 *   k6 run k6/load-test.js
 *   k6 run --vus 100 --duration 60s k6/load-test.js
 *
 * Set env vars before running:
 *   GATEWAY_URL   — e.g. http://localhost:3002 (default)
 *   ENDPOINT_HASH — a live endpoint hash from your deployment
 *   API_KEY       — a valid sk_ws_* or sk_org_* key
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────

const errorRate = new Rate('error_rate');
const latencyTrend = new Trend('llm_latency_ms', true);

// ── Options ───────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    sustained_load: {
      executor: 'constant-arrival-rate',
      rate: 1000, // 1 000 req/s
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 200,
      maxVUs: 500,
    },
  },
  thresholds: {
    // Gateway overhead (not LLM latency) should be fast
    http_req_duration: ['p(95)<500'], // 95th percentile < 500 ms gateway overhead
    error_rate: ['rate<0.001'], // < 0.1% error rate
    http_req_failed: ['rate<0.001'],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const GATEWAY_URL = __ENV.GATEWAY_URL || 'http://localhost:3002';
const ENDPOINT_HASH = __ENV.ENDPOINT_HASH || 'test-hash-replace-me';
const API_KEY = __ENV.API_KEY || 'sk_ws_replace-me';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_KEY}`,
};

// ── Default scenario ──────────────────────────────────────────────────────────

export default function () {
  const payload = JSON.stringify({
    variables: {
      topic: 'cloud computing',
      format: 'paragraph',
    },
  });

  const res = http.post(`${GATEWAY_URL}/api/v1/live/${ENDPOINT_HASH}`, payload, {
    headers,
    timeout: '35s', // Slightly above the gateway's 30 s LLM timeout
  });

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'has output field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.output === 'string';
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!ok);

  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      if (typeof body.latency_ms === 'number') {
        latencyTrend.add(body.latency_ms);
      }
    } catch {
      // ignore parse errors
    }
  }

  sleep(0); // No sleep — rely on arrival-rate executor for pacing
}

// ── Setup: health check ───────────────────────────────────────────────────────

export function setup() {
  const res = http.get(`${GATEWAY_URL}/ready`);
  if (res.status !== 200) {
    throw new Error(`Gateway not ready: ${res.status} ${res.body}`);
  }
  console.log('Gateway is ready. Starting load test at 1 000 req/s...');
}
