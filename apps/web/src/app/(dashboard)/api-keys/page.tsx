'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { BarChart2, Copy, Eye, EyeOff, KeyRound, Plus, Trash2, XCircle } from 'lucide-react';
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
import { apiKeysApi, monitoringApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scope: string;
  status: string;
  rateLimitPerMin: number;
  rateLimitPerDay: number;
  usageCount: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface CreateKeyResponse extends ApiKey {
  fullKey?: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  active: 'success',
  expired: 'warning',
  disabled: 'destructive',
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copy}>
      <Copy className="h-3.5 w-3.5" />
      <span className="sr-only">{copied ? 'Copied!' : 'Copy'}</span>
    </Button>
  );
}

// ─── Usage analytics modal ────────────────────────────────────────────────────

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
  successCalls: number;
  successRate: number;
  avgLatencyMs: number;
}

function UsageModal({
  apiKey,
  workspaceId,
  onClose,
}: {
  readonly apiKey: ApiKey;
  readonly workspaceId: string;
  readonly onClose: () => void;
}) {
  const { data: timeseries = [] } = useQuery<TimeseriesBucket[]>({
    queryKey: ['key-usage-timeseries', workspaceId],
    queryFn: async () => {
      const res = await monitoringApi.timeseries(workspaceId, { bucket: '1h' });
      return res.data as TimeseriesBucket[];
    },
  });

  const { data: endpoints = [] } = useQuery<ApiCallEndpoint[]>({
    queryKey: ['key-usage-endpoints', workspaceId],
    queryFn: async () => {
      const res = await monitoringApi.apiCalls(workspaceId);
      return (res.data as ApiCallEndpoint[]).slice(0, 5);
    },
  });

  const chartData = timeseries.map((b) => ({
    time: format(new Date(b.bucket), 'HH:mm'),
    calls: b.calls,
    success: b.successCalls,
    errors: b.calls - b.successCalls,
  }));

  const totalCalls = timeseries.reduce((s, b) => s + b.calls, 0);
  const totalSuccess = timeseries.reduce((s, b) => s + b.successCalls, 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Usage — {apiKey.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Key meta */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total Calls (24h)</p>
              <p className="text-xl font-bold mt-1">{apiKey.usageCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Success</p>
              <p className="text-xl font-bold mt-1 text-green-600">{totalSuccess}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Errors</p>
              <p className="text-xl font-bold mt-1 text-red-500">{totalCalls - totalSuccess}</p>
            </div>
          </div>

          {/* Requests over time */}
          <div>
            <p className="text-sm font-medium mb-2">Requests Over Time</p>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No traffic data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
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
                    name="Total"
                  />
                  <Line
                    type="monotone"
                    dataKey="success"
                    stroke="#22c55e"
                    dot={false}
                    strokeWidth={2}
                    name="Success"
                  />
                  <Line
                    type="monotone"
                    dataKey="errors"
                    stroke="#ef4444"
                    dot={false}
                    strokeWidth={2}
                    name="Errors"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Success/error breakdown bar */}
          {chartData.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Success vs Error Breakdown</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="success" stackId="a" fill="#22c55e" name="Success" />
                  <Bar
                    dataKey="errors"
                    stackId="a"
                    fill="#ef4444"
                    radius={[3, 3, 0, 0]}
                    name="Errors"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Most used endpoints */}
          {endpoints.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Most Used Endpoints</p>
              <div className="space-y-1">
                {endpoints.map((ep) => (
                  <div
                    key={`${ep.endpointHash}-${ep.environment}`}
                    className="flex items-center gap-3 rounded-md border px-3 py-2 text-xs"
                  >
                    <span className="flex-1 truncate font-medium">
                      {ep.promptName ?? ep.endpointHash}
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      {ep.environment}
                    </Badge>
                    <span className="shrink-0 text-muted-foreground">{ep.totalCalls} calls</span>
                    <span
                      className={`shrink-0 ${ep.successRate >= 0.95 ? 'text-green-600' : 'text-red-500'}`}
                    >
                      {(ep.successRate * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last used */}
          {apiKey.lastUsedAt && (
            <p className="text-xs text-muted-foreground">
              Last used {formatDistanceToNow(new Date(apiKey.lastUsedAt), { addSuffix: true })}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KeyRow({
  apiKey,
  onDisable,
  onDelete,
  onUsage,
}: {
  apiKey: ApiKey;
  onDisable: (id: string) => void;
  onDelete: (id: string) => void;
  onUsage: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
      <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{apiKey.name}</p>
        <p className="font-mono text-xs text-muted-foreground">{apiKey.keyPrefix}••••••••</p>
      </div>
      <Badge variant="outline" className="hidden sm:inline-flex shrink-0 text-xs">
        {apiKey.scope}
      </Badge>
      <Badge variant={STATUS_VARIANT[apiKey.status] ?? 'outline'} className="shrink-0 text-xs">
        {apiKey.status}
      </Badge>
      <div className="hidden md:block text-xs text-muted-foreground shrink-0">
        {apiKey.lastUsedAt
          ? formatDistanceToNow(new Date(apiKey.lastUsedAt), { addSuffix: true })
          : 'Never used'}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground"
          title="View usage"
          onClick={() => onUsage(apiKey.id)}
        >
          <BarChart2 className="h-4 w-4" />
        </Button>
        {apiKey.status === 'active' && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Disable key"
            onClick={() => onDisable(apiKey.id)}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          title="Delete key"
          onClick={() => onDelete(apiKey.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function CreateKeyModal({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [scope, setScope] = useState('workspace');
  const [rateLimitPerMin, setRateLimitPerMin] = useState(60);
  const [rateLimitPerDay, setRateLimitPerDay] = useState(10000);
  const [expiresInDays, setExpiresInDays] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const createMutation = useMutation({
    mutationFn: () =>
      apiKeysApi.create(workspaceId, {
        name,
        scope,
        rateLimitPerMin,
        rateLimitPerDay,
        expiresInDays: expiresInDays ? Number.parseInt(expiresInDays, 10) : undefined,
      }),
    onSuccess: async (res) => {
      const data = res.data as CreateKeyResponse;
      await queryClient.invalidateQueries({ queryKey: ['api-keys', workspaceId] });
      if (data.fullKey) {
        setCreatedKey(data.fullKey);
      } else {
        toast.success('API key created');
        handleClose();
      }
    },
    onError: () => toast.error('Failed to create API key'),
  });

  const handleClose = () => {
    setName('');
    setScope('workspace');
    setRateLimitPerMin(60);
    setRateLimitPerDay(10000);
    setExpiresInDays('');
    setCreatedKey(null);
    setShowKey(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
        </DialogHeader>

        {createdKey ? (
          /* Show the key exactly once */
          <div className="space-y-4">
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
              Copy this key now — it will not be shown again.
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
                {showKey ? createdKey : `${createdKey.slice(0, 12)}${'•'.repeat(32)}`}
              </code>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <CopyButton value={createdKey} />
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Production integration"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organization">Organization (sk_org_)</SelectItem>
                  <SelectItem value="workspace">Workspace (sk_ws_)</SelectItem>
                  <SelectItem value="readonly">Read-only (sk_ro_)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rate-min">Rate limit / min</Label>
                <Input
                  id="rate-min"
                  type="number"
                  min={1}
                  value={rateLimitPerMin}
                  onChange={(e) => setRateLimitPerMin(Number.parseInt(e.target.value, 10))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rate-day">Rate limit / day</Label>
                <Input
                  id="rate-day"
                  type="number"
                  min={1}
                  value={rateLimitPerDay}
                  onChange={(e) => setRateLimitPerDay(Number.parseInt(e.target.value, 10))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="expires">Expires in (days, leave blank for no expiry)</Label>
              <Input
                id="expires"
                type="number"
                min={1}
                placeholder="e.g. 90"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                disabled={!name.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                Create Key
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ApiKeysPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [usageKeyId, setUsageKeyId] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return [];
      const res = await apiKeysApi.list(activeWorkspace.id);
      return res.data as ApiKey[];
    },
    enabled: !!activeWorkspace,
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.disable(activeWorkspace!.id, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['api-keys', activeWorkspace?.id] });
      toast.success('API key disabled');
    },
    onError: () => toast.error('Failed to disable key'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.remove(activeWorkspace!.id, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['api-keys', activeWorkspace?.id] });
      toast.success('API key deleted');
    },
    onError: () => toast.error('Failed to delete key'),
  });

  const counts = {
    all: keys.length,
    active: keys.filter((k) => k.status === 'active').length,
    expired: keys.filter((k) => k.status === 'expired').length,
    disabled: keys.filter((k) => k.status === 'disabled').length,
  };

  const filtered = activeTab === 'all' ? keys : keys.filter((k) => k.status === activeTab);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage API keys for programmatic access to your deployments
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!activeWorkspace}>
          <Plus className="mr-2 h-4 w-4" />
          Create Key
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            { label: 'Total Keys', value: counts.all },
            { label: 'Active', value: counts.active },
            { label: 'Expired', value: counts.expired },
            { label: 'Disabled', value: counts.disabled },
          ] as const
        ).map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-3xl font-bold">{value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs + key list */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
          <TabsTrigger value="expired">Expired ({counts.expired})</TabsTrigger>
          <TabsTrigger value="disabled">Disabled ({counts.disabled})</TabsTrigger>
        </TabsList>

        {(['all', 'active', 'expired', 'disabled'] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                <KeyRound className="h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">No {tab === 'all' ? '' : tab} keys</p>
                {tab === 'all' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setCreateOpen(true)}
                  >
                    Create your first key
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((key) => (
                  <KeyRow
                    key={key.id}
                    apiKey={key}
                    onDisable={(id) => disableMutation.mutate(id)}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onUsage={(id) => setUsageKeyId(id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {activeWorkspace && (
        <CreateKeyModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          workspaceId={activeWorkspace.id}
        />
      )}

      {activeWorkspace &&
        usageKeyId &&
        (() => {
          const key = keys.find((k) => k.id === usageKeyId);
          return key ? (
            <UsageModal
              apiKey={key}
              workspaceId={activeWorkspace.id}
              onClose={() => setUsageKeyId(null)}
            />
          ) : null;
        })()}
    </div>
  );
}
