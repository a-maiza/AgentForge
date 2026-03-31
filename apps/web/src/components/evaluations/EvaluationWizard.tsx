'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Sparkles, CheckCircle2, AlertTriangle, ChevronRight, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { evaluationsApi, metricsApi, promptsApi, datasetsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { MetricGrid } from '@/components/evaluations/MetricGrid';
import { cn } from '@/lib/utils';

interface Suggestion {
  metric: string;
  match_pct: number;
  reason: string;
}

interface PromptVersion {
  id: string;
  versionNumber: number;
}

interface DatasetVersion {
  id: string;
  versionNumber: number;
}

interface Props {
  workspaceId: string;
  promptId: string;
  promptName: string;
  promptContent: string;
  promptVersionId: string;
  datasetId?: string | undefined;
  datasetVersionId?: string | undefined;
  datasetName?: string | undefined;
  providerName?: string | undefined;
  open: boolean;
  onClose: () => void;
  onSuccess?: (evalId: string) => void;
}

const STEPS = ['Configure', 'Select Metrics', 'Review'] as const;

export function EvaluationWizard({
  workspaceId,
  promptId,
  promptName,
  promptContent,
  promptVersionId,
  datasetId,
  datasetVersionId,
  datasetName,
  providerName,
  open,
  onClose,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedPromptVersionId, setSelectedPromptVersionId] = useState(promptVersionId);
  const [selectedDatasetVersionId, setSelectedDatasetVersionId] = useState(
    datasetVersionId ?? '',
  );

  const { data: promptVersions = [] } = useQuery<PromptVersion[]>({
    queryKey: ['prompt-versions-wizard', workspaceId, promptId],
    queryFn: async () => {
      const res = await promptsApi.versions(workspaceId, promptId);
      return res.data as PromptVersion[];
    },
    enabled: !!workspaceId && !!promptId && open,
  });

  const { data: datasetVersions = [] } = useQuery<DatasetVersion[]>({
    queryKey: ['dataset-versions-wizard', workspaceId, datasetId],
    queryFn: async () => {
      if (!datasetId) return [];
      const res = await datasetsApi.versions(workspaceId, datasetId);
      return res.data as DatasetVersion[];
    },
    enabled: !!workspaceId && !!datasetId && open,
  });

  const { data: metrics = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['metrics'],
    queryFn: async () => {
      const res = await metricsApi.list();
      return res.data as { id: string; name: string }[];
    },
  });

  const toggleMetric = (id: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleGetSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const res = await metricsApi.suggest(promptContent, 5);
      const data = res.data as { suggestions: Suggestion[] };
      const list = data.suggestions ?? [];
      setSuggestions(list);
      setSelectedMetrics(list.map((s) => s.metric));
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
        promptVersionId: selectedPromptVersionId,
        ...(selectedDatasetVersionId && { datasetVersionId: selectedDatasetVersionId }),
        metrics: selectedMetrics,
      }),
    onSuccess: (res) => {
      const evalData = res.data as { id: string };
      toast.success('Evaluation started');
      onSuccess?.(evalData.id);
      router.push(`/evaluations/${evalData.id}`);
      handleClose();
    },
    onError: () => toast.error('Failed to start evaluation'),
  });

  const handleClose = () => {
    setStep(0);
    setSelectedMetrics([]);
    setSuggestions([]);
    setSelectedPromptVersionId(promptVersionId);
    setSelectedDatasetVersionId(datasetVersionId ?? '');
    onClose();
  };

  const isReady = selectedMetrics.length > 0;
  const selectedNames = metrics.filter((m) => selectedMetrics.includes(m.id)).map((m) => m.name);

  const selectedPV = promptVersions.find((v) => v.id === selectedPromptVersionId);
  const selectedDV = datasetVersions.find((v) => v.id === selectedDatasetVersionId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start Evaluation</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                  i <= step
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {i + 1}
              </div>
              <span className={i === step ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
              {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step 1: Configure versions */}
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose which prompt version and dataset version to evaluate.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* Prompt version */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Prompt — {promptName}
                </label>
                <Select
                  value={selectedPromptVersionId}
                  onValueChange={setSelectedPromptVersionId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {promptVersions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        v{v.versionNumber}
                        {v.id === promptVersionId ? ' (current)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dataset version */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Dataset{datasetName ? ` — ${datasetName}` : ''}
                </label>
                {datasetId ? (
                  <Select
                    value={selectedDatasetVersionId}
                    onValueChange={setSelectedDatasetVersionId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select version" />
                    </SelectTrigger>
                    <SelectContent>
                      {datasetVersions.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          v{v.versionNumber}
                          {v.id === datasetVersionId ? ' (current)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No dataset connected</p>
                )}
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
              <p>
                <span className="text-muted-foreground">Provider:</span> {providerName ?? '—'}
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Select Metrics */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {loadingSuggestions ? (
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
                    AI is selecting metrics…
                  </span>
                ) : (
                  `${selectedMetrics.length} metric(s) selected`
                )}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGetSuggestions}
                disabled={loadingSuggestions}
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

        {/* Step 3: Review */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-md border p-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Prompt</p>
                  <p className="font-medium">
                    {promptName}
                    {selectedPV && (
                      <span className="ml-1 text-xs text-muted-foreground font-mono">
                        v{selectedPV.versionNumber}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dataset</p>
                  <p className="font-medium">
                    {datasetName ?? '—'}
                    {selectedDV && (
                      <span className="ml-1 text-xs text-muted-foreground font-mono">
                        v{selectedDV.versionNumber}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">AI Provider</p>
                  <p className="font-medium">{providerName ?? '—'}</p>
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

            {isReady ? (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Ready to evaluate
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {!datasetName && 'No dataset connected. '}
                {!providerName && 'No AI provider configured. '}
                {selectedMetrics.length === 0 && 'No metrics selected.'}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <Button variant="outline" onClick={step === 0 ? handleClose : () => setStep((s) => s - 1)}>
            {step === 0 ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" /> Back
              </>
            )}
          </Button>
          <div>
            {step < 2 && (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 1 && selectedMetrics.length === 0}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !isReady}
              >
                Start Evaluation
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
