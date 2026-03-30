'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { promptsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface DiffHunk {
  type: 'added' | 'removed' | 'unchanged';
  line: string;
}

interface CompareResult {
  versionA: number;
  versionB: number;
  hunks: DiffHunk[];
}

interface PromptVersion {
  id: string;
  versionNumber: number;
  createdAt: string;
}

interface Props {
  workspaceId: string;
  promptId: string;
  open: boolean;
  onClose: () => void;
}

export function VersionCompareModal({ workspaceId, promptId, open, onClose }: Props) {
  const [versionA, setVersionA] = useState<string>('');
  const [versionB, setVersionB] = useState<string>('');

  const { data: versionsData } = useQuery({
    queryKey: ['prompt-versions', promptId],
    queryFn: async () => {
      const res = await promptsApi.versions(workspaceId, promptId);
      return res.data as PromptVersion[];
    },
    enabled: open,
  });

  const versions = versionsData ?? [];

  const compareMutation = useMutation({
    mutationFn: () =>
      promptsApi.compareVersions(workspaceId, promptId, {
        versionA: Number(versionA),
        versionB: Number(versionB),
      }),
  });

  const result = compareMutation.data?.data as CompareResult | undefined;

  const handleCompare = () => {
    if (versionA && versionB) compareMutation.mutate();
  };

  const added = result?.hunks.filter((h) => h.type === 'added').length ?? 0;
  const removed = result?.hunks.filter((h) => h.type === 'removed').length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Compare Versions</DialogTitle>
        </DialogHeader>

        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-1">
            <Label>Version A (base)</Label>
            <Select value={versionA} onValueChange={setVersionA}>
              <SelectTrigger>
                <SelectValue placeholder="Select version…" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={String(v.versionNumber)}>
                    v{v.versionNumber} — {new Date(v.createdAt).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <Label>Version B (compare)</Label>
            <Select value={versionB} onValueChange={setVersionB}>
              <SelectTrigger>
                <SelectValue placeholder="Select version…" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={String(v.versionNumber)}>
                    v{v.versionNumber} — {new Date(v.createdAt).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleCompare}
            disabled={!versionA || !versionB || versionA === versionB || compareMutation.isPending}
          >
            {compareMutation.isPending ? 'Comparing…' : 'Compare'}
          </Button>
        </div>

        {result && (
          <div className="flex-1 overflow-auto mt-4">
            <div className="mb-2 flex gap-4 text-xs text-muted-foreground">
              <span className="text-green-600 font-medium">+{added} added</span>
              <span className="text-red-600 font-medium">-{removed} removed</span>
            </div>
            <div className="rounded-md border overflow-auto font-mono text-xs">
              {result.hunks.map((hunk, i) => (
                <div
                  key={i}
                  className={cn(
                    'px-3 py-0.5 whitespace-pre-wrap',
                    hunk.type === 'added' &&
                      'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300',
                    hunk.type === 'removed' &&
                      'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300',
                    hunk.type === 'unchanged' && 'text-muted-foreground',
                  )}
                >
                  <span className="mr-2 select-none">
                    {hunk.type === 'added' ? '+' : hunk.type === 'removed' ? '-' : ' '}
                  </span>
                  {hunk.line}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
