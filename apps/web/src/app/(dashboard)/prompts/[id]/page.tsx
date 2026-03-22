'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Edit, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { promptsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatasetTab } from '@/components/prompts/DatasetTab';
import { AiProviderTab } from '@/components/prompts/AiProviderTab';
import { EnvironmentsTab } from '@/components/prompts/EnvironmentsTab';
import { FailoverTab } from '@/components/prompts/FailoverTab';

interface Version {
  id: string;
  versionNumber: number;
  content: string;
  createdAt: string;
}

interface Prompt {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updatedAt: string;
  createdAt: string;
  versions?: Version[];
  variables?: { name: string; type: string }[];
}

function promptStatusVariant(status: string): 'success' | 'warning' | 'outline' {
  if (status === 'active') return 'success';
  if (status === 'draft') return 'warning';
  return 'outline';
}

export default function PromptDetailPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { activeWorkspace } = useWorkspaceStore();

  const { data: prompt, isLoading } = useQuery<Prompt>({
    queryKey: ['prompt', id],
    queryFn: async () => {
      if (!activeWorkspace) throw new Error('No workspace');
      const res = await promptsApi.get(activeWorkspace.id, id);
      return res.data as Prompt;
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

  if (!prompt) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <p className="text-lg font-semibold">Prompt not found</p>
        <Link href="/prompts">
          <Button variant="outline" className="mt-4">
            Back to Prompts
          </Button>
        </Link>
      </div>
    );
  }

  const latestVersion = prompt.versions?.[0];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/prompts">
          <Button variant="ghost" size="icon" aria-label="Back to prompts">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{prompt.name}</h1>
            <Badge variant={promptStatusVariant(prompt.status)}>{prompt.status}</Badge>
          </div>
          {prompt.description && (
            <p className="mt-1 text-sm text-muted-foreground">{prompt.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Updated {formatDistanceToNow(new Date(prompt.updatedAt), { addSuffix: true })}
          </p>
        </div>
        <Link href={`/prompts/${id}/edit`}>
          <Button>
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        </Link>
      </div>

      {/* Purple gradient banner */}
      <div className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 p-4 text-white">
        <p className="text-sm font-medium">
          Version {latestVersion?.versionNumber ?? 1} · {prompt.variables?.length ?? 0} variables
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="dataset">Dataset</TabsTrigger>
          <TabsTrigger value="ai-provider">AI Provider</TabsTrigger>
          <TabsTrigger value="environments">Environments</TabsTrigger>
          <TabsTrigger value="failover">Failover</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Versions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{prompt.versions?.length ?? 1}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Variables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{prompt.variables?.length ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={prompt.status === 'active' ? 'success' : 'warning'}
                  className="text-base px-3 py-1"
                >
                  {prompt.status}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Variables */}
          {prompt.variables && prompt.variables.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Variables</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {prompt.variables.map((v) => (
                    <Badge key={v.name} variant="secondary" className="font-mono">
                      {`{{${v.name}}}`}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="prompt" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Current Content (v{latestVersion?.versionNumber ?? 1})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap font-mono text-sm text-foreground bg-muted rounded-md p-4 overflow-auto">
                {latestVersion?.content ?? ''}
              </pre>
            </CardContent>
          </Card>

          {/* Version history */}
          {prompt.versions && prompt.versions.length > 1 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Version History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {prompt.versions.map((v) => (
                    <div key={v.id} className="flex items-center gap-3 rounded-md border p-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">v{v.versionNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="dataset" className="mt-4">
          <DatasetTab promptId={id} variables={prompt.variables ?? []} />
        </TabsContent>

        <TabsContent value="ai-provider" className="mt-4">
          <AiProviderTab promptId={id} />
        </TabsContent>

        <TabsContent value="environments" className="mt-4">
          <EnvironmentsTab promptId={id} versions={prompt.versions ?? []} />
        </TabsContent>

        <TabsContent value="failover" className="mt-4">
          <FailoverTab promptId={id} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
            <p className="text-lg font-semibold">Analytics</p>
            <p className="mt-1 text-sm text-muted-foreground">Coming in Phase 4</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
