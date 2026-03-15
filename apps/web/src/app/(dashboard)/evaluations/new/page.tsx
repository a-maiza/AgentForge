'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, CheckCircle2, AlertTriangle, ChevronRight, ChevronLeft } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { evaluationsApi, metricsApi, promptsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricGrid } from '@/components/evaluations/MetricGrid';
import { cn } from '@/lib/utils';

interface Suggestion {
  metric: string;
  match_pct: number;
  reason: string;
}

interface Prompt {
  id: string;
  name: string;
  versions?: { id: string; versionNumber: number; content: string }[];
}

const STEPS = ['Select Metrics', 'Review'] as const;

function NewEvaluationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const promptId = searchParams.get('promptId') ?? '';
  const { activeWorkspace } = useWorkspaceStore();

  const [step, setStep] = useState(0);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const { data: prompt } = useQuery<Prompt>({
    queryKey: ['prompt', promptId],
    queryFn: async () => {
      if (!activeWorkspace) throw new Error('No workspace');
      const res = await promptsApi.get(activeWorkspace.id, promptId);
      return res.data as Prompt;
    },
    enabled: !!promptId && !!activeWorkspace,
  });

  const { data: metrics = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['metrics'],
    queryFn: async () => {
      const res = await metricsApi.list();
      return res.data as { id: string; name: string }[];
    },
  });

  const latestVersion = prompt?.versions?.[0];
  const promptContent = latestVersion?.content ?? '';

  const toggleMetric = (id: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleGetSuggestions = async () => {
    if (!promptContent) return;
    setLoadingSuggestions(true);
    try {
      const res = await metricsApi.suggest(promptContent);
      setSuggestions(res.data as Suggestion[]);
    } catch {
      toast.error('Failed to get AI suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      evaluationsApi.create({
        promptId,
        promptVersionId: latestVersion?.id,
        metrics: selectedMetrics,
      }),
    onSuccess: (res) => {
      const evalData = res.data as { id: string };
      toast.success('Evaluation started');
      router.push(`/evaluations/${evalData.id}`);
    },
    onError: () => toast.error('Failed to start evaluation'),
  });

  const selectedNames = metrics.filter((m) => selectedMetrics.includes(m.id)).map((m) => m.name);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">New Evaluation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {prompt ? `Evaluating: ${prompt.name}` : 'Configure your evaluation'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {i + 1}
            </div>
            <span className={i === step ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedMetrics.length} metric(s) selected
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGetSuggestions}
              disabled={loadingSuggestions || !promptContent}
            >
              {loadingSuggestions ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Get AI Suggestions
                </>
              )}
            </Button>
          </div>
          <MetricGrid
            selectedMetrics={selectedMetrics}
            onToggle={toggleMetric}
            suggestions={suggestions}
          />
        </div>
      )}

      {/* Step 2 */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-md border p-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Prompt</p>
                <p className="font-medium">{prompt?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Version</p>
                <p className="font-medium">
                  {latestVersion ? `v${latestVersion.versionNumber}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Selected Metrics</p>
                <p className="font-medium">{selectedMetrics.length}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Metrics</p>
              <div className="flex flex-wrap gap-1">
                {selectedNames.map((n) => (
                  <span key={n} className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {selectedMetrics.length > 0 ? (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Ready to evaluate
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              No metrics selected.
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={step === 0 ? () => router.push('/evaluations') : () => setStep(0)}
        >
          {step === 0 ? (
            'Cancel'
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" /> Back
            </>
          )}
        </Button>
        <div>
          {step === 0 && (
            <Button onClick={() => setStep(1)} disabled={selectedMetrics.length === 0}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {step === 1 && (
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || selectedMetrics.length === 0}
            >
              Start Evaluation
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewEvaluationPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <NewEvaluationContent />
    </Suspense>
  );
}
