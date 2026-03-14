'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { promptsApi } from '@/lib/api';
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
import { Textarea } from '@/components/ui/textarea';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  content: z.string().min(1, 'Content is required'),
});

type FormData = z.infer<typeof schema>;

interface CreatePromptModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (id: string) => void;
}

export function CreatePromptModal({ open, onClose, onSuccess }: CreatePromptModalProps) {
  const { activeWorkspace } = useWorkspaceStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => {
      if (!activeWorkspace) throw new Error('No workspace selected');
      return promptsApi.create(activeWorkspace.id, {
        name: data.name,
        content: data.content,
        ...(data.description ? { description: data.description } : {}),
      });
    },
    onSuccess: (res) => {
      toast.success('Prompt created successfully');
      void queryClient.invalidateQueries({ queryKey: ['prompts', activeWorkspace?.id] });
      reset();
      onClose();
      onSuccess?.((res.data as { id: string }).id);
    },
    onError: () => {
      toast.error('Failed to create prompt', 'Please try again');
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Prompt</DialogTitle>
          <DialogDescription>
            Add a new prompt to your workspace. Use {'{{variable}}'} syntax for dynamic variables.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" placeholder="e.g. Customer Support Reply" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="What does this prompt do?"
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              placeholder="You are a helpful assistant. The user is {{name}} and wants help with {{topic}}."
              className="min-h-[120px] font-mono text-sm"
              {...register('content')}
            />
            {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Prompt'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
