'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { promptsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PromptEditor } from '@/components/prompts/PromptEditor';

interface Prompt {
  id: string;
  name: string;
  versions?: { versionNumber: number; content: string }[];
}

export default function PromptEditPage({ params }: { params: Promise<{ id: string }> }) {
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
        <Skeleton className="h-96 w-full" />
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

  const latestContent = prompt.versions?.[0]?.content ?? '';

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <Link href={`/prompts/${id}`}>
          <Button variant="ghost" size="icon" aria-label="Back to prompt">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <span className="text-sm text-muted-foreground">Editing prompt</span>
      </div>

      <div className="flex-1">
        <PromptEditor promptId={id} initialContent={latestContent} initialName={prompt.name} />
      </div>
    </div>
  );
}
