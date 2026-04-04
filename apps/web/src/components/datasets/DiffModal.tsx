'use client';

import { useQuery } from '@tanstack/react-query';
import { datasetsApi } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface DiffResult {
  added: Record<string, unknown>[];
  removed: Record<string, unknown>[];
  modified: { before: Record<string, unknown>; after: Record<string, unknown> }[];
}

interface Props {
  workspaceId: string;
  datasetId: string;
  versionA: number;
  versionB: number;
  open: boolean;
  onClose: () => void;
}

function RowDisplay({ row }: { row: Record<string, unknown> }) {
  return (
    <div className="font-mono text-xs space-y-0.5">
      {Object.entries(row).map(([k, v]) => (
        <div key={k}>
          <span className="text-muted-foreground">{k}: </span>
          <span>{v !== null && v !== undefined ? String(v) : 'null'}</span>
        </div>
      ))}
    </div>
  );
}

export function DiffModal({ workspaceId, datasetId, versionA, versionB, open, onClose }: Props) {
  const { data, isLoading } = useQuery<DiffResult>({
    queryKey: ['dataset-diff', workspaceId, datasetId, versionA, versionB],
    queryFn: async () => {
      const res = await datasetsApi.compare(workspaceId, datasetId, versionA, versionB);
      return res.data as DiffResult;
    },
    enabled: open && !!workspaceId && !!datasetId && !!versionA && !!versionB,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Version Diff</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex gap-4 text-sm">
              <span className="text-emerald-600 font-medium">+{data.added.length} added</span>
              <span className="text-red-600 font-medium">−{data.removed.length} removed</span>
              <span className="text-amber-600 font-medium">~{data.modified.length} modified</span>
            </div>

            <ScrollArea className="h-[420px]">
              <div className="space-y-2">
                {/* Added rows */}
                {data.added.map((row, i) => (
                  <div
                    key={`add-${i}`}
                    className="rounded-md bg-emerald-50 border border-emerald-200 p-3"
                  >
                    <p className="text-[10px] font-semibold text-emerald-700 mb-1">ADDED</p>
                    <RowDisplay row={row} />
                  </div>
                ))}

                {/* Removed rows */}
                {data.removed.map((row, i) => (
                  <div key={`rem-${i}`} className="rounded-md bg-red-50 border border-red-200 p-3">
                    <p className="text-[10px] font-semibold text-red-700 mb-1">REMOVED</p>
                    <RowDisplay row={row} />
                  </div>
                ))}

                {/* Modified rows */}
                {data.modified.map((item, i) => (
                  <div
                    key={`mod-${i}`}
                    className="rounded-md bg-amber-50 border border-amber-200 p-3"
                  >
                    <p className="text-[10px] font-semibold text-amber-700 mb-1">MODIFIED</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Before</p>
                        <RowDisplay row={item.before} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">After</p>
                        <RowDisplay row={item.after} />
                      </div>
                    </div>
                  </div>
                ))}

                {data.added.length === 0 &&
                  data.removed.length === 0 &&
                  data.modified.length === 0 && (
                    <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                      No differences found between versions.
                    </div>
                  )}
              </div>
            </ScrollArea>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
