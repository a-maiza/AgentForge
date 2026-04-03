'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit, GitBranch, Trash2 } from 'lucide-react';
import { agentsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { WorkflowCanvas } from '@/components/agents/WorkflowCanvas';
import { TestRunPanel } from '@/components/agents/TestRunPanel';
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
import type { Node, Edge } from '@xyflow/react';

interface AgentVersion {
  id: string;
  versionNumber: number;
  workflowDefinition: { nodes: Node[]; edges: Edge[] };
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'live' | 'archived';
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  versions?: AgentVersion[];
}

export default function AgentDetailPage({ params }: { readonly params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspaceStore();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ['agent', id],
    queryFn: async () => {
      if (!activeWorkspace) throw new Error('No workspace');
      const res = await agentsApi.get(activeWorkspace.id, id);
      return res.data as Agent;
    },
    enabled: !!activeWorkspace,
  });

  const { data: versionsData } = useQuery({
    queryKey: ['agent-versions', id],
    queryFn: async () => {
      if (!activeWorkspace) throw new Error('No workspace');
      const res = await agentsApi.versions(activeWorkspace.id, id);
      return res.data as AgentVersion[];
    },
    enabled: !!activeWorkspace,
  });

  const deleteMutation = useMutation({
    mutationFn: () => agentsApi.remove(activeWorkspace!.id, id),
    onSuccess: () => {
      toast.success('Agent deleted');
      void queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace?.id] });
      router.push('/agents');
    },
    onError: () => toast.error('Failed to delete agent'),
  });

  const latestVersion = versionsData?.[0];
  const workflowNodes: Node[] = latestVersion?.workflowDefinition?.nodes ?? [];
  const workflowEdges: Edge[] = latestVersion?.workflowDefinition?.edges ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/agents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold truncate">{agent.name}</h1>
            <Badge variant={agent.status === 'live' ? 'default' : 'secondary'}>
              {agent.status}
            </Badge>
          </div>
          {agent.description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{agent.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={() => router.push(`/agents/${id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Workflow
          </Button>
          <Button variant="destructive" size="icon" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="workflow">
        <TabsList>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="test-run">Test Run</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="mt-4">
          <div className="relative h-[520px] rounded-lg border overflow-hidden">
            <WorkflowCanvas initialNodes={workflowNodes} initialEdges={workflowEdges} readOnly />

            {/* Empty-state overlay — shown when no real nodes have been added yet */}
            {workflowNodes.length <= 1 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
                <GitBranch className="h-10 w-10 text-muted-foreground" />
                <p className="text-lg font-semibold">No workflow built yet</p>
                <p className="text-sm text-muted-foreground">
                  Use the Workflow Studio to add nodes and connect them
                </p>
                <Button asChild>
                  <Link href={`/agents/${id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Open Workflow Studio
                  </Link>
                </Button>
              </div>
            )}

            {/* Edit shortcut badge when a real workflow exists */}
            {workflowNodes.length > 1 && (
              <div className="absolute top-3 right-3 pointer-events-auto">
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/agents/${id}/edit`}>
                    <Edit className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="test-run" className="mt-4">
          {activeWorkspace && <TestRunPanel workspaceId={activeWorkspace.id} agentId={id} />}
        </TabsContent>

        <TabsContent value="versions" className="mt-4">
          {!versionsData || versionsData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions saved yet.</p>
          ) : (
            <div className="space-y-2">
              {versionsData.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">Version {v.versionNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {v.versionNumber === agent.currentVersion && (
                    <Badge variant="secondary">current</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{agent.name}&rdquo; and all its versions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
