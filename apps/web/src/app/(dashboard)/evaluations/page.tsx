'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Search, RefreshCw, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { evaluationsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface EvaluationJob {
  id: string;
  status: string;
  promptName?: string;
  promptVersionNumber?: number;
  model?: string;
  datasetName?: string;
  progress?: number;
  grade?: string;
  createdAt: string;
  duration?: number;
}

interface EvaluationList {
  data: EvaluationJob[];
}

const STATUS_VARIANTS: Record<
  string,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'
> = {
  pending: 'secondary',
  running: 'warning',
  completed: 'success',
  failed: 'destructive',
  cancelled: 'outline',
};

const GRADE_CLASSES: Record<string, string> = {
  'A+': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  A: 'bg-green-100 text-green-800 border-green-200',
  B: 'bg-blue-100 text-blue-800 border-blue-200',
  C: 'bg-amber-100 text-amber-800 border-amber-200',
  D: 'bg-orange-100 text-orange-800 border-orange-200',
  F: 'bg-red-100 text-red-800 border-red-200',
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export default function EvaluationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => evaluationsApi.remove(id),
    onSuccess: () => {
      toast.success('Evaluation deleted');
      void queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      setDeleteId(null);
    },
    onError: () => toast.error('Failed to delete evaluation'),
  });

  const { data: response, isLoading } = useQuery<EvaluationList>({
    queryKey: ['evaluations', statusFilter],
    queryFn: async () => {
      const params = statusFilter !== 'all' ? { status: statusFilter } : undefined;
      const res = await evaluationsApi.list(params);
      return res.data as EvaluationList;
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const jobs: EvaluationJob[] =
    response?.data ?? (Array.isArray(response) ? (response as EvaluationJob[]) : []);

  const filtered = jobs.filter((j) => {
    const q = search.toLowerCase();
    return j.id.toLowerCase().includes(q) || (j.promptName ?? '').toLowerCase().includes(q);
  });

  const counts = {
    total: jobs.length,
    pending: jobs.filter((j) => j.status === 'pending').length,
    running: jobs.filter((j) => j.status === 'running').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Evaluations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor evaluation job results</p>
        </div>
        <Button
          variant={autoRefresh ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAutoRefresh((r) => !r)}
        >
          <RefreshCw className={cn('h-4 w-4', autoRefresh && 'animate-spin')} />
          {autoRefresh ? 'Auto-refreshing' : 'Auto-refresh'}
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Pending" value={counts.pending} />
        <StatCard label="Running" value={counts.running} />
        <StatCard label="Completed" value={counts.completed} />
        <StatCard label="Failed" value={counts.failed} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID or prompt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {(['a', 'b', 'c', 'd'] as const).map((k) => (
            <Skeleton key={k} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <p className="text-lg font-semibold">No evaluations found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Run your first evaluation from a prompt page'}
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left font-medium">ID</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">Prompt</th>
                <th className="p-3 text-left font-medium">Model</th>
                <th className="p-3 text-left font-medium">Dataset</th>
                <th className="p-3 text-left font-medium w-32">Progress</th>
                <th className="p-3 text-left font-medium">Grade</th>
                <th className="p-3 text-left font-medium">Created</th>
                <th className="p-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr
                  key={job.id}
                  className="border-t cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => router.push(`/evaluations/${job.id}`)}
                >
                  <td className="p-3 font-mono text-xs">{job.id.slice(0, 8)}…</td>
                  <td className="p-3">
                    <Badge variant={STATUS_VARIANTS[job.status] ?? 'outline'}>{job.status}</Badge>
                  </td>
                  <td className="p-3 max-w-[160px]">
                    <span className="truncate">{job.promptName ?? '—'}</span>
                    {job.promptVersionNumber !== undefined && (
                      <span className="ml-1 text-[10px] text-muted-foreground font-mono">
                        v{job.promptVersionNumber}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{job.model ?? '—'}</td>
                  <td className="p-3 text-xs text-muted-foreground max-w-[120px] truncate">
                    {job.datasetName ?? '—'}
                  </td>
                  <td className="p-3">
                    {job.status === 'running' ? (
                      <Progress value={job.progress ?? 0} className="h-1.5" />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {job.status === 'completed' ? '100%' : '—'}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {job.grade ? (
                      <span
                        className={cn(
                          'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-bold',
                          GRADE_CLASSES[job.grade] ?? 'bg-muted',
                        )}
                      >
                        {job.grade}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                  </td>
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(job.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o: boolean) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete evaluation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the evaluation and all its results. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
