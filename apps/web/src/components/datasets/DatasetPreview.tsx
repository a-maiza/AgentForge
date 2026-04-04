'use client';

import { useQuery } from '@tanstack/react-query';
import { datasetsApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface PreviewData {
  rows: Record<string, unknown>[];
  columns: string[];
}

function flattenRow(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenRow(val as Record<string, unknown>, fullKey));
    } else if (Array.isArray(val)) {
      result[fullKey] = JSON.stringify(val);
    } else {
      result[fullKey] = val as string | number | boolean | null;
    }
  }
  return result;
}

function inferType(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string' && !isNaN(Number(value)) && value !== '') return 'number';
  return 'string';
}

interface Props {
  workspaceId: string;
  datasetId: string;
  versionNumber: number;
}

const typeColor: Record<string, 'default' | 'secondary' | 'outline'> = {
  string: 'secondary',
  number: 'default',
  boolean: 'outline',
  integer: 'default',
};

export function DatasetPreview({ workspaceId, datasetId, versionNumber }: Props) {
  const { data, isLoading } = useQuery<PreviewData>({
    queryKey: ['dataset-preview', workspaceId, datasetId, versionNumber],
    queryFn: async () => {
      const res = await datasetsApi.preview(workspaceId, datasetId, versionNumber);
      return res.data as PreviewData;
    },
    enabled: !!workspaceId && !!datasetId && !!versionNumber,
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

  const { rows } = data;
  const flatRows = rows.map((r) => flattenRow(r as Record<string, unknown>));

  // Union of all keys across rows (handles sparse datasets)
  const flatColumns = Array.from(
    flatRows.reduce<Set<string>>((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set()),
  );

  const firstFlat = flatRows[0] ?? {};

  return (
    <div className="flex gap-4">
      {/* Table */}
      <ScrollArea className="flex-1 h-96 rounded-md border">
        <table className="text-xs whitespace-nowrap">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr>
              {flatColumns.map((col) => (
                <th key={col} className="p-2 text-left font-medium whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flatRows.slice(0, 50).map((row, ri) => (
              <tr key={ri} className="border-t hover:bg-muted/30">
                {flatColumns.map((col) => {
                  const val = row[col];
                  return (
                    <td key={col} className="p-2 max-w-[240px] truncate">
                      {val !== null && val !== undefined ? (
                        <code className="whitespace-nowrap font-mono">{String(val)}</code>
                      ) : (
                        <span className="text-muted-foreground italic">null</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Column schema sidebar */}
      <div className="w-48 shrink-0 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Schema
        </p>
        <div className="space-y-1">
          {flatColumns.map((col) => {
            const type = inferType(firstFlat[col] ?? null);
            return (
              <div key={col} className="flex items-center justify-between gap-1 text-xs">
                <span className="truncate font-mono">{col}</span>
                <Badge variant={typeColor[type] ?? 'outline'} className="shrink-0 text-[10px] px-1">
                  {type}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
