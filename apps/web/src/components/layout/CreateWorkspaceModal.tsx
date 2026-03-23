'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
});

type FormData = z.infer<typeof schema>;

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
}

interface CreateWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (workspace: Workspace) => void;
  /** Explicit org ID — required when no workspace is active yet (e.g. after creating a new org) */
  organizationId?: string | undefined;
}

export function CreateWorkspaceModal({
  open,
  onClose,
  onSuccess,
  organizationId,
}: CreateWorkspaceModalProps) {
  const { activeWorkspace, setActiveWorkspace } = useWorkspaceStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const nameValue = watch('name', '');

  useEffect(() => {
    setValue('slug', toSlug(nameValue));
  }, [nameValue, setValue]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => {
      const orgId = organizationId ?? activeWorkspace?.organizationId;
      if (!orgId) throw new Error('No active organization');
      return workspacesApi.create(orgId, data);
    },
    onSuccess: (res) => {
      toast.success('Workspace created');
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      const ws = res.data as Workspace;
      setActiveWorkspace(ws);
      reset();
      onClose();
      onSuccess?.(ws);
    },
    onError: (error: unknown) => {
      const description =
        axios.isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'Please try again';
      toast.error('Failed to create workspace', description);
    },
  });

  const handleClose = () => {
    if (!isPending) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Add a new workspace to your organization to organize resources.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Name *</Label>
            <Input id="ws-name" placeholder="e.g. Production" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ws-slug">Slug *</Label>
            <Input id="ws-slug" placeholder="production" {...register('slug')} />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
