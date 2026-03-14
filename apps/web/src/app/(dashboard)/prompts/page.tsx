'use client';

import { useState } from 'react';
import { PromptList } from '@/components/prompts/PromptList';
import { CreatePromptModal } from '@/components/prompts/CreatePromptModal';
import { useRouter } from 'next/navigation';

export default function PromptsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Prompts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage and version your LLM prompts</p>
      </div>

      <PromptList onCreateClick={() => setCreateOpen(true)} />

      <CreatePromptModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={(id) => router.push(`/prompts/${id}`)}
      />
    </div>
  );
}
