'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { promptAiConfigsApi, aiProvidersApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'cohere' | 'mistral' | 'custom';

const MODELS: Record<ProviderType, string[]> = {
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  cohere: ['command-r-plus', 'command-r'],
  mistral: ['mistral-large-latest', 'mistral-medium-latest'],
  custom: [],
};

interface AiConfig {
  providerId?: string;
  modelName?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

interface Provider {
  id: string;
  name: string;
  providerType: string;
}

interface Props {
  readonly promptId: string;
}

export function AiProviderTab({ promptId }: Props) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspaceStore();

  const [providerId, setProviderId] = useState('');
  const [modelName, setModelName] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(1);
  const [maxTokens, setMaxTokens] = useState(1024);

  const { data: config, isLoading: configLoading } = useQuery<AiConfig>({
    queryKey: ['prompt-ai-config', promptId],
    queryFn: async () => {
      if (!activeWorkspace) return {};
      const res = await promptAiConfigsApi.get(activeWorkspace.id, promptId);
      return res.data as AiConfig;
    },
    enabled: !!activeWorkspace,
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery<Provider[]>({
    queryKey: ['ai-providers', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return [];
      const res = await aiProvidersApi.list(activeWorkspace.id);
      return res.data as Provider[];
    },
    enabled: !!activeWorkspace,
  });

  useEffect(() => {
    if (config) {
      setProviderId(config.providerId ?? '');
      setModelName(config.modelName ?? '');
      if (config.temperature !== undefined) setTemperature(config.temperature);
      if (config.topP !== undefined) setTopP(config.topP);
      if (config.maxTokens !== undefined) setMaxTokens(config.maxTokens);
    }
  }, [config]);

  const activeProvider = providers.find((p) => p.id === providerId);
  const providerType = (activeProvider?.providerType ?? 'openai') as ProviderType;
  const modelList = MODELS[providerType] ?? [];

  const saveMutation = useMutation({
    mutationFn: () =>
      promptAiConfigsApi.upsert(activeWorkspace!.id, promptId, {
        providerId,
        modelName,
        temperature,
        topP,
        maxTokens,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['prompt-ai-config', promptId] });
      toast.success('AI configuration saved');
    },
    onError: () => toast.error('Failed to save configuration'),
  });

  if (configLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI Provider Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Provider select */}
        <div className="space-y-1">
          <Label>Provider</Label>
          {providersLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              value={providerId}
              onValueChange={(v) => {
                setProviderId(v);
                setModelName('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider…" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Model select */}
        <div className="space-y-1">
          <Label>Model</Label>
          {modelList.length > 0 ? (
            <Select value={modelName} onValueChange={setModelName}>
              <SelectTrigger>
                <SelectValue placeholder="Select model…" />
              </SelectTrigger>
              <SelectContent>
                {modelList.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g. my-custom-model"
            />
          )}
        </div>

        {/* Temperature */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Temperature</Label>
            <Input
              type="number"
              min={0}
              max={2}
              step={0.01}
              value={temperature}
              onChange={(e) => setTemperature(Number.parseFloat(e.target.value))}
              className="h-7 w-20 text-xs"
            />
          </div>
          <Slider
            value={[temperature]}
            onValueChange={(vals) => setTemperature(vals[0] ?? temperature)}
            min={0}
            max={2}
            step={0.01}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 (precise)</span>
            <span>2 (creative)</span>
          </div>
        </div>

        {/* Top P */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Top P</Label>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={topP}
              onChange={(e) => setTopP(Number.parseFloat(e.target.value))}
              className="h-7 w-20 text-xs"
            />
          </div>
          <Slider
            value={[topP]}
            onValueChange={(vals) => setTopP(vals[0] ?? topP)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>

        {/* Max Tokens */}
        <div className="space-y-1">
          <Label htmlFor="max-tokens">Max Tokens</Label>
          <Input
            id="max-tokens"
            type="number"
            min={100}
            max={32000}
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number.parseInt(e.target.value, 10))}
          />
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          Save Configuration
        </Button>
      </CardContent>
    </Card>
  );
}
