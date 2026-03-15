'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { aiProvidersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export interface Provider {
  id: string;
  name: string;
  providerType: string;
  isActive: boolean;
  createdAt: string;
}

const typeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  openai: 'default',
  anthropic: 'secondary',
  gemini: 'outline',
  cohere: 'outline',
  mistral: 'outline',
  custom: 'outline',
};

interface Props {
  provider: Provider;
  workspaceId: string;
  onEdit: (provider: Provider) => void;
}

export function ProviderCard({ provider, workspaceId, onEdit }: Props) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => aiProvidersApi.delete(provider.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ai-providers', workspaceId] });
      toast.success('Provider deleted');
    },
    onError: () => toast.error('Failed to delete provider'),
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{provider.name}</CardTitle>
            <Badge variant={typeVariant[provider.providerType] ?? 'outline'}>
              {provider.providerType}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${provider.isActive ? 'bg-emerald-500' : 'bg-muted-foreground'}`}
            />
            <span className="text-xs text-muted-foreground">
              {provider.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Added {formatDistanceToNow(new Date(provider.createdAt), { addSuffix: true })}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(provider)}>
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Provider</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{provider.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteMutation.mutate();
                setConfirmDelete(false);
              }}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
