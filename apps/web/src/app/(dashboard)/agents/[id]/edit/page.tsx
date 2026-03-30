'use client';

import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Download, Save, Upload } from 'lucide-react';
import { agentsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkflowCanvas } from '@/components/agents/WorkflowCanvas';
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
}

export default function AgentEditPage({ params }: { readonly params: { id: string } }) {
  const { id } = params;
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspaceStore();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [initialized, setInitialized] = useState(false);

  const { data: agent, isLoading: loadingAgent } = useQuery<Agent>({
    queryKey: ['agent', id],
    queryFn: async () => {
      if (!activeWorkspace) throw new Error('No workspace');
      const res = await agentsApi.get(activeWorkspace.id, id);
      return res.data as Agent;
    },
    enabled: !!activeWorkspace,
  });

  useQuery({
    queryKey: ['agent-versions', id],
    queryFn: async () => {
      if (!activeWorkspace) throw new Error('No workspace');
      const res = await agentsApi.versions(activeWorkspace.id, id);
      const versions = res.data as AgentVersion[];
      if (!initialized && versions.length > 0) {
        const latest = versions[0]!;
        setNodes(latest.workflowDefinition?.nodes ?? []);
        setEdges(latest.workflowDefinition?.edges ?? []);
        setInitialized(true);
      } else if (!initialized) {
        setInitialized(true);
      }
      return versions;
    },
    enabled: !!activeWorkspace,
  });

  const saveMutation = useMutation({
    mutationFn: () => agentsApi.saveWorkflow(activeWorkspace!.id, id, { nodes, edges }),
    onSuccess: () => {
      toast.success('Workflow saved');
      void queryClient.invalidateQueries({ queryKey: ['agent', id] });
      void queryClient.invalidateQueries({ queryKey: ['agent-versions', id] });
    },
    onError: () => toast.error('Failed to save workflow'),
  });

  const handleChange = useCallback((n: Node[], e: Edge[]) => {
    setNodes(n);
    setEdges(e);
  }, []);

  const handleExport = useCallback(() => {
    const json = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent?.name ?? 'workflow'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, agent?.name]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as {
          nodes: Node[];
          edges: Edge[];
        };
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
          toast.success('Workflow imported');
        } else {
          toast.error('Invalid workflow file');
        }
      } catch {
        toast.error('Failed to parse workflow file');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-imported
    e.target.value = '';
  }, []);

  if (loadingAgent || !initialized) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b px-4 py-2 bg-card">
        <Link href={`/agents/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{agent?.name ?? 'Agent'}</p>
          <p className="text-xs text-muted-foreground">Workflow Studio</p>
        </div>
        {/* Import */}
        <label>
          <input type="file" accept=".json" className="sr-only" onChange={handleImport} />
          <Button variant="outline" size="sm" asChild>
            <span className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </span>
          </Button>
        </label>
        {/* Export */}
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <WorkflowCanvas initialNodes={nodes} initialEdges={edges} onChange={handleChange} />
      </div>
    </div>
  );
}
