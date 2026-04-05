/**
 * AgentForge k6 Load Test
 *
 * Targets:
 *   - p(95) latency < 200 ms
 *   - error rate < 0.1%
 *
 * Usage:
 *   k6 run k6/load-test.js \
 *     -e BASE_URL=https://staging.agentforge.example.com \
 *     -e K6_API_TOKEN=<bearer-token>
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ─────────────────────────────────────────────────────────────
const errorRate = new Rate('error_rate');
const promptListLatency = new Trend('prompt_list_latency', true);
const datasetListLatency = new Trend('dataset_list_latency', true);

// ── Test configuration ─────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Warm-up: ramp to 10 VUs
    { duration: '2m', target: 50 },    // Peak: ramp to 50 VUs
    { duration: '30s', target: 0 },    // Cool-down: ramp back to 0
  ],
  thresholds: {
    // Overall p95 latency must stay under 200 ms
    http_req_duration: ['p(95)<200'],
    // Error rate must stay below 0.1%
    error_rate: ['rate<0.001'],
    // Per-endpoint latency budgets
    prompt_list_latency: ['p(95)<200'],
    dataset_list_latency: ['p(95)<200'],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TOKEN = __ENV.K6_API_TOKEN || '';
const WORKSPACE_ID = __ENV.K6_WORKSPACE_ID || 'ws-test';

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };
}

// ── Scenario ───────────────────────────────────────────────────────────────────
export default function () {
  // 1. Health check
  const health = http.get(`${BASE_URL}/api/health`, { headers: headers() });
  const healthOk = check(health, {
    'health status 200': (r) => r.status === 200,
  });
  errorRate.add(!healthOk);

  // 2. List prompts
  const t0 = Date.now();
  const prompts = http.get(
    `${BASE_URL}/api/workspaces/${WORKSPACE_ID}/prompts?take=10`,
    { headers: headers() },
  );
  promptListLatency.add(Date.now() - t0);
  const promptsOk = check(prompts, {
    'prompts list 200': (r) => r.status === 200,
    'prompts has items array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).items);
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!promptsOk);

  // 3. List datasets
  const t1 = Date.now();
  const datasets = http.get(
    `${BASE_URL}/api/workspaces/${WORKSPACE_ID}/datasets?take=10`,
    { headers: headers() },
  );
  datasetListLatency.add(Date.now() - t1);
  const datasetsOk = check(datasets, {
    'datasets list 200': (r) => r.status === 200,
  });
  errorRate.add(!datasetsOk);

  // 4. List evaluations
  const evals = http.get(
    `${BASE_URL}/api/workspaces/${WORKSPACE_ID}/evaluations?take=10`,
    { headers: headers() },
  );
  const evalsOk = check(evals, {
    'evaluations list 200': (r) => r.status === 200,
  });
  errorRate.add(!evalsOk);

  // Think-time between iterations: simulate realistic user pacing
  sleep(1);
}

// ── Summary ────────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'];
  const errRate = data.metrics.error_rate?.values?.rate;

  return {
    stdout: [
      '',
      '─────── AgentForge Load Test Summary ──────────────',
      `  p(95) latency : ${p95 !== undefined ? p95.toFixed(1) + ' ms' : 'n/a'} (threshold: < 200 ms)`,
      `  error rate    : ${errRate !== undefined ? (errRate * 100).toFixed(3) + '%' : 'n/a'} (threshold: < 0.1%)`,
      '────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  };
}
