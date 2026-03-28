'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { promptDatasetConfigsApi, datasetsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DatasetConfig {
  datasetId?: string;
  datasetName?: string;
  variableMapping?: Record<string, string>;
  preview?: Record<string, unknown>[];
  columns?: { name: string }[];
}

interface Dataset {
  id: string;
  name: string;
}

interface Variable {
  name: string;
}

interface Props {
  readonly promptId: string;
  readonly variables?: Variable[];
}

export function DatasetTab({ promptId, variables = [] }: Props) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspaceStore();
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const { data: config, isLoading: configLoading } = useQuery<DatasetConfig>({
    queryKey: ['prompt-dataset-config', promptId],
    queryFn: async () => {
      if (!activeWorkspace) return {};
      const res = await promptDatasetConfigsApi.get(activeWorkspace.id, promptId);
      return res.data as DatasetConfig;
    },
    enabled: !!activeWorkspace,
  });

  const { data: datasets = [], isLoading: datasetsLoading } = useQuery<Dataset[]>({
    queryKey: ['datasets', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return [];
      const res = await datasetsApi.list(activeWorkspace.id);
      return res.data as Dataset[];
    },
    enabled: !!activeWorkspace,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      promptDatasetConfigsApi.upsert(activeWorkspace!.id, promptId, {
        datasetId: selectedDatasetId || config?.datasetId,
        variableMapping: mapping,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['prompt-dataset-config', promptId] });
      toast.success('Dataset configuration saved');
    },
    onError: () => toast.error('Failed to save configuration'),
  });

  if (configLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const activeDatasetId = selectedDatasetId || config?.datasetId;
  const columns = config?.columns ?? [];
  const preview = config?.preview ?? [];

  return (
    <div className="space-y-4">
      {/* Connected dataset */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected Dataset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Dataset</Label>
            {datasetsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={activeDatasetId ?? ''} onValueChange={setSelectedDatasetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a dataset..." />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Variable mapping */}
          {variables.length > 0 && columns.length > 0 && (
            <div className="space-y-2">
              <Label>Variable Mapping</Label>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left font-medium">Prompt Variable</th>
                      <th className="p-2 text-left font-medium">Dataset Column</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variables.map((v) => (
                      <tr key={v.name} className="border-t">
                        <td className="p-2 font-mono text-xs">{`{{${v.name}}}`}</td>
                        <td className="p-2">
                          <Select
                            value={mapping[v.name] ?? config?.variableMapping?.[v.name] ?? ''}
                            onValueChange={(val) => setMapping((m) => ({ ...m, [v.name]: val }))}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Select column…" />
                            </SelectTrigger>
                            <SelectContent>
                              {columns.map((col) => (
                                <SelectItem key={col.name} value={col.name}>
                                  {col.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Save Configuration
          </Button>
        </CardContent>
      </Card>

      {/* 2-row preview */}
      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    {columns.map((col) => (
                      <th key={col.name} className="p-2 text-left font-medium whitespace-nowrap">
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 2).map((row, i) => (
                    <tr key={i} className="border-t">
                      {columns.map((col) => (
                        <td key={col.name} className="p-2 whitespace-nowrap">
                          {row[col.name] !== undefined && row[col.name] !== null
                            ? String(row[col.name])
                            : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
