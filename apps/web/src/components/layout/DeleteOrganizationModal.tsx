'use client';

import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api';
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

interface Organization {
  id: string;
  name: string;
}

interface DeleteOrganizationModalProps {
  open: boolean;
  onClose: () => void;
  organization: Organization | null;
  onSuccess?: () => void;
}

export function DeleteOrganizationModal({
  open,
  onClose,
  organization,
  onSuccess,
}: DeleteOrganizationModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (!organization) throw new Error('No organization selected');
      return organizationsApi.delete(organization.id);
    },
    onSuccess: () => {
      toast.success('Organization deleted');
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      onClose();
      onSuccess?.();
    },
    onError: (error: unknown) => {
      const description =
        axios.isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'Please try again';
      toast.error('Failed to delete organization', description);
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
          <DialogTitle>Delete Organization</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{organization?.name}</strong>? This will
            permanently remove the organization and <em>all</em> its workspaces, prompts, datasets,
            and evaluations. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => mutate()} disabled={isPending}>
            {isPending ? 'Deleting…' : 'Delete Organization'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
