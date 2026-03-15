'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Cpu } from 'lucide-react';
import { aiProvidersApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProviderCard, type Provider } from '@/components/ai-providers/ProviderCard';
import { ProviderForm } from '@/components/ai-providers/ProviderForm';

export default function AiProvidersPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);

  const { data: providers = [], isLoading } = useQuery<Provider[]>({
    queryKey: ['ai-providers', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return [];
      const res = await aiProvidersApi.list(activeWorkspace.id);
      return res.data as Provider[];
    },
    enabled: !!activeWorkspace,
  });

  const handleEdit = (provider: Provider) => {
    setEditing(provider);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Providers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage API keys and model configurations
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Provider
        </Button>
      </div>

      {/* Grid */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(['a', 'b', 'c'] as const).map((k) => (
            <Skeleton key={k} className="h-36 rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && providers.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Cpu className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No providers yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first AI provider to start evaluating prompts
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Provider
          </Button>
        </div>
      )}

      {!isLoading && providers.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              workspaceId={activeWorkspace?.id ?? ''}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      <ProviderForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        editing={editing}
      />
    </div>
  );
}
