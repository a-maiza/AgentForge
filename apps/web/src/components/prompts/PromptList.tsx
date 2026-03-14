'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Search, Grid3X3, List, Table2, Plus, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { promptsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'table' | 'list';
type StatusFilter = 'all' | 'draft' | 'active' | 'archived';

interface Prompt {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updatedAt: string;
  versions?: { versionNumber: number }[];
}

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'outline'> = {
  active: 'success',
  draft: 'warning',
  archived: 'outline',
};

function PromptSkeleton({ view }: { view: ViewMode }) {
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

export function PromptList({ onCreateClick }: { onCreateClick: () => void }) {
  const [view, setView] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { activeWorkspace } = useWorkspaceStore();
  const router = useRouter();

  const { data: prompts = [], isLoading } = useQuery<Prompt[]>({
    queryKey: ['prompts', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return [];
      const res = await promptsApi.list(activeWorkspace.id);
      return res.data as Prompt[];
    },
    enabled: !!activeWorkspace,
  });

  const filtered = prompts.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

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
          New Prompt
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
            <PromptSkeleton key={i} view={view} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <FileText className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {search || statusFilter !== 'all' ? 'No prompts match your filters' : 'No prompts yet'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first prompt to get started'}
          </p>
          {!search && statusFilter === 'all' && (
            <Button className="mt-4" onClick={onCreateClick}>
              <Plus className="h-4 w-4" />
              Create your first prompt
            </Button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((prompt) => (
            <Card
              key={prompt.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(`/prompts/${prompt.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{prompt.name}</CardTitle>
                  <Badge variant={statusVariant[prompt.status] ?? 'outline'}>{prompt.status}</Badge>
                </div>
                {prompt.description && (
                  <CardDescription className="line-clamp-2">{prompt.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(prompt.updatedAt), { addSuffix: true })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((prompt) => (
            <div
              key={prompt.id}
              className="flex cursor-pointer items-center gap-4 rounded-md border bg-card p-3 transition-colors hover:bg-accent"
              onClick={() => router.push(`/prompts/${prompt.id}`)}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{prompt.name}</p>
                {prompt.description && (
                  <p className="truncate text-xs text-muted-foreground">{prompt.description}</p>
                )}
              </div>
              <Badge variant={statusVariant[prompt.status] ?? 'outline'}>{prompt.status}</Badge>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(prompt.updatedAt), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
