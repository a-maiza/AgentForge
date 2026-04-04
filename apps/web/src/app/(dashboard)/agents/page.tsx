'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Bot } from 'lucide-react';
import { agentsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateAgentModal } from '@/components/agents/CreateAgentModal';

interface Agent {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'live' | 'archived';
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'secondary',
  live: 'default',
  archived: 'outline',
};

export default function AgentsPage() {
  const router = useRouter();
  const { activeWorkspace } = useWorkspaceStore();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['agents', activeWorkspace?.id],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const res = await agentsApi.list(activeWorkspace!.id, { take: 25, ...(pageParam ? { cursor: pageParam } : {}) });
      return res.data as { items: Agent[]; nextCursor: string | null };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!activeWorkspace?.id,
  });

  const agents = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build and manage multi-step agent workflows
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!activeWorkspace}>
          <Plus className="mr-2 h-4 w-4" />
          New Agent
        </Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && agents.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <Bot className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-semibold">No agents yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first agent to build a workflow
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Agent
          </Button>
        </div>
      )}

      {!isLoading && agents.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => router.push(`/agents/${agent.id}`)}
                className="rounded-lg border bg-card p-5 text-left hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="font-semibold truncate">{agent.name}</p>
                  </div>
                  <Badge variant={STATUS_COLORS[agent.status] as 'default' | 'secondary' | 'outline'}>
                    {agent.status}
                  </Badge>
                </div>
                {agent.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {agent.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  v{agent.currentVersion} · updated {new Date(agent.updatedAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
          {hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}

      {activeWorkspace && (
        <CreateAgentModal
          workspaceId={activeWorkspace.id}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => router.push(`/agents/${id}`)}
        />
      )}
    </div>
  );
}
