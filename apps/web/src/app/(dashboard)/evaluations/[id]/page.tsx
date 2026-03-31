'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
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

interface EvaluationTrace {
  id: string;
  rowIndex: number;
  inputData: Record<string, unknown>;
  prediction: string;
  reference: string | null;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  error: string | null;
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
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

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

  const { data: traces = [] } = useQuery<EvaluationTrace[]>({
    queryKey: ['evaluation-traces', id],
    queryFn: async () => {
      const res = await evaluationsApi.traces(id);
      return res.data as EvaluationTrace[];
    },
    enabled: job?.status === 'completed',
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
                    <p className="text-xs text-amber-600 italic">{naReason(r.details?.reason)}</p>
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

      {/* Row-by-row traces */}
      {traces.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3">
            Predictions — {traces.length} row{traces.length > 1 ? 's' : ''}
          </h2>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 w-8" />
                  <th className="p-3 text-left font-medium">#</th>
                  <th className="p-3 text-left font-medium">Prediction</th>
                  <th className="p-3 text-left font-medium">Expected</th>
                  <th className="p-3 text-left font-medium w-20">Latency</th>
                  <th className="p-3 text-left font-medium w-20">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {traces.map((trace) => {
                  const isExpanded = expandedRow === trace.rowIndex;
                  const inputEntries = Object.entries(trace.inputData);
                  return (
                    <>
                      <tr
                        key={trace.id}
                        className={cn(
                          'border-t cursor-pointer transition-colors hover:bg-muted/30',
                          trace.error && 'bg-red-50',
                        )}
                        onClick={() =>
                          setExpandedRow(isExpanded ? null : trace.rowIndex)
                        }
                      >
                        <td className="p-3 text-muted-foreground">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">
                          {trace.rowIndex + 1}
                        </td>
                        <td className="p-3 max-w-[260px]">
                          {trace.error ? (
                            <span className="text-xs text-red-600 italic">{trace.error}</span>
                          ) : (
                            <span className="line-clamp-2 text-xs">{trace.prediction}</span>
                          )}
                        </td>
                        <td className="p-3 max-w-[260px]">
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {trace.reference ?? '—'}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                          {trace.latencyMs}ms
                        </td>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                          {trace.inputTokens + trace.outputTokens}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${trace.id}-expanded`} className="border-t bg-muted/10">
                          <td colSpan={6} className="p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              {/* Inputs */}
                              <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Inputs
                                </p>
                                <div className="rounded-md border bg-background p-3 space-y-1.5">
                                  {inputEntries.map(([key, val]) => (
                                    <div key={key}>
                                      <span className="text-[10px] font-mono text-muted-foreground">
                                        {key}
                                      </span>
                                      <p className="text-xs mt-0.5 whitespace-pre-wrap">
                                        {typeof val === 'object'
                                          ? JSON.stringify(val, null, 2)
                                          : String(val)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Prediction vs Expected */}
                              <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Prediction
                                </p>
                                <pre className="rounded-md border bg-emerald-50 border-emerald-200 p-3 text-xs whitespace-pre-wrap text-emerald-900">
                                  {trace.prediction || '(empty)'}
                                </pre>

                                {trace.reference !== null && (
                                  <>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      Expected
                                    </p>
                                    <pre className="rounded-md border bg-blue-50 border-blue-200 p-3 text-xs whitespace-pre-wrap text-blue-900">
                                      {trace.reference}
                                    </pre>
                                  </>
                                )}

                                <div className="flex gap-4 text-xs text-muted-foreground">
                                  <span>In: {trace.inputTokens} tok</span>
                                  <span>Out: {trace.outputTokens} tok</span>
                                  <span>{trace.latencyMs}ms</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
