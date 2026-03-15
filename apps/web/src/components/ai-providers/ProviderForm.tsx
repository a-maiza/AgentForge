'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { aiProvidersApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Provider } from '@/components/ai-providers/ProviderCard';

const PROVIDER_TYPES = ['openai', 'anthropic', 'gemini', 'cohere', 'mistral', 'custom'] as const;
type ProviderType = (typeof PROVIDER_TYPES)[number];

const MODELS: Record<ProviderType, string[]> = {
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  cohere: ['command-r-plus', 'command-r'],
  mistral: ['mistral-large-latest', 'mistral-medium-latest'],
  custom: [],
};

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Provider | null;
}

export function ProviderForm({ open, onClose, editing }: Props) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspaceStore();

  const [name, setName] = useState('');
  const [providerType, setProviderType] = useState<ProviderType>('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [showKey, setShowKey] = useState(false);

  const isEdit = !!editing;

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setProviderType((editing.providerType as ProviderType) ?? 'openai');
      setApiKey('');
      setBaseUrl('');
      setModel('');
      setCustomModel('');
    } else {
      setName('');
      setProviderType('openai');
      setApiKey('');
      setBaseUrl('');
      setModel(MODELS.openai[0] ?? '');
      setCustomModel('');
    }
  }, [editing, open]);

  const modelList = MODELS[providerType];

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (isEdit && editing) {
        return aiProvidersApi.update(editing.id, data);
      }
      if (!activeWorkspace) throw new Error('No workspace');
      return aiProvidersApi.create(activeWorkspace.id, data);
    },
    onSuccess: async () => {
      if (activeWorkspace) {
        await queryClient.invalidateQueries({ queryKey: ['ai-providers', activeWorkspace.id] });
      }
      toast.success(isEdit ? 'Provider updated' : 'Provider created');
      onClose();
    },
    onError: () => toast.error('Failed to save provider'),
  });

  const handleSubmit = () => {
    if (!name.trim()) return;
    const data: Record<string, unknown> = {
      name: name.trim(),
      providerType,
      model: providerType === 'custom' ? customModel : model,
    };
    if (apiKey) data.apiKey = apiKey;
    if (providerType === 'custom' && baseUrl) data.baseUrl = baseUrl;
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Provider' : 'Add AI Provider'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="prov-name">Name *</Label>
            <Input
              id="prov-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My OpenAI key"
            />
          </div>

          <div className="space-y-1">
            <Label>Provider Type</Label>
            <Select
              value={providerType}
              onValueChange={(v) => {
                const pt = v as ProviderType;
                setProviderType(pt);
                setModel(MODELS[pt][0] ?? '');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="prov-key">API Key</Label>
            <div className="relative">
              <Input
                id="prov-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isEdit ? '••••••••' : 'sk-...'}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {providerType === 'custom' && (
            <div className="space-y-1">
              <Label htmlFor="prov-url">Base URL</Label>
              <Input
                id="prov-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label>Model</Label>
            {providerType === 'custom' ? (
              <Input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="e.g. my-custom-model"
              />
            ) : (
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelList.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending || !name.trim()}>
            {isEdit ? 'Save Changes' : 'Add Provider'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
