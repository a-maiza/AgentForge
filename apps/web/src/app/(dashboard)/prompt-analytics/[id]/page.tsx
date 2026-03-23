'use client';

import { use, useState } from 'react';
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
import { ArrowLeft, Lightbulb, AlertTriangle } from 'lucide-react';
import { monitoringApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

function CustomTooltip({
  active,
  payload,
  label,
  jobsById,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  jobsById: Record<string, EvalJob>;
}) {
  if (!active || !payload?.length) return null;
  const job = label ? jobsById[label] : undefined;
  return (
    <div className="rounded-lg border bg-popover p-3 shadow-md text-sm min-w-40">
      {job && (
        <p className="font-medium mb-2 font-mono text-xs text-muted-foreground">{job.modelName}</p>
      )}
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between gap-4">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-medium">{(entry.value * 100).toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function PromptAnalyticsPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id: promptId } = use(params);
  const [modelFilter, setModelFilter] = useState<string>('all');

  const { data: analytics, isLoading } = useQuery<PromptAnalytics>({
    queryKey: ['prompt-analytics', promptId],
    queryFn: async () => {
      const res = await monitoringApi.promptAnalytics(promptId);
      return res.data as PromptAnalytics;
    },
  });

  const { data: suggestions } = useQuery<OptimizationSuggestions>({
    queryKey: ['prompt-suggestions', promptId],
    queryFn: async () => {
      const res = await monitoringApi.suggestions(promptId);
      return res.data as OptimizationSuggestions;
    },
  });

  const allModels = [...new Set(analytics?.jobs.map((j) => j.modelName) ?? [])];

  const completedJobs = (analytics?.jobs ?? []).filter(
    (j) => j.status === 'completed' && (modelFilter === 'all' || j.modelName === modelFilter),
  );

  const allMetricNames = [
    ...new Set(completedJobs.flatMap((j) => j.results.map((r) => r.metricName))),
  ];

  const jobsById: Record<string, EvalJob> = {};
  for (const j of analytics?.jobs ?? []) jobsById[j.id.slice(0, 8)] = j;

  const chartData = completedJobs.map((job) => {
    const point: Record<string, string | number> = { id: job.id.slice(0, 8) };
    for (const r of job.results) point[r.metricName] = r.score;
    return point;
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const kpis = analytics?.kpis;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/prompts/${promptId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Prompt Analytics</h1>
          <p className="text-sm text-muted-foreground font-mono">{promptId}</p>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Avg Accuracy', value: kpis?.avgAccuracy },
          { label: 'Avg F1', value: kpis?.avgF1 },
          { label: 'Avg Consistency', value: kpis?.avgConsistency },
          { label: 'Avg Efficiency', value: kpis?.avgEfficiency },
          { label: 'Completed', value: null, raw: kpis?.completedJobs ?? 0 },
          { label: 'Total Jobs', value: null, raw: kpis?.totalJobs ?? 0 },
        ].map(({ label, value, raw }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold mt-1">
                {value !== undefined && value !== null
                  ? `${(value * 100).toFixed(1)}%`
                  : (raw ?? '—')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + model filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Evaluation Scores by Run</CardTitle>
            <Select value={modelFilter} onValueChange={setModelFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All models" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All models</SelectItem>
                {allModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              No completed evaluations yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="id" tick={{ fontSize: 11 }} />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip jobsById={jobsById} />} />
                <Legend />
                {allMetricNames.map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={getMetricColor(name)}
                    dot={{ r: 4 }}
                    strokeWidth={2}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* All evaluations tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Evaluations</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({analytics?.jobs.length ?? 0})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({kpis?.completedJobs ?? 0})</TabsTrigger>
              <TabsTrigger value="failed">
                Failed ({(analytics?.jobs ?? []).filter((j) => j.status === 'failed').length})
              </TabsTrigger>
            </TabsList>

            {(['all', 'completed', 'failed'] as const).map((tab) => {
              const filtered = (analytics?.jobs ?? []).filter((j) => {
                if (tab === 'all') return true;
                return j.status === tab;
              });
              return (
                <TabsContent key={tab} value={tab} className="mt-3">
                  <div className="space-y-2">
                    {filtered.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No {tab === 'all' ? '' : tab} evaluations
                      </p>
                    ) : (
                      filtered.map((job) => (
                        <div
                          key={job.id}
                          className="flex items-center gap-3 rounded-md border p-3 text-sm"
                        >
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
                              >
                                {r.metricName.split('_').at(0)}: {(r.score * 100).toFixed(1)}%
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
                              : formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* AI Suggestions */}
      {suggestions &&
        (suggestions.suggestions.length > 0 || suggestions.configWarnings.length > 0) && (
          <Card className="border-amber-200 dark:border-amber-900">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Lightbulb className="h-4 w-4" />
                AI Optimization Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {suggestions.configWarnings.map((w) => (
                <div key={w} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                  <span>{w}</span>
                </div>
              ))}
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
        )}
    </div>
  );
}
