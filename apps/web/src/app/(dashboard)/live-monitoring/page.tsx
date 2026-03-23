'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { format } from 'date-fns';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Coins,
  RefreshCw,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { monitoringApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useMonitoringStore } from '@/stores/monitoring.store';
import { useMonitoringSocket } from '@/hooks/useMonitoringSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TimeWindow = '1m' | '5m' | '1h' | '24h' | '7d';

const WINDOW_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: '1m', label: '1 min' },
  { value: '5m', label: '5 min' },
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
];

const ENV_OPTIONS = [
  { value: 'all', label: 'All environments' },
  { value: 'dev', label: 'DEV' },
  { value: 'staging', label: 'STAGING' },
  { value: 'prod', label: 'PROD' },
];

interface KpiCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

function KpiCard({ title, value, sub, icon, trend }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && (
          <p
            className={`text-xs mt-1 ${
              trend === 'up'
                ? 'text-green-600'
                : trend === 'down'
                  ? 'text-red-500'
                  : 'text-muted-foreground'
            }`}
          >
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type MetricKey = 'successRate' | 'avgLatencyMs' | 'totalCalls' | 'totalCostUsd';

const METRIC_CONFIGS: Record<
  MetricKey,
  { label: string; color: string; format: (v: number) => string }
> = {
  successRate: {
    label: 'Success Rate',
    color: '#22c55e',
    format: (v) => `${(v * 100).toFixed(1)}%`,
  },
  avgLatencyMs: {
    label: 'Avg Latency (ms)',
    color: '#3b82f6',
    format: (v) => `${Math.round(v)}ms`,
  },
  totalCalls: { label: 'Total Calls', color: '#a855f7', format: (v) => String(Math.round(v)) },
  totalCostUsd: { label: 'Cost (USD)', color: '#f59e0b', format: (v) => `$${v.toFixed(4)}` },
};

export default function LiveMonitoringPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const { summary, chartData, isConnected, lastUpdated } = useMonitoringStore();

  const [window, setWindow] = useState<TimeWindow>('1h');
  const [environment, setEnvironment] = useState('all');
  const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(['successRate', 'avgLatencyMs']);

  // Connect Socket.io
  useMonitoringSocket(activeWorkspace?.id);

  // REST poll every 5s as fallback / initial load
  const { isLoading, refetch } = useQuery({
    queryKey: ['monitoring-summary', activeWorkspace?.id, window, environment],
    queryFn: async () => {
      if (!activeWorkspace) return null;
      const res = await monitoringApi.summary(activeWorkspace.id, {
        window,
        ...(environment !== 'all' && { environment }),
      });
      const data = res.data as typeof summary;
      if (data) useMonitoringStore.getState().setSummary(data);
      return data;
    },
    enabled: !!activeWorkspace,
    refetchInterval: 5000,
  });

  // Reset store on workspace change
  useEffect(() => {
    useMonitoringStore.getState().reset();
  }, [activeWorkspace?.id]);

  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    );
  };

  const chartPoints = chartData.map((p) => ({
    ...p,
    time: format(new Date(p.timestamp), 'HH:mm:ss'),
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Monitoring</h1>
          <p className="mt-1 text-sm text-muted-foreground">Real-time metrics for your workspace</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={isConnected ? 'success' : 'outline'} className="flex items-center gap-1">
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isConnected ? 'Live' : 'Disconnected'}
          </Badge>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {format(new Date(lastUpdated), 'HH:mm:ss')}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={window} onValueChange={(v) => setWindow(v as TimeWindow)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOW_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={environment} onValueChange={setEnvironment}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENV_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      {isLoading && !summary ? (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            title="Total Calls"
            value={summary?.totalCalls ?? 0}
            icon={<Activity className="h-4 w-4" />}
          />
          <KpiCard
            title="Success Rate"
            value={`${((summary?.successRate ?? 1) * 100).toFixed(1)}%`}
            icon={<CheckCircle2 className="h-4 w-4" />}
            trend={(summary?.successRate ?? 1) >= 0.95 ? 'up' : 'down'}
            sub={`${summary?.successCalls ?? 0} success / ${summary?.errorCalls ?? 0} errors`}
          />
          <KpiCard
            title="Avg Latency"
            value={`${summary?.avgLatencyMs ?? 0}ms`}
            icon={<Clock className="h-4 w-4" />}
            trend={(summary?.avgLatencyMs ?? 0) < 1000 ? 'up' : 'down'}
          />
          <KpiCard
            title="Tokens Used"
            value={(summary?.totalTokens ?? 0).toLocaleString()}
            icon={<Zap className="h-4 w-4" />}
          />
          <KpiCard
            title="Cost (USD)"
            value={`$${(summary?.totalCostUsd ?? 0).toFixed(4)}`}
            icon={<Coins className="h-4 w-4" />}
          />
          <KpiCard
            title="Failovers"
            value={summary?.failoverCalls ?? 0}
            icon={<AlertCircle className="h-4 w-4" />}
            trend={(summary?.failoverCalls ?? 0) === 0 ? 'up' : 'down'}
          />
        </div>
      )}

      {/* Real-time chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Performance Over Time</CardTitle>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(METRIC_CONFIGS) as MetricKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => toggleMetric(key)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    activeMetrics.includes(key)
                      ? 'border-transparent text-white'
                      : 'border-border text-muted-foreground bg-transparent'
                  }`}
                  style={
                    activeMetrics.includes(key)
                      ? { backgroundColor: METRIC_CONFIGS[key].color }
                      : {}
                  }
                >
                  {METRIC_CONFIGS[key].label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartPoints.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Waiting for data…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartPoints} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    const key = name as MetricKey;
                    return [
                      METRIC_CONFIGS[key]?.format(value) ?? value,
                      METRIC_CONFIGS[key]?.label ?? name,
                    ];
                  }}
                />
                <Legend />
                {activeMetrics.map((key) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={METRIC_CONFIGS[key].color}
                    dot={false}
                    strokeWidth={2}
                    name={key}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Recent errors / empty state when success rate is high */}
      {summary && summary.errorCalls > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {summary.errorCalls} error{summary.errorCalls !== 1 ? 's' : ''} detected in the last{' '}
              {WINDOW_OPTIONS.find((o) => o.value === window)?.label ?? window}. Check the{' '}
              <a href="/api-calls" className="text-primary underline">
                API Calls
              </a>{' '}
              page for per-endpoint details.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
