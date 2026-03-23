'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ExternalLink, Lightbulb, AlertTriangle, TrendingUp } from 'lucide-react';
import { monitoringApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface EvalResult {
  metricName: string;
  score: number;
  grade: string | null;
}

interface EvalJob {
  id: string;
  grade: string | null;
  status: string;
  modelName: string;
  metrics: string[];
  completedAt: string | null;
  createdAt: string;
  results: EvalResult[];
}

interface Kpis {
  avgAccuracy: number | null;
  avgF1: number | null;
  avgConsistency: number | null;
  avgEfficiency: number | null;
  totalJobs: number;
  completedJobs: number;
}

interface PromptAnalytics {
  promptId: string;
  kpis: Kpis;
  jobs: EvalJob[];
}

interface OptimizationSuggestions {
  promptId: string;
  suggestions: string[];
  configWarnings: string[];
  improvedPrompt: string | null;
  cachedAt: string;
}

const GRADE_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  A: 'success',
  B: 'success',
  C: 'warning',
  D: 'destructive',
  F: 'destructive',
};

const METRIC_COLORS: Record<string, string> = {
  accuracy: '#22c55e',
  f1: '#3b82f6',
  consistency: '#a855f7',
  efficiency: '#f59e0b',
  bleu: '#14b8a6',
  rouge: '#f43f5e',
  bertscore: '#6366f1',
};

function getMetricColor(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(METRIC_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#94a3b8';
}

function KpiPill({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col items-center rounded-lg border p-3 text-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-bold mt-1">
        {value !== null ? `${(value * 100).toFixed(1)}%` : '—'}
      </span>
    </div>
  );
}

interface Props {
  readonly promptId: string;
}

export function AnalyticsTab({ promptId }: Props) {
  const { data: analytics, isLoading: analyticsLoading } = useQuery<PromptAnalytics>({
    queryKey: ['prompt-analytics', promptId],
    queryFn: async () => {
      const res = await monitoringApi.promptAnalytics(promptId);
      return res.data as PromptAnalytics;
    },
  });

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery<OptimizationSuggestions>({
    queryKey: ['prompt-suggestions', promptId],
    queryFn: async () => {
      const res = await monitoringApi.suggestions(promptId);
      return res.data as OptimizationSuggestions;
    },
  });

  // Build chart data — one point per completed job
  const completedJobs = analytics?.jobs.filter((j) => j.status === 'completed') ?? [];
  const allMetricNames = [
    ...new Set(completedJobs.flatMap((j) => j.results.map((r) => r.metricName))),
  ];

  const chartData = completedJobs.map((job) => {
    const point: Record<string, string | number> = {
      label: job.completedAt
        ? formatDistanceToNow(new Date(job.completedAt), { addSuffix: true })
        : job.id.slice(0, 8),
    };
    for (const r of job.results) {
      point[r.metricName] = r.score;
    }
    return point;
  });

  if (analyticsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const kpis = analytics?.kpis;

  return (
    <div className="space-y-6">
      {/* KPI header */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiPill label="Avg Accuracy" value={kpis?.avgAccuracy ?? null} />
        <KpiPill label="Avg F1" value={kpis?.avgF1 ?? null} />
        <KpiPill label="Avg Consistency" value={kpis?.avgConsistency ?? null} />
        <KpiPill label="Avg Efficiency" value={kpis?.avgEfficiency ?? null} />
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          <strong className="text-foreground">{kpis?.completedJobs ?? 0}</strong> completed /{' '}
          {kpis?.totalJobs ?? 0} total evaluations
        </span>
        <Link href={`/prompt-analytics/${promptId}`}>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-3 w-3 mr-1" />
            Full Analytics
          </Button>
        </Link>
      </div>

      {/* Performance chart */}
      {chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Evaluation Scores Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${(value * 100).toFixed(2)}%`,
                    name,
                  ]}
                />
                <Legend />
                {allMetricNames.map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={getMetricColor(name)}
                    dot={{ r: 4 }}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No evaluation data yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Run an evaluation to see performance trends here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent evaluations table */}
      {analytics && analytics.jobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Evaluations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.jobs.slice(0, 8).map((job) => (
                <div key={job.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                  {job.grade && (
                    <Badge
                      variant={GRADE_VARIANT[job.grade] ?? 'outline'}
                      className="w-8 justify-center shrink-0"
                    >
                      {job.grade}
                    </Badge>
                  )}
                  <span className="font-mono text-xs text-muted-foreground shrink-0">
                    {job.modelName}
                  </span>
                  <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                    {job.results.map((r) => (
                      <span
                        key={r.metricName}
                        className="text-xs rounded px-1 py-0.5 bg-muted"
                        title={r.metricName}
                      >
                        {r.metricName.split('_')[0]}: {(r.score * 100).toFixed(1)}%
                      </span>
                    ))}
                  </div>
                  <Badge
                    variant={
                      job.status === 'completed'
                        ? 'success'
                        : job.status === 'failed'
                          ? 'destructive'
                          : 'outline'
                    }
                    className="shrink-0 text-xs"
                  >
                    {job.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {job.completedAt
                      ? formatDistanceToNow(new Date(job.completedAt), { addSuffix: true })
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optimization suggestions */}
      {suggestionsLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : suggestions &&
        (suggestions.suggestions.length > 0 || suggestions.configWarnings.length > 0) ? (
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Lightbulb className="h-4 w-4" />
              AI Optimization Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.configWarnings.length > 0 && (
              <div className="space-y-1">
                {suggestions.configWarnings.map((w) => (
                  <div key={w} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
            <ul className="space-y-1">
              {suggestions.suggestions.map((s) => (
                <li key={s} className="flex items-start gap-2 text-sm">
                  <span className="text-amber-500 shrink-0">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            {suggestions.improvedPrompt && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-primary">
                  Show improved prompt suggestion
                </summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs font-mono">
                  {suggestions.improvedPrompt}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
