'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3, Copy, ExternalLink, FlaskConical, Globe, Loader2, Zap } from 'lucide-react';
import Link from 'next/link';
import api, { deploymentsApi, apiKeysApi, monitoringApi, agentsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LiveDeployment {
  id: string;
  promptId: string;
  promptName?: string;
  environment: string;
  versionLabel: string;
  endpointHash: string;
  isLive: boolean;
  deployedAt: string;
  prompt?: { name: string; variables?: { name: string }[] };
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
}

// ─── Copy helper ─────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Copied to clipboard');
  };
  return { copy, copied };
}

// ─── API Test Modal ───────────────────────────────────────────────────────────

interface ApiTestModalProps {
  open: boolean;
  onClose: () => void;
  deployment: LiveDeployment;
  apiKeys: ApiKey[];
}

function ApiTestModal({ open, onClose, deployment, apiKeys }: ApiTestModalProps) {
  const variables = deployment.prompt?.variables ?? [];
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [selectedKeyId, setSelectedKeyId] = useState(apiKeys[0]?.id ?? '');
  const [customKey, setCustomKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gatewayUrl = process.env['NEXT_PUBLIC_GATEWAY_URL'] ?? 'http://localhost:3002';
  const endpointUrl = `${gatewayUrl}/api/v1/live/${deployment.endpointHash}`;

  const activeKey =
    customKey.trim() || (apiKeys.find((k) => k.id === selectedKeyId)?.keyPrefix ?? '');

  const quickFill = () => {
    const filled: Record<string, string> = {};
    for (const v of variables) {
      filled[v.name] = `<${v.name}>`;
    }
    setVarValues(filled);
  };

  const runTest = async () => {
    if (!activeKey) {
      toast.error('Enter an API key first');
      return;
    }
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeKey}`,
        },
        body: JSON.stringify({ variables: varValues }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setError(JSON.stringify(data, null, 2));
      } else {
        setResponse(data);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Test — {deployment.prompt?.name ?? deployment.endpointHash}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Endpoint URL */}
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
            <code className="flex-1 text-xs break-all">{endpointUrl}</code>
          </div>

          {/* API Key selector */}
          <div className="space-y-2">
            <Label>API Key</Label>
            {apiKeys.length > 0 && (
              <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a key…" />
                </SelectTrigger>
                <SelectContent>
                  {apiKeys.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name} ({k.keyPrefix}••••)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              placeholder="Or paste full key here"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
            />
          </div>

          {/* Variables */}
          {variables.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Variables</Label>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={quickFill}>
                  Quick Fill
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {variables.map((v) => (
                  <div key={v.name} className="space-y-1">
                    <Label className="text-xs font-mono">{`{{${v.name}}}`}</Label>
                    <Input
                      placeholder={v.name}
                      value={varValues[v.name] ?? ''}
                      onChange={(e) =>
                        setVarValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Send button */}
          <Button className="w-full" disabled={loading} onClick={runTest}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Send Request
          </Button>

          {/* Response viewer */}
          {(response ?? error) && (
            <div className="space-y-1">
              <Label className={error ? 'text-destructive' : undefined}>
                {error ? 'Error' : 'Response'}
              </Label>
              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-all">
                {error ?? JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Endpoint Card ────────────────────────────────────────────────────────────

function EndpointCard({ dep, apiKeys }: { dep: LiveDeployment; apiKeys: ApiKey[] }) {
  const [testOpen, setTestOpen] = useState(false);
  const { copy } = useCopy();
  const gatewayUrl = process.env['NEXT_PUBLIC_GATEWAY_URL'] ?? 'http://localhost:3002';
  const endpointUrl = `${gatewayUrl}/api/v1/live/${dep.endpointHash}`;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base truncate">
                {dep.prompt?.name ?? dep.endpointHash}
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {dep.environment.toUpperCase()} · v{dep.versionLabel}
              </p>
            </div>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 shrink-0 text-xs">
              Live
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-1 rounded-md bg-muted px-2 py-1.5">
            <code className="flex-1 text-xs truncate">{endpointUrl}</code>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={() => copy(endpointUrl, dep.id)}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Deployed {formatDistanceToNow(new Date(dep.deployedAt), { addSuffix: true })}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setTestOpen(true)}
            >
              <FlaskConical className="mr-1 h-3.5 w-3.5" />
              Test
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/api-gateway/${dep.endpointHash}/docs`}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Docs
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <ApiTestModal
        open={testOpen}
        onClose={() => setTestOpen(false)}
        deployment={dep}
        apiKeys={apiKeys}
      />
    </>
  );
}

// ─── Live Agent APIs Tab ──────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  description?: string;
  status: string;
  currentVersion: number;
}

function LiveAgentApisTab({ workspaceId }: { workspaceId: string }) {
  const [testAgentId, setTestAgentId] = useState<string | null>(null);
  const [testInputs, setTestInputs] = useState('{}');
  const [testResult, setTestResult] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['agents-live', workspaceId],
    queryFn: async () => {
      const res = await agentsApi.list(workspaceId);
      return (res.data as Agent[]).filter((a) => a.status === 'live');
    },
    enabled: !!workspaceId,
  });

  const agents = data ?? [];

  const runTest = async () => {
    if (!testAgentId) return;
    try {
      const inputs = JSON.parse(testInputs) as Record<string, unknown>;
      const res = await agentsApi.testRun(workspaceId, testAgentId, inputs);
      setTestResult(JSON.stringify(res.data, null, 2));
    } catch {
      toast.error('Test run failed — check your JSON inputs');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
        <Zap className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-lg font-semibold">No live agents</p>
        <p className="mt-1 text-sm text-muted-foreground">Deploy an agent to see it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {agents.map((agent) => (
        <Card key={agent.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{agent.name}</p>
              {agent.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{agent.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">v{agent.currentVersion}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">live</Badge>
              <Button size="sm" variant="outline" onClick={() => setTestAgentId(agent.id)}>
                <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                Test
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Test modal */}
      <Dialog
        open={!!testAgentId}
        onOpenChange={(o) => {
          if (!o) {
            setTestAgentId(null);
            setTestResult(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Test Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Inputs (JSON)</Label>
              <textarea
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs h-32 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                value={testInputs}
                onChange={(e) => setTestInputs(e.target.value)}
              />
            </div>
            <Button onClick={() => void runTest()} className="w-full">
              Run
            </Button>
            {testResult && (
              <pre className="rounded-md bg-muted p-3 text-xs whitespace-pre-wrap overflow-auto max-h-48">
                {testResult}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApiGatewayPage() {
  const { activeWorkspace } = useWorkspaceStore();

  // Fetch all live deployments across workspace prompts
  const { data: liveDeployments = [], isLoading: depsLoading } = useQuery<LiveDeployment[]>({
    queryKey: ['live-deployments', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return [];
      // List prompts then filter live deployments
      const promptsRes = await api.get(`/api/workspaces/${activeWorkspace.id}/prompts`);
      const prompts = promptsRes.data as {
        id: string;
        name: string;
        variables?: { name: string }[];
      }[];

      const results: LiveDeployment[] = [];
      await Promise.all(
        prompts.map(async (p) => {
          try {
            const depRes = await deploymentsApi.list(p.id);
            const envMap = depRes.data as Record<string, LiveDeployment | null>;
            for (const dep of Object.values(envMap)) {
              if (dep?.isLive && dep.endpointHash) {
                results.push({ ...dep, prompt: { name: p.name, variables: p.variables ?? [] } });
              }
            }
          } catch {
            /* skip */
          }
        }),
      );
      return results;
    },
    enabled: !!activeWorkspace,
  });

  const { data: apiKeys = [], isLoading: keysLoading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return [];
      const res = await apiKeysApi.list(activeWorkspace.id, 'active');
      return res.data as ApiKey[];
    },
    enabled: !!activeWorkspace,
  });

  interface TimeseriesBucket {
    bucket: string;
    calls: number;
    successCalls: number;
    avgLatencyMs: number;
    totalTokens: number;
    totalCostUsd: number;
  }

  interface ApiCallEndpoint {
    endpointHash: string;
    promptName: string | null;
    environment: string;
    totalCalls: number;
    avgLatencyMs: number;
    totalCostUsd: number;
  }

  const { data: timeseries = [] } = useQuery<TimeseriesBucket[]>({
    queryKey: ['gateway-timeseries', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return [];
      const res = await monitoringApi.timeseries(activeWorkspace.id, { bucket: '1h' });
      return res.data as TimeseriesBucket[];
    },
    enabled: !!activeWorkspace,
    refetchInterval: 60_000,
  });

  const { data: topEndpoints = [] } = useQuery<ApiCallEndpoint[]>({
    queryKey: ['gateway-api-calls', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return [];
      const res = await monitoringApi.apiCalls(activeWorkspace.id);
      return (res.data as ApiCallEndpoint[]).slice(0, 10);
    },
    enabled: !!activeWorkspace,
    refetchInterval: 60_000,
  });

  const chartTimeseries = timeseries.map((b) => ({
    ...b,
    time: format(new Date(b.bucket), 'HH:mm'),
    costUsd: b.totalCostUsd,
  }));

  const isLoading = depsLoading || keysLoading;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">API Gateway</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live endpoints powered by the Fastify gateway
        </p>
      </div>

      <Tabs defaultValue="prompt-apis">
        <TabsList>
          <TabsTrigger value="prompt-apis">
            <Globe className="mr-2 h-4 w-4" />
            Live Prompt APIs
          </TabsTrigger>
          <TabsTrigger value="agent-apis">
            <Zap className="mr-2 h-4 w-4" />
            Live Agent APIs
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Prompt APIs */}
        <TabsContent value="prompt-apis" className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-lg" />
              ))}
            </div>
          ) : liveDeployments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
              <Globe className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-lg font-semibold">No live endpoints</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Deploy a prompt and click &quot;Go Live&quot; to create an endpoint
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {liveDeployments.map((dep) => (
                <EndpointCard key={dep.id} dep={dep} apiKeys={apiKeys} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics" className="mt-4">
          <div className="space-y-6">
            {/* Calls over time */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Calls Over Time (1h buckets)</CardTitle>
              </CardHeader>
              <CardContent>
                {chartTimeseries.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    No traffic data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={chartTimeseries}
                      margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="calls"
                        stroke="#3b82f6"
                        dot={false}
                        strokeWidth={2}
                        name="Calls"
                      />
                      <Line
                        type="monotone"
                        dataKey="successCalls"
                        stroke="#22c55e"
                        dot={false}
                        strokeWidth={2}
                        name="Success"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Cost per bucket */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cost Per Hour (USD)</CardTitle>
              </CardHeader>
              <CardContent>
                {chartTimeseries.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    No cost data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={chartTimeseries}
                      margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => `$${v.toFixed(3)}`}
                      />
                      <Tooltip formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']} />
                      <Bar dataKey="costUsd" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Cost" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Latency histogram (avg per bucket) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Avg Latency (ms)</CardTitle>
              </CardHeader>
              <CardContent>
                {chartTimeseries.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    No latency data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={chartTimeseries}
                      margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}ms`} />
                      <Tooltip formatter={(v: number) => [`${v}ms`, 'Avg Latency']} />
                      <Bar
                        dataKey="avgLatencyMs"
                        fill="#a855f7"
                        radius={[3, 3, 0, 0]}
                        name="Avg Latency"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Top endpoints */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Endpoints by Call Volume</CardTitle>
              </CardHeader>
              <CardContent>
                {topEndpoints.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No endpoint data yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {topEndpoints.map((ep) => (
                      <div
                        key={`${ep.endpointHash}-${ep.environment}`}
                        className="flex items-center gap-3 text-sm rounded-md border p-3"
                      >
                        <span className="font-mono text-xs text-muted-foreground truncate flex-1">
                          {ep.promptName ?? ep.endpointHash}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {ep.environment}
                        </Badge>
                        <span className="shrink-0 font-medium">{ep.totalCalls} calls</span>
                        <span className="shrink-0 text-muted-foreground">{ep.avgLatencyMs}ms</span>
                        <span className="shrink-0 text-muted-foreground">
                          ${ep.totalCostUsd.toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Agent APIs */}
        <TabsContent value="agent-apis" className="mt-4">
          <LiveAgentApisTab workspaceId={activeWorkspace?.id ?? ''} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
