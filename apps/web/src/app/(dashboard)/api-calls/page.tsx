'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronRight, Activity, CheckCircle2, Clock, Coins } from 'lucide-react';
import { monitoringApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type Env = 'all' | 'dev' | 'staging' | 'prod';

interface ApiCallEndpoint {
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

interface MonitoringSummary {
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

const ENV_BADGE: Record<string, string> = {
  dev: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  staging: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  prod: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
};

function EndpointRow({ endpoint }: { readonly endpoint: ApiCallEndpoint }) {
  const [expanded, setExpanded] = useState(false);
  const successPct = (endpoint.successRate * 100).toFixed(1);
  const isHealthy = endpoint.successRate >= 0.95;

  return (
    <div className="rounded-lg border bg-card">
      <button
        className="flex w-full items-center gap-4 p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{endpoint.promptName ?? '(unnamed prompt)'}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
            {endpoint.endpointHash}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold shrink-0 ${ENV_BADGE[endpoint.environment] ?? ''}`}
        >
          {endpoint.environment.toUpperCase()}
        </span>
        <div className="hidden sm:flex items-center gap-6 shrink-0 text-sm">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{endpoint.totalCalls}</span> calls
          </span>
          <span className={isHealthy ? 'text-green-600' : 'text-red-500'}>
            {successPct}% success
          </span>
          <span className="text-muted-foreground">{endpoint.avgLatencyMs}ms</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Calls</p>
              <p className="text-lg font-bold">{endpoint.totalCalls}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Success / Error</p>
              <p className="text-lg font-bold">
                <span className="text-green-600">{endpoint.successCalls}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-red-500">{endpoint.totalCalls - endpoint.successCalls}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Latency</p>
              <p className="text-lg font-bold">{endpoint.avgLatencyMs}ms</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Cost</p>
              <p className="text-lg font-bold">${endpoint.totalCostUsd.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Tokens</p>
              <p className="text-lg font-bold">{endpoint.totalTokens.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Call</p>
              <p className="text-sm font-medium">
                {endpoint.lastCallAt
                  ? formatDistanceToNow(new Date(endpoint.lastCallAt), { addSuffix: true })
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiCallsPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const [activeEnv, setActiveEnv] = useState<Env>('all');

  const { data: summary, isLoading: summaryLoading } = useQuery<MonitoringSummary>({
    queryKey: ['monitoring-summary-calls', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) throw new Error('No workspace');
      const res = await monitoringApi.summary(activeWorkspace.id, { window: '24h' });
      return res.data as MonitoringSummary;
    },
    enabled: !!activeWorkspace,
    refetchInterval: 30000,
  });

  const { data: endpoints = [], isLoading: endpointsLoading } = useQuery<ApiCallEndpoint[]>({
    queryKey: ['api-calls-breakdown', activeWorkspace?.id, activeEnv],
    queryFn: async () => {
      if (!activeWorkspace) throw new Error('No workspace');
      const res = await monitoringApi.apiCalls(activeWorkspace.id, {
        ...(activeEnv !== 'all' && { environment: activeEnv }),
      });
      return res.data as ApiCallEndpoint[];
    },
    enabled: !!activeWorkspace,
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">API Calls</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-endpoint breakdown for the last 24 hours
        </p>
      </div>

      {/* Summary KPIs */}
      {summaryLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Calls
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary?.totalCalls ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Success Rate
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {((summary?.successRate ?? 1) * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary?.errorCalls ?? 0} errors
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Latency
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary?.avgLatencyMs ?? 0}ms</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Cost
              </CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${(summary?.totalCostUsd ?? 0).toFixed(4)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Env tabs + endpoint list */}
      <Tabs value={activeEnv} onValueChange={(v) => setActiveEnv(v as Env)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="dev">DEV</TabsTrigger>
          <TabsTrigger value="staging">STAGING</TabsTrigger>
          <TabsTrigger value="prod">PROD</TabsTrigger>
        </TabsList>

        {(['all', 'dev', 'staging', 'prod'] as Env[]).map((env) => (
          <TabsContent key={env} value={env} className="mt-4">
            {endpointsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : endpoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                <Activity className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">No API calls recorded</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Calls will appear here once traffic reaches your deployed endpoints.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mb-1">
                  <span>
                    {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}
                  </span>
                  <Badge variant="outline">
                    {activeEnv === 'all' ? 'All envs' : activeEnv.toUpperCase()}
                  </Badge>
                </div>
                {endpoints.map((ep) => (
                  <EndpointRow key={`${ep.endpointHash}-${ep.environment}`} endpoint={ep} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
