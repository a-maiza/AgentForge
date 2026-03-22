'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { failoverConfigsApi, aiProvidersApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FailoverConfig {
  id?: string;
  isEnabled: boolean;
  primaryProviderId?: string | null;
  secondaryProviderId?: string | null;
  timeoutMs: number;
  errorThreshold: number;
  maxLatencyMs: number;
  autoRecovery: boolean;
  recoveryCheckIntervalMs: number;
}

interface Provider {
  id: string;
  name: string;
  providerType: string;
}

interface Props {
  readonly promptId: string;
}

const DEFAULT_CONFIG: FailoverConfig = {
  isEnabled: true,
  primaryProviderId: null,
  secondaryProviderId: null,
  timeoutMs: 30000,
  errorThreshold: 3,
  maxLatencyMs: 5000,
  autoRecovery: true,
  recoveryCheckIntervalMs: 60000,
};

export function FailoverTab({ promptId }: Props) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspaceStore();

  const [form, setForm] = useState<FailoverConfig>(DEFAULT_CONFIG);

  const { data: config, isLoading: configLoading } = useQuery<FailoverConfig | null>({
    queryKey: ['failover-config', promptId],
    queryFn: async () => {
      try {
        const res = await failoverConfigsApi.get(promptId);
        return res.data as FailoverConfig;
      } catch {
        return null;
      }
    },
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery<Provider[]>({
    queryKey: ['ai-providers', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return [];
      const res = await aiProvidersApi.list(activeWorkspace.id);
      return res.data as Provider[];
    },
    enabled: !!activeWorkspace,
  });

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () =>
      failoverConfigsApi.upsert(promptId, {
        isEnabled: form.isEnabled,
        primaryProviderId: form.primaryProviderId ?? undefined,
        secondaryProviderId: form.secondaryProviderId ?? undefined,
        timeoutMs: form.timeoutMs,
        errorThreshold: form.errorThreshold,
        maxLatencyMs: form.maxLatencyMs,
        autoRecovery: form.autoRecovery,
        recoveryCheckIntervalMs: form.recoveryCheckIntervalMs,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['failover-config', promptId] });
      toast.success('Failover configuration saved');
    },
    onError: () => toast.error('Failed to save failover configuration'),
  });

  if (configLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const set = <K extends keyof FailoverConfig>(key: K, value: FailoverConfig[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 pt-4">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 text-sm text-muted-foreground">
            Failover automatically switches to a secondary provider when the primary exceeds the
            error threshold or latency limit.
          </div>
          <Button
            size="sm"
            variant={form.isEnabled ? 'default' : 'outline'}
            onClick={() => set('isEnabled', !form.isEnabled)}
          >
            {form.isEnabled ? 'Enabled' : 'Disabled'}
          </Button>
        </CardContent>
      </Card>

      {/* Provider selectors */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Primary Provider</CardTitle>
          </CardHeader>
          <CardContent>
            {providersLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={form.primaryProviderId ?? ''}
                onValueChange={(v) => set('primaryProviderId', v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select primary provider…" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Secondary Provider (Fallback)</CardTitle>
          </CardHeader>
          <CardContent>
            {providersLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={form.secondaryProviderId ?? ''}
                onValueChange={(v) => set('secondaryProviderId', v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select fallback provider…" />
                </SelectTrigger>
                <SelectContent>
                  {providers
                    .filter((p) => p.id !== form.primaryProviderId)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Settings form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Failover Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="timeout">Timeout (ms)</Label>
            <Input
              id="timeout"
              type="number"
              min={1000}
              max={120000}
              step={500}
              value={form.timeoutMs}
              onChange={(e) => set('timeoutMs', Number.parseInt(e.target.value, 10))}
            />
            <p className="text-xs text-muted-foreground">
              Max wait before considering a call timed out
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="threshold">Error Threshold</Label>
            <Input
              id="threshold"
              type="number"
              min={1}
              max={20}
              value={form.errorThreshold}
              onChange={(e) => set('errorThreshold', Number.parseInt(e.target.value, 10))}
            />
            <p className="text-xs text-muted-foreground">
              Consecutive errors before switching to fallback
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="latency">Max Latency (ms)</Label>
            <Input
              id="latency"
              type="number"
              min={500}
              max={60000}
              step={500}
              value={form.maxLatencyMs}
              onChange={(e) => set('maxLatencyMs', Number.parseInt(e.target.value, 10))}
            />
            <p className="text-xs text-muted-foreground">
              Latency threshold that also triggers failover
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="recovery">Recovery Interval (ms)</Label>
            <Input
              id="recovery"
              type="number"
              min={10000}
              max={300000}
              step={5000}
              value={form.recoveryCheckIntervalMs}
              onChange={(e) => set('recoveryCheckIntervalMs', Number.parseInt(e.target.value, 10))}
            />
            <p className="text-xs text-muted-foreground">How often to check if primary recovered</p>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <input
              id="auto-recovery"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              checked={form.autoRecovery}
              onChange={(e) => set('autoRecovery', e.target.checked)}
            />
            <Label htmlFor="auto-recovery" className="cursor-pointer">
              Auto-recovery — automatically switch back to primary when it recovers
            </Label>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        Save Failover Configuration
      </Button>
    </div>
  );
}
