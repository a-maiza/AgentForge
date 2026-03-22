'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowRight,
  CheckCircle,
  Clock,
  History,
  Rocket,
  RotateCcw,
  ChevronUp,
} from 'lucide-react';
import { deploymentsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Deployment {
  id: string;
  environment: 'dev' | 'staging' | 'prod';
  versionLabel: string;
  status: string;
  isLive: boolean;
  endpointHash: string | null;
  deployedAt: string;
  notes: string | null;
  promptVersion?: { versionNumber: number; content?: string };
  deployer?: { name: string | null; email: string };
}

interface Props {
  readonly promptId: string;
  readonly versions?: { id: string; versionNumber: number }[];
}

const ENV_LABELS: Record<string, string> = { dev: 'DEV', staging: 'STAGING', prod: 'PROD' };
const ENV_ORDER: Array<'dev' | 'staging' | 'prod'> = ['dev', 'staging', 'prod'];

const ENV_COLORS: Record<string, string> = {
  dev: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
  staging: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800',
  prod: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800',
};

const ENV_BADGE_COLORS: Record<string, string> = {
  dev: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  staging: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  prod: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
};

export function EnvironmentsTab({ promptId, versions = [] }: Props) {
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: deployments, isLoading } = useQuery<Record<string, Deployment | null>>({
    queryKey: ['deployments', promptId],
    queryFn: async () => {
      const res = await deploymentsApi.list(promptId);
      return res.data as Record<string, Deployment | null>;
    },
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<Deployment[]>({
    queryKey: ['deployments-history', promptId],
    queryFn: async () => {
      const res = await deploymentsApi.history(promptId);
      return res.data as Deployment[];
    },
    enabled: historyOpen,
  });

  const deployMutation = useMutation({
    mutationFn: ({ environment }: { environment: string }) => {
      const latestVersionId = versions[0]?.id;
      if (!latestVersionId) throw new Error('No prompt version found');
      return deploymentsApi.deploy(promptId, {
        promptVersionId: latestVersionId,
        environment,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deployments', promptId] });
      toast.success('Deployed successfully');
    },
    onError: () => toast.error('Deployment failed'),
  });

  const promoteMutation = useMutation({
    mutationFn: (targetEnvironment: string) =>
      deploymentsApi.promote(promptId, { targetEnvironment }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deployments', promptId] });
      toast.success('Promoted successfully');
    },
    onError: () => toast.error('Promotion failed'),
  });

  const rollbackMutation = useMutation({
    mutationFn: (environment: string) => deploymentsApi.rollback(promptId, environment),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deployments', promptId] });
      toast.success('Rolled back successfully');
    },
    onError: () => toast.error('Rollback failed'),
  });

  const goLiveMutation = useMutation({
    mutationFn: (environment: string) => deploymentsApi.goLive(promptId, environment),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deployments', promptId] });
      toast.success('Endpoint is now live');
    },
    onError: () => toast.error('Go-live failed'),
  });

  const isMutating =
    deployMutation.isPending ||
    promoteMutation.isPending ||
    rollbackMutation.isPending ||
    goLiveMutation.isPending;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-52 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pipeline */}
      <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {ENV_ORDER.map((env, idx) => {
          const dep = deployments?.[env] ?? null;
          const isLast = idx === ENV_ORDER.length - 1;
          const nextEnv = ENV_ORDER[idx + 1];
          const hasNextDep = nextEnv ? !deployments?.[nextEnv] : false;

          return (
            <>
              {/* Environment Card */}
              <Card key={env} className={`border-2 ${ENV_COLORS[env]}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ${ENV_BADGE_COLORS[env]}`}
                    >
                      {ENV_LABELS[env]}
                    </span>
                    {dep?.isLive && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Live
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dep ? (
                    <>
                      <div>
                        <p className="font-mono text-lg font-bold">{dep.versionLabel}</p>
                        {dep.promptVersion && (
                          <p className="text-xs text-muted-foreground">
                            Prompt v{dep.promptVersion.versionNumber}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(dep.deployedAt), { addSuffix: true })}
                      </div>
                      {dep.deployer && (
                        <p className="text-xs text-muted-foreground truncate">
                          by {dep.deployer.name ?? dep.deployer.email}
                        </p>
                      )}
                      <div className="flex flex-col gap-1.5 pt-1">
                        {!dep.isLive && (
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={isMutating}
                            onClick={() => goLiveMutation.mutate(env)}
                          >
                            <Rocket className="mr-1 h-3 w-3" />
                            Go Live
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          disabled={isMutating}
                          onClick={() => rollbackMutation.mutate(env)}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Rollback
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Not deployed</p>
                      {env === 'dev' && versions.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          disabled={isMutating}
                          onClick={() => deployMutation.mutate({ environment: env })}
                        >
                          Deploy to DEV
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Connector arrow */}
              {!isLast && (
                <div key={`arrow-${env}`} className="hidden md:flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1">
                    <ArrowRight
                      className={`h-6 w-6 ${dep && hasNextDep ? 'text-primary' : 'text-muted-foreground/40'}`}
                    />
                    {dep && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        disabled={isMutating}
                        onClick={() => promoteMutation.mutate(ENV_ORDER[idx + 1]!)}
                      >
                        <ChevronUp className="h-3 w-3 mr-0.5" />
                        Promote
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          );
        })}
      </div>

      {/* History button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
          <History className="mr-2 h-4 w-4" />
          Deployment History
        </Button>
      </div>

      {/* History Modal */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deployment History</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No deployments yet</p>
          ) : (
            <div className="space-y-2">
              {history.map((dep) => (
                <div key={dep.id} className="flex items-center gap-4 rounded-lg border p-3 text-sm">
                  <span
                    className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold ${ENV_BADGE_COLORS[dep.environment]}`}
                  >
                    {ENV_LABELS[dep.environment]}
                  </span>
                  <span className="font-mono font-medium">{dep.versionLabel}</span>
                  <Badge
                    variant={
                      dep.status === 'active'
                        ? 'success'
                        : dep.status === 'rolled_back'
                          ? 'destructive'
                          : 'outline'
                    }
                    className="text-xs"
                  >
                    {dep.status}
                  </Badge>
                  <span className="text-muted-foreground flex-1 text-xs">
                    {dep.deployer?.name ?? dep.deployer?.email ?? '—'}
                  </span>
                  <span className="text-muted-foreground text-xs shrink-0">
                    {formatDistanceToNow(new Date(dep.deployedAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
