'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface CreateOrganizationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (org: Organization) => void;
}

export function CreateOrganizationModal({
  open,
  onClose,
  onSuccess,
}: CreateOrganizationModalProps) {
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
    mutationFn: (data: FormData) => organizationsApi.create(data),
    onSuccess: (res) => {
      toast.success('Organization created');
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      const org = res.data as Organization;
      reset();
      onClose();
      onSuccess?.(org);
    },
    onError: (error: unknown) => {
      const description =
        axios.isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'Please try again';
      toast.error('Failed to create organization', description);
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
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>Organizations contain workspaces and team members.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Name *</Label>
            <Input id="org-name" placeholder="e.g. Acme Corp" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-slug">Slug *</Label>
            <Input id="org-slug" placeholder="acme-corp" {...register('slug')} />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
