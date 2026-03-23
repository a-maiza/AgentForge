'use client';

import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Workspace {
  id: string;
  name: string;
  organizationId: string;
}

interface DeleteWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
  workspace: Workspace | null;
  onSuccess?: () => void;
}

export function DeleteWorkspaceModal({
  open,
  onClose,
  workspace,
  onSuccess,
}: DeleteWorkspaceModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (!workspace) throw new Error('No workspace selected');
      return workspacesApi.delete(workspace.organizationId, workspace.id);
    },
    onSuccess: () => {
      toast.success('Workspace deleted');
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      onClose();
      onSuccess?.();
    },
    onError: (error: unknown) => {
      const description =
        axios.isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'Please try again';
      toast.error('Failed to delete workspace', description);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isPending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Workspace</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{workspace?.name}</strong>? This will
            permanently remove all prompts, datasets, evaluations, and deployments inside it. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => mutate()} disabled={isPending}>
            {isPending ? 'Deleting…' : 'Delete Workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
