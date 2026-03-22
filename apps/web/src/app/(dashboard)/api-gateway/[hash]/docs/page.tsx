'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface PromptVariable {
  name: string;
  type: string;
}

interface DocsDeployment {
  id: string;
  endpointHash: string;
  versionLabel: string;
  environment: string;
  prompt?: {
    name: string;
    variables: PromptVariable[];
  };
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    toast.success('Copied');
  };
  return (
    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={copy}>
      <Copy className="h-3 w-3" />
      {label ?? 'Copy'}
    </Button>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div className="relative rounded-md bg-muted">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs text-muted-foreground">{lang}</span>
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto p-4 text-xs">{code}</pre>
    </div>
  );
}

export default function EndpointDocsPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = use(params);
  const { activeWorkspace } = useWorkspaceStore();

  const gatewayUrl = process.env['NEXT_PUBLIC_GATEWAY_URL'] ?? 'http://localhost:3002';
  const endpointUrl = `${gatewayUrl}/api/v1/live/${hash}`;

  // Find the deployment by scanning all prompts (same approach as gateway page)
  const { data: deployment, isLoading } = useQuery<DocsDeployment | null>({
    queryKey: ['deployment-by-hash', hash, activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return null;
      const promptsRes = await api.get(`/api/workspaces/${activeWorkspace.id}/prompts`);
      const prompts = promptsRes.data as {
        id: string;
        name: string;
        variables?: PromptVariable[];
      }[];

      for (const p of prompts) {
        try {
          const depRes = await api.get(`/api/prompts/${p.id}/deployments`);
          const envMap = depRes.data as Record<string, DocsDeployment | null>;
          for (const dep of Object.values(envMap)) {
            if (dep?.endpointHash === hash) {
              return { ...dep, prompt: { name: p.name, variables: p.variables ?? [] } };
            }
          }
        } catch {
          /* skip */
        }
      }
      return null;
    },
    enabled: !!activeWorkspace,
  });

  const variables = deployment?.prompt?.variables ?? [];
  const variablesJson = JSON.stringify(
    Object.fromEntries(variables.map((v) => [v.name, `<${v.name}>`])),
    null,
    2,
  );

  const curlSnippet = `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <your_api_key>" \\
  -d '{
    "variables": ${variablesJson}
  }'`;

  const pythonSnippet = `import requests

response = requests.post(
    "${endpointUrl}",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer <your_api_key>",
    },
    json={
        "variables": ${variablesJson},
    },
)
data = response.json()
print(data["output"])`;

  const nodeSnippet = `const response = await fetch("${endpointUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer <your_api_key>",
  },
  body: JSON.stringify({
    variables: ${variablesJson},
  }),
});

const data = await response.json();
console.log(data.output);`;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/api-gateway">
          <Button variant="ghost" size="icon" aria-label="Back to gateway">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {deployment?.prompt?.name ?? `Endpoint ${hash.slice(0, 8)}…`}
            </h1>
            {deployment && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Live
              </Badge>
            )}
          </div>
          {deployment && (
            <p className="mt-1 text-sm text-muted-foreground">
              {deployment.environment.toUpperCase()} · v{deployment.versionLabel}
            </p>
          )}
        </div>
      </div>

      {/* Endpoint URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Endpoint URL</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
            <code className="flex-1 text-xs break-all">{endpointUrl}</code>
            <CopyButton value={endpointUrl} />
          </div>
        </CardContent>
      </Card>

      {/* Auth */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Include your API key as a{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">Bearer</code> token in the{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">Authorization</code> header.
          </p>
          <CodeBlock lang="http" code={`Authorization: Bearer sk_ws_<your_key>`} />
        </CardContent>
      </Card>

      {/* Request / Response schema */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Request Body</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock
              lang="json"
              code={`{
  "variables": ${variablesJson}
}`}
            />
            {variables.length > 0 && (
              <div className="mt-3 space-y-1">
                {variables.map((v) => (
                  <div key={v.name} className="flex items-center gap-2 text-xs">
                    <code className="font-mono text-primary">{v.name}</code>
                    <span className="text-muted-foreground">{v.type}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Response</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock
              lang="json"
              code={`{
  "output": "The LLM response text",
  "latency_ms": 312,
  "tokens": {
    "prompt": 42,
    "completion": 128,
    "total": 170
  }
}`}
            />
          </CardContent>
        </Card>
      </div>

      {/* Code snippets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Code Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="curl">
            <TabsList className="mb-4">
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="node">Node.js</TabsTrigger>
            </TabsList>
            <TabsContent value="curl">
              <CodeBlock lang="bash" code={curlSnippet} />
            </TabsContent>
            <TabsContent value="python">
              <CodeBlock lang="python" code={pythonSnippet} />
            </TabsContent>
            <TabsContent value="node">
              <CodeBlock lang="javascript" code={nodeSnippet} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
