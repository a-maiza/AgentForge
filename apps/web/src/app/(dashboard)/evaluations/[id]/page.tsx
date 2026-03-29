'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { evaluationsApi } from '@/lib/api';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface EvaluationResult {
  id: string;
  metricName: string;
  score: number;
  grade: string | null;
  details?: { reason?: string };
}

interface EvaluationJob {
  id: string;
  status: string;
  grade?: string;
  progress?: number;
  errorMessage?: string;
  promptName?: string;
  model?: string;
  providerName?: string;
  datasetName?: string;
  createdAt: string;
  duration?: number;
  results?: EvaluationResult[];
}

const STATUS_VARIANTS: Record<
  string,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'
> = {
  pending: 'secondary',
  running: 'warning',
  completed: 'success',
  failed: 'destructive',
};

function naReason(reason: string | undefined): string {
  if (reason === 'no_reference_column')
    return 'Requires a reference column in your dataset (expected, answer, label…)';
  if (reason === 'no_log_probs') return 'Model did not return log-probabilities';
  if (reason === 'consistency_not_requested')
    return 'Select Consistency Score to enable multi-run comparison';
  return 'Not computed for this run';
}

const GRADE_CLASSES: Record<string, string> = {
  'A+': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  A: 'bg-green-100 text-green-800 border-green-200',
  B: 'bg-blue-100 text-blue-800 border-blue-200',
  C: 'bg-amber-100 text-amber-800 border-amber-200',
  D: 'bg-orange-100 text-orange-800 border-orange-200',
  F: 'bg-red-100 text-red-800 border-red-200',
};

export default function EvaluationDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => evaluationsApi.remove(id),
    onSuccess: () => {
      toast.success('Evaluation deleted');
      router.push('/evaluations');
    },
    onError: () => toast.error('Failed to delete evaluation'),
  });

  const { data: job, isLoading } = useQuery<EvaluationJob>({
    queryKey: ['evaluation', id],
    queryFn: async () => {
      const res = await evaluationsApi.get(id);
      return res.data as EvaluationJob;
    },
    refetchInterval: (query) => {
      const data = query.state.data as EvaluationJob | undefined;
      return data?.status === 'running' ? 3000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <p className="text-lg font-semibold">Evaluation not found</p>
        <Link href="/evaluations">
          <Button variant="outline" className="mt-4">
            Back to Evaluations
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/evaluations">
          <Button variant="ghost" size="icon" aria-label="Back to evaluations">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold font-mono">{job.id.slice(0, 16)}…</h1>
            <Badge variant={STATUS_VARIANTS[job.status] ?? 'outline'}>{job.status}</Badge>
            {job.grade && (
              <span
                className={cn(
                  'inline-flex items-center rounded border px-2 py-0.5 text-base font-bold',
                  GRADE_CLASSES[job.grade] ?? 'bg-muted',
                )}
              >
                {job.grade}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Created {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete evaluation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this evaluation and all its results. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Progress bar (if running) */}
      {job.status === 'running' && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{job.progress ?? 0}%</span>
          </div>
          <Progress value={job.progress ?? 0} />
        </div>
      )}

      {/* Error */}
      {job.status === 'failed' && job.errorMessage && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{job.errorMessage}</span>
        </div>
      )}

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Prompt</p>
            <p className="font-medium">{job.promptName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Model</p>
            <p className="font-medium">{job.model ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Provider</p>
            <p className="font-medium">{job.providerName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dataset</p>
            <p className="font-medium">{job.datasetName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="font-medium">{job.duration ? `${job.duration}s` : '—'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Evaluation Metrics — dynamic, one card per selected metric */}
      {job.results && job.results.length > 0 ? (
        <div>
          <h2 className="text-base font-semibold mb-3">Evaluation Metrics</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {job.results.map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium capitalize">
                      {r.metricName.replace(/_/g, ' ')}
                    </p>
                    {r.grade && (
                      <span
                        className={cn(
                          'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-bold',
                          r.grade === 'N/A'
                            ? 'bg-muted text-muted-foreground border-muted-foreground/30'
                            : (GRADE_CLASSES[r.grade] ?? 'bg-muted'),
                        )}
                      >
                        {r.grade}
                      </span>
                    )}
                  </div>
                  {r.grade === 'N/A' ? (
                    <p className="text-xs text-amber-600 italic">
                      {naReason(r.details?.reason)}
                    </p>
                  ) : (
                    <>
                      <Progress value={r.score * 100} />
                      <p className="text-xs text-muted-foreground text-right">
                        {(r.score * 100).toFixed(1)}%
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : job.status === 'completed' ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No metric results recorded for this evaluation.
        </div>
      ) : null}
    </div>
  );
}
