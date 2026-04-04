import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import type {
  SummaryQueryDto,
  TimeseriesQueryDto,
  ApiCallsQueryDto,
  TimeWindow,
  TimeBucket,
  DeploymentEnv,
} from './dto/monitoring-query.dto';

const WORKER_URL = process.env['WORKER_URL'] ?? 'http://worker:8000';
const SUMMARY_TTL_S = 5;
const SUGGESTIONS_TTL_S = 300; // 5 minutes

// ─── Redis URL helper ─────────────────────────────────────────────────────────

function redisConnection(): { host: string; port: number } {
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const parsed = new URL(url);
  return { host: parsed.hostname, port: Number(parsed.port) || 6379 };
}

// ─── Window → interval ───────────────────────────────────────────────────────

function windowToDate(window: TimeWindow): Date {
  const ms: Record<TimeWindow, number> = {
    '1m': 60_000,
    '5m': 5 * 60_000,
    '1h': 60 * 60_000,
    '24h': 24 * 60 * 60_000,
    '7d': 7 * 24 * 60 * 60_000,
  };
  return new Date(Date.now() - ms[window]);
}

function bucketToPgInterval(bucket: TimeBucket): string {
  const map: Record<TimeBucket, string> = {
    '1m': '1 minute',
    '5m': '5 minutes',
    '15m': '15 minutes',
    '1h': '1 hour',
  };
  return map[bucket];
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonitoringSummary {
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  successRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  failoverCalls: number;
  windowStart: string;
}

export interface TimeseriesBucket {
  bucket: string;
  calls: number;
  successCalls: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface ApiCallEndpoint {
  endpointHash: string;
  promptName: string | null;
  environment: string;
  totalCalls: number;
  successCalls: number;
  successRate: number;
  avgLatencyMs: number;
  lastCallAt: string | null;
  totalCostUsd: number;
  totalTokens: number;
}

export interface PromptAnalytics {
  promptId: string;
  kpis: {
    avgAccuracy: number | null;
    avgF1: number | null;
    avgConsistency: number | null;
    avgEfficiency: number | null;
    totalJobs: number;
    completedJobs: number;
  };
  jobs: {
    id: string;
    grade: string | null;
    status: string;
    modelName: string;
    metrics: string[];
    completedAt: string | null;
    createdAt: string;
    results: { metricName: string; score: number; grade: string | null }[];
  }[];
}

export interface OptimizationSuggestions {
  promptId: string;
  suggestions: string[];
  configWarnings: string[];
  improvedPrompt: string | null;
  cachedAt: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly redis: Redis;

  constructor(private readonly prisma: PrismaService) {
    const { host, port } = redisConnection();
    this.redis = new Redis({ host, port, lazyConnect: true });
    this.redis.on('error', (err: Error) => {
      this.logger.warn(`Redis error: ${err.message}`);
    });
  }

  onModuleDestroy() {
    void this.redis.quit();
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  async getSummary(workspaceId: string, dto: SummaryQueryDto): Promise<MonitoringSummary> {
    const cacheKey = `monitoring:summary:${workspaceId}:${dto.window ?? '1h'}:${dto.environment ?? 'all'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as MonitoringSummary;

    const windowStart = windowToDate(dto.window ?? '1h');

    const where = {
      createdAt: { gte: windowStart },
      deployment: {
        ...(dto.environment ? { environment: dto.environment as DeploymentEnv } : {}),
        prompt: { workspaceId },
      },
    } as const;

    const [total, success, failover, agg] = await Promise.all([
      this.prisma.apiCallLog.count({ where }),
      this.prisma.apiCallLog.count({ where: { ...where, statusCode: { lt: 400 } } }),
      this.prisma.apiCallLog.count({ where: { ...where, isFailover: true } }),
      this.prisma.apiCallLog.aggregate({
        where,
        _avg: { latencyMs: true },
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      }),
    ]);

    const summary: MonitoringSummary = {
      totalCalls: total,
      successCalls: success,
      errorCalls: total - success,
      successRate: total > 0 ? success / total : 1,
      avgLatencyMs: Math.round(agg._avg.latencyMs ?? 0),
      totalTokens: (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0),
      totalCostUsd: Number((agg._sum.costUsd ?? 0).toFixed(6)),
      failoverCalls: failover,
      windowStart: windowStart.toISOString(),
    };

    await this.redis.setex(cacheKey, SUMMARY_TTL_S, JSON.stringify(summary));
    return summary;
  }

  // ─── Timeseries ────────────────────────────────────────────────────────────

  async getTimeseries(workspaceId: string, dto: TimeseriesQueryDto): Promise<TimeseriesBucket[]> {
    const to = dto.to ? new Date(dto.to) : new Date();
    const from = dto.from ? new Date(dto.from) : new Date(Date.now() - 24 * 60 * 60_000);
    const pgInterval = bucketToPgInterval(dto.bucket ?? '5m');

    type RawRow = {
      bucket: Date;
      calls: bigint;
      success_calls: bigint;
      avg_latency_ms: number | null;
      total_tokens: bigint;
      total_cost_usd: number | null;
    };

    const envFilter = dto.environment
      ? Prisma.sql`AND d.environment = ${dto.environment}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<RawRow[]>`
      SELECT
        date_trunc(${pgInterval}, acl.created_at) AS bucket,
        COUNT(*)                                   AS calls,
        COUNT(*) FILTER (WHERE acl.status_code < 400) AS success_calls,
        AVG(acl.latency_ms)                        AS avg_latency_ms,
        SUM(acl.input_tokens + acl.output_tokens)  AS total_tokens,
        SUM(acl.cost_usd)                          AS total_cost_usd
      FROM api_call_logs acl
      JOIN deployments d  ON acl.deployment_id = d.id
      JOIN prompts     p  ON d.prompt_id       = p.id
      WHERE p.workspace_id = ${workspaceId}::uuid
        AND acl.created_at BETWEEN ${from} AND ${to}
        ${envFilter}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return rows.map((r) => ({
      bucket: r.bucket.toISOString(),
      calls: Number(r.calls),
      successCalls: Number(r.success_calls),
      avgLatencyMs: Math.round(r.avg_latency_ms ?? 0),
      totalTokens: Number(r.total_tokens ?? 0),
      totalCostUsd: Number((r.total_cost_usd ?? 0).toFixed(6)),
    }));
  }

  // ─── API calls breakdown ────────────────────────────────────────────────────

  async getApiCallsBreakdown(
    workspaceId: string,
    dto: ApiCallsQueryDto,
  ): Promise<ApiCallEndpoint[]> {
    type RawRow = {
      endpoint_hash: string;
      prompt_name: string | null;
      environment: string;
      total_calls: bigint;
      success_calls: bigint;
      avg_latency_ms: number | null;
      last_call_at: Date | null;
      total_cost_usd: number | null;
      total_tokens: bigint;
    };

    const envFilter = dto.environment
      ? Prisma.sql`AND d.environment = ${dto.environment}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<RawRow[]>`
      SELECT
        acl.endpoint_hash,
        p.name                                          AS prompt_name,
        d.environment::text                             AS environment,
        COUNT(*)                                        AS total_calls,
        COUNT(*) FILTER (WHERE acl.status_code < 400)  AS success_calls,
        AVG(acl.latency_ms)                             AS avg_latency_ms,
        MAX(acl.created_at)                             AS last_call_at,
        SUM(acl.cost_usd)                               AS total_cost_usd,
        SUM(acl.input_tokens + acl.output_tokens)       AS total_tokens
      FROM api_call_logs acl
      JOIN deployments d ON acl.deployment_id = d.id
      JOIN prompts     p ON d.prompt_id       = p.id
      WHERE p.workspace_id = ${workspaceId}::uuid
        ${envFilter}
      GROUP BY acl.endpoint_hash, p.name, d.environment
      ORDER BY total_calls DESC
    `;

    return rows.map((r) => {
      const total = Number(r.total_calls);
      const success = Number(r.success_calls);
      return {
        endpointHash: r.endpoint_hash,
        promptName: r.prompt_name,
        environment: r.environment,
        totalCalls: total,
        successCalls: success,
        successRate: total > 0 ? success / total : 1,
        avgLatencyMs: Math.round(r.avg_latency_ms ?? 0),
        lastCallAt: r.last_call_at?.toISOString() ?? null,
        totalCostUsd: Number((r.total_cost_usd ?? 0).toFixed(6)),
        totalTokens: Number(r.total_tokens ?? 0),
      };
    });
  }

  // ─── Prompt analytics ──────────────────────────────────────────────────────

  async getPromptAnalytics(promptId: string): Promise<PromptAnalytics> {
    const jobs = await this.prisma.evaluationJob.findMany({
      where: { promptId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        results: { select: { metricName: true, score: true, grade: true } },
      },
    });

    // Aggregate KPIs across completed jobs
    const completed = jobs.filter((j) => j.status === 'completed');
    const avgScore = (metricKey: string): number | null => {
      const scores = completed.flatMap((j) =>
        j.results.filter((r) => r.metricName.toLowerCase().includes(metricKey)).map((r) => r.score),
      );
      if (scores.length === 0) return null;
      return Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(4));
    };

    return {
      promptId,
      kpis: {
        avgAccuracy: avgScore('accuracy'),
        avgF1: avgScore('f1'),
        avgConsistency: avgScore('consistency'),
        avgEfficiency: avgScore('efficiency'),
        totalJobs: jobs.length,
        completedJobs: completed.length,
      },
      jobs: jobs.map((j) => ({
        id: j.id,
        grade: j.grade,
        status: j.status,
        modelName: j.modelName,
        metrics: j.metrics,
        completedAt: j.completedAt?.toISOString() ?? null,
        createdAt: j.createdAt.toISOString(),
        results: j.results,
      })),
    };
  }

  // ─── AI optimization suggestions ──────────────────────────────────────────

  async getOptimizationSuggestions(
    promptId: string,
    lastN: number,
  ): Promise<OptimizationSuggestions> {
    const cacheKey = `monitoring:suggestions:${promptId}:${lastN}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as OptimizationSuggestions;

    const prompt = await this.prisma.prompt.findUnique({
      where: { id: promptId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');

    const jobs = await this.prisma.evaluationJob.findMany({
      where: { promptId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      take: lastN,
      include: { results: true },
    });

    const promptContent = prompt.versions[0]?.content ?? '';
    const evalSummary = jobs.map((j) => ({
      model: j.modelName,
      grade: j.grade,
      metrics: j.results.map((r) => ({ name: r.metricName, score: r.score })),
    }));

    let suggestions: OptimizationSuggestions;
    try {
      const res = await fetch(`${WORKER_URL}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_content: promptContent, eval_summary: evalSummary }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          suggestions: string[];
          config_warnings: string[];
          improved_prompt: string | null;
        };
        suggestions = {
          promptId,
          suggestions: data.suggestions ?? [],
          configWarnings: data.config_warnings ?? [],
          improvedPrompt: data.improved_prompt ?? null,
          cachedAt: new Date().toISOString(),
        };
      } else {
        suggestions = this._fallbackSuggestions(promptId, jobs);
      }
    } catch {
      suggestions = this._fallbackSuggestions(promptId, jobs);
    }

    await this.redis.setex(cacheKey, SUGGESTIONS_TTL_S, JSON.stringify(suggestions));
    return suggestions;
  }

  private _fallbackSuggestions(
    promptId: string,
    jobs: { grade: string | null; results: { metricName: string; score: number }[] }[],
  ): OptimizationSuggestions {
    const warnings: string[] = [];
    const allScores = jobs.flatMap((j) => j.results);
    const low = allScores.filter((r) => r.score < 0.5);
    if (low.length > 0) {
      const names = [...new Set(low.map((r) => r.metricName))].slice(0, 3).join(', ');
      warnings.push(`Low scores detected for: ${names}. Consider refining the prompt.`);
    }
    const poorGrades = jobs.filter((j) => j.grade && ['D', 'F'].includes(j.grade)).length;
    if (poorGrades > 0) {
      warnings.push(
        `${poorGrades} evaluation(s) received a poor grade. Review prompt instructions for clarity.`,
      );
    }
    return {
      promptId,
      suggestions: warnings.length
        ? warnings
        : ['No significant issues detected. Keep monitoring evaluation scores.'],
      configWarnings: [],
      improvedPrompt: null,
      cachedAt: new Date().toISOString(),
    };
  }

  // ─── Publish metrics event (called by gateway or other services) ───────────

  async publishMetrics(workspaceId: string, payload: MonitoringSummary): Promise<void> {
    await this.redis.publish(
      `metrics.workspace.${workspaceId}`,
      JSON.stringify({ workspaceId, metrics: payload, timestamp: new Date().toISOString() }),
    );
  }
}
