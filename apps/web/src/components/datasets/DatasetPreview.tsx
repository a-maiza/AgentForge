'use client';

import { useQuery } from '@tanstack/react-query';
import { datasetsApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Column {
  name: string;
  type: string;
}

interface PreviewData {
  rows: Record<string, unknown>[];
  columns: Column[];
}

interface Props {
  datasetId: string;
  versionId: string;
}

const typeColor: Record<string, 'default' | 'secondary' | 'outline'> = {
  string: 'secondary',
  number: 'default',
  boolean: 'outline',
  integer: 'default',
};

export function DatasetPreview({ datasetId, versionId }: Props) {
  const { data, isLoading } = useQuery<PreviewData>({
    queryKey: ['dataset-preview', datasetId, versionId],
    queryFn: async () => {
      const res = await datasetsApi.preview(datasetId, versionId);
      return res.data as PreviewData;
    },
    enabled: !!datasetId && !!versionId,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        No preview available
      </div>
    );
  }

  const { rows, columns } = data;

  return (
    <div className="flex gap-4">
      {/* Table */}
      <ScrollArea className="flex-1 h-96 rounded-md border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr>
              {columns.map((col) => (
                <th key={col.name} className="p-2 text-left font-medium whitespace-nowrap">
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((row, ri) => (
              <tr key={ri} className="border-t hover:bg-muted/30">
                {columns.map((col) => (
                  <td key={col.name} className="p-2 whitespace-nowrap max-w-[200px] truncate">
                    {row[col.name] !== null && row[col.name] !== undefined ? (
                      String(row[col.name])
                    ) : (
                      <span className="text-muted-foreground italic">null</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>

      {/* Column schema sidebar */}
      <div className="w-48 shrink-0 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Schema
        </p>
        <div className="space-y-1">
          {columns.map((col) => (
            <div key={col.name} className="flex items-center justify-between gap-1 text-xs">
              <span className="truncate font-mono">{col.name}</span>
              <Badge
                variant={typeColor[col.type] ?? 'outline'}
                className="shrink-0 text-[10px] px-1"
              >
                {col.type}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
