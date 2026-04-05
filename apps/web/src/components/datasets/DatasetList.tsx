'use client';

import { useState } from 'react';
import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Search, Grid3X3, List, Table2, Plus, Database, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { datasetsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
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
import { toast } from 'sonner';

type ViewMode = 'grid' | 'table' | 'list';

interface DatasetVersion {
  id: string;
  versionNumber: number;
  rowCount: number;
}

interface Dataset {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updatedAt: string;
  versions?: DatasetVersion[];
}

const statusVariant: Record<string, 'success' | 'outline'> = {
  active: 'success',
  archived: 'outline',
};

function DatasetSkeleton({ view }: { view: ViewMode }) {
  if (view === 'grid') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="flex items-center gap-4 rounded-md border p-3">
      <Skeleton className="h-9 w-9 rounded-md" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-5 w-16" />
    </div>
  );
}

export function DatasetList({ onCreateClick }: { onCreateClick: () => void }) {
  const [view, setView] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Dataset | null>(null);
  const { activeWorkspace } = useWorkspaceStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => datasetsApi.delete(activeWorkspace!.id, id),
    onSuccess: () => {
      toast.success('Dataset deleted');
      void queryClient.invalidateQueries({ queryKey: ['datasets', activeWorkspace?.id] });
      setDeleteTarget(null);
    },
    onError: () => toast.error('Failed to delete dataset'),
  });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['datasets', activeWorkspace?.id],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!activeWorkspace) return { items: [], nextCursor: null };
      const res = await datasetsApi.list(activeWorkspace.id, { take: 25, ...(pageParam ? { cursor: pageParam } : {}) });
      return res.data as { items: Dataset[]; nextCursor: string | null };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!activeWorkspace,
  });

  const datasets = data?.pages.flatMap((p) => p.items) ?? [];

  const filtered = datasets.filter((d) => {
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q);
  });

  const latestVersion = (d: Dataset) => d.versions?.[0];

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search datasets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex rounded-md border">
          {(
            [
              ['grid', Grid3X3],
              ['list', List],
              ['table', Table2],
            ] as [ViewMode, React.ElementType][]
          ).map(([mode, Icon]) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={cn(
                'flex h-9 w-9 items-center justify-center transition-colors',
                view === mode
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-label={`${mode} view`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <Button onClick={onCreateClick}>
          <Plus className="h-4 w-4" />
          New Dataset
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div
          className={cn(
            view === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2',
          )}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <DatasetSkeleton key={i} view={view} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Database className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {search ? 'No datasets match your search' : 'No datasets yet'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search ? 'Try adjusting your search' : 'Upload your first dataset to get started'}
          </p>
          {!search && (
            <Button className="mt-4" onClick={onCreateClick}>
              <Plus className="h-4 w-4" />
              Create your first dataset
            </Button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((dataset) => (
            <Card
              key={dataset.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(`/datasets/${dataset.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{dataset.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Badge variant={statusVariant[dataset.status] ?? 'outline'}>
                      {dataset.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(dataset);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {dataset.description && (
                  <CardDescription className="line-clamp-2">{dataset.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{latestVersion(dataset)?.rowCount ?? 0} rows</span>
                  <span>·</span>
                  <span>{dataset.versions?.length ?? 0} version(s)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(dataset.updatedAt), { addSuffix: true })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((dataset) => (
            <div
              key={dataset.id}
              className="flex cursor-pointer items-center gap-4 rounded-md border bg-card p-3 transition-colors hover:bg-accent"
              onClick={() => router.push(`/datasets/${dataset.id}`)}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
                <Database className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{dataset.name}</p>
                {dataset.description && (
                  <p className="truncate text-xs text-muted-foreground">{dataset.description}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {latestVersion(dataset)?.rowCount ?? 0} rows
              </span>
              <Badge variant={statusVariant[dataset.status] ?? 'outline'}>{dataset.status}</Badge>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(dataset.updatedAt), { addSuffix: true })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(dataset);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete dataset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.name}&rdquo; and all its versions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
