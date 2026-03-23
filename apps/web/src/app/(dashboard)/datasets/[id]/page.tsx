'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Upload } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { datasetsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatasetPreview } from '@/components/datasets/DatasetPreview';
import { DatasetVersionList } from '@/components/datasets/DatasetVersionList';
import { CreateDatasetModal } from '@/components/datasets/CreateDatasetModal';

interface DatasetVersion {
  id: string;
  versionNumber: number;
  rowCount: number;
  status: string;
}

interface Dataset {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updatedAt: string;
  versions?: DatasetVersion[];
}

export default function DatasetDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { activeWorkspace } = useWorkspaceStore();
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: dataset, isLoading } = useQuery<Dataset>({
    queryKey: ['dataset', id],
    queryFn: async () => {
      if (!activeWorkspace) throw new Error('No workspace');
      const res = await datasetsApi.get(activeWorkspace.id, id);
      return res.data as Dataset;
    },
    enabled: !!activeWorkspace,
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

  if (!dataset) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <p className="text-lg font-semibold">Dataset not found</p>
        <Link href="/datasets">
          <Button variant="outline" className="mt-4">
            Back to Datasets
          </Button>
        </Link>
      </div>
    );
  }

  const latestVersion =
    dataset.versions?.find((v) => v.status === 'latest') ?? dataset.versions?.[0];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/datasets">
          <Button variant="ghost" size="icon" aria-label="Back to datasets">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{dataset.name}</h1>
            <Badge variant={dataset.status === 'active' ? 'success' : 'outline'}>
              {dataset.status}
            </Badge>
          </div>
          {dataset.description && (
            <p className="mt-1 text-sm text-muted-foreground">{dataset.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Updated {formatDistanceToNow(new Date(dataset.updatedAt), { addSuffix: true })}
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" />
          Upload new version
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main: preview */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Data Preview{latestVersion ? ` — v${latestVersion.versionNumber}` : ''}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestVersion ? (
                <DatasetPreview datasetId={id} versionId={latestVersion.id} />
              ) : (
                <p className="text-sm text-muted-foreground">No versions available yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: version history */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Version History</CardTitle>
            </CardHeader>
            <CardContent>
              <DatasetVersionList datasetId={id} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upload modal reuses CreateDatasetModal flow */}
      <CreateDatasetModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => setUploadOpen(false)}
      />
    </div>
  );
}
