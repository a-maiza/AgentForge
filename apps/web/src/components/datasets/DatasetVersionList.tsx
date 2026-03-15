'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { datasetsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { DiffModal } from '@/components/datasets/DiffModal';

interface DatasetVersion {
  id: string;
  versionNumber: number;
  rowCount: number;
  columnCount: number;
  fileSizeBytes: number;
  status: string;
  createdAt: string;
}

interface Props {
  readonly datasetId: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DatasetVersionList({ datasetId }: Props) {
  const { activeWorkspace } = useWorkspaceStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [diffOpen, setDiffOpen] = useState(false);

  const { data: versions = [], isLoading } = useQuery<DatasetVersion[]>({
    queryKey: ['dataset-versions', datasetId],
    queryFn: async () => {
      if (!activeWorkspace) return [];
      const res = await datasetsApi.versions(activeWorkspace.id, datasetId);
      return res.data as DatasetVersion[];
    },
    enabled: !!activeWorkspace,
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {(['a', 'b', 'c'] as const).map((k) => (
          <Skeleton key={k} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{selected.length}/2 selected</p>
        <Button
          size="sm"
          variant="outline"
          disabled={selected.length !== 2}
          onClick={() => setDiffOpen(true)}
        >
          Compare selected
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-8 p-3" />
              <th className="p-3 text-left font-medium">Version</th>
              <th className="p-3 text-left font-medium">Rows</th>
              <th className="p-3 text-left font-medium">Columns</th>
              <th className="p-3 text-left font-medium">Size</th>
              <th className="p-3 text-left font-medium">Status</th>
              <th className="p-3 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="p-3">
                  <Checkbox
                    checked={selected.includes(v.id)}
                    onCheckedChange={() => toggle(v.id)}
                    disabled={!selected.includes(v.id) && selected.length >= 2}
                  />
                </td>
                <td className="p-3 font-medium">v{v.versionNumber}</td>
                <td className="p-3 text-muted-foreground">{v.rowCount?.toLocaleString() ?? '—'}</td>
                <td className="p-3 text-muted-foreground">{v.columnCount ?? '—'}</td>
                <td className="p-3 text-muted-foreground">
                  {v.fileSizeBytes ? formatBytes(v.fileSizeBytes) : '—'}
                </td>
                <td className="p-3">
                  <Badge variant={v.status === 'latest' ? 'default' : 'outline'}>{v.status}</Badge>
                </td>
                <td className="p-3 text-muted-foreground">
                  {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected.length === 2 && selected[0] !== undefined && selected[1] !== undefined && (
        <DiffModal
          datasetId={datasetId}
          version1Id={selected[0]}
          version2Id={selected[1]}
          open={diffOpen}
          onClose={() => setDiffOpen(false)}
        />
      )}
    </div>
  );
}
