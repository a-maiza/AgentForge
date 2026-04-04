'use client';

import { useQuery } from '@tanstack/react-query';
import { X, Plus, Trash2 } from 'lucide-react';
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
import { promptsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import type { Node } from '@xyflow/react';

interface NodeConfigPanelProps {
  node: Node;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onDelete: (nodeId: string) => void;
}

interface Prompt {
  id: string;
  name: string;
}

interface Variable {
  name: string;
  type: string;
  defaultValue?: string;
}

const ENVIRONMENTS = ['dev', 'staging', 'prod'] as const;
const VAR_TYPES = ['string', 'number', 'boolean', 'array', 'object'] as const;

export function NodeConfigPanel({ node, onClose, onUpdate, onDelete }: NodeConfigPanelProps) {
  const { activeWorkspace } = useWorkspaceStore();
  const data = node.data as Record<string, unknown>;

  const { data: prompts = [] } = useQuery<Prompt[]>({
    queryKey: ['prompts', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return [];
      const res = await promptsApi.list(activeWorkspace.id);
      return res.data as Prompt[];
    },
    enabled: !!activeWorkspace && (node.type === 'prompt' || node.type === 'start'),
  });

  function set(key: string, value: unknown) {
    onUpdate(node.id, { ...data, [key]: value });
  }

  // ── Variable helpers (Start node) ──────────────────────────────────────────
  const variables: Variable[] = (data.variables as Variable[]) ?? [];

  function addVariable() {
    set('variables', [...variables, { name: '', type: 'string', defaultValue: '' }]);
  }

  function updateVariable(index: number, patch: Partial<Variable>) {
    const next = variables.map((v, i) => (i === index ? { ...v, ...patch } : v));
    set('variables', next);
  }

  function removeVariable(index: number) {
    set('variables', variables.filter((_, i) => i !== index));
  }

  // ── Type label ─────────────────────────────────────────────────────────────
  const TYPE_LABELS: Record<string, string> = {
    start: 'Start',
    prompt: 'Prompt',
    condition: 'Condition',
    loop: 'Loop',
    parallel: 'Parallel',
    output: 'Output',
  };

  const TYPE_COLORS: Record<string, string> = {
    start: 'bg-green-600',
    prompt: 'bg-blue-600',
    condition: 'bg-orange-500',
    loop: 'bg-purple-600',
    parallel: 'bg-emerald-700',
    output: 'bg-pink-600',
  };

  const headerColor = TYPE_COLORS[node.type ?? ''] ?? 'bg-muted';
  const headerLabel = TYPE_LABELS[node.type ?? ''] ?? node.type ?? 'Node';

  return (
    <div className="w-72 shrink-0 border-l bg-card flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 text-white ${headerColor}`}>
        <span className="text-sm font-semibold">{headerLabel} Config</span>
        <div className="flex items-center gap-1">
          {node.type !== 'start' && (
            <button
              onClick={() => onDelete(node.id)}
              className="rounded p-1 hover:bg-white/20 transition-colors"
              title="Delete node"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-white/20 transition-colors"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Common: Label */}
        <div className="space-y-1">
          <Label className="text-xs">Label</Label>
          <Input
            className="h-7 text-xs"
            value={(data.label as string) ?? ''}
            onChange={(e) => set('label', e.target.value)}
            placeholder="Node label"
          />
        </div>

        {/* ── Start ──────────────────────────────────────────────────────── */}
        {node.type === 'start' && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Initial Prompt</Label>
              <Select
                value={(data.promptId as string) ?? ''}
                onValueChange={(v) => {
                  const p = prompts.find((x) => x.id === v);
                  set('promptId', v);
                  set('promptName', p?.name ?? '');
                }}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Select prompt…" />
                </SelectTrigger>
                <SelectContent>
                  {prompts.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Environment</Label>
              <Select
                value={(data.environment as string) ?? ''}
                onValueChange={(v) => set('environment', v)}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Select environment…" />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENTS.map((e) => (
                    <SelectItem key={e} value={e} className="text-xs">
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Input Variables</Label>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={addVariable}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {variables.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">No variables</p>
              )}
              {variables.map((v, i) => (
                <div key={i} className="flex gap-1 items-start">
                  <Input
                    className="h-6 text-[10px] flex-1"
                    placeholder="name"
                    value={v.name}
                    onChange={(e) => updateVariable(i, { name: e.target.value })}
                  />
                  <Select
                    value={v.type}
                    onValueChange={(val) => updateVariable(i, { type: val })}
                  >
                    <SelectTrigger className="h-6 text-[10px] w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VAR_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="text-[10px]">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => removeVariable(i)}
                    className="mt-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Prompt ─────────────────────────────────────────────────────── */}
        {node.type === 'prompt' && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Prompt</Label>
              <Select
                value={(data.promptId as string) ?? ''}
                onValueChange={(v) => {
                  const p = prompts.find((x) => x.id === v);
                  set('promptId', v);
                  set('promptName', p?.name ?? '');
                }}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Select prompt…" />
                </SelectTrigger>
                <SelectContent>
                  {prompts.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Environment</Label>
              <Select
                value={(data.environment as string) ?? ''}
                onValueChange={(v) => set('environment', v)}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENTS.map((e) => (
                    <SelectItem key={e} value={e} className="text-xs">
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Output Key</Label>
              <Input
                className="h-7 text-xs font-mono"
                value={(data.outputKey as string) ?? ''}
                onChange={(e) => set('outputKey', e.target.value)}
                placeholder="e.g. summary"
              />
            </div>
          </>
        )}

        {/* ── Condition ──────────────────────────────────────────────────── */}
        {node.type === 'condition' && (
          <div className="space-y-1">
            <Label className="text-xs">Expression</Label>
            <Input
              className="h-7 text-xs font-mono"
              value={(data.expression as string) ?? ''}
              onChange={(e) => set('expression', e.target.value)}
              placeholder="e.g. score > 0.8"
            />
            <p className="text-[10px] text-muted-foreground">
              Top handle = true &nbsp;·&nbsp; Bottom handle = false
            </p>
          </div>
        )}

        {/* ── Loop ───────────────────────────────────────────────────────── */}
        {node.type === 'loop' && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Iterable Key</Label>
              <Input
                className="h-7 text-xs font-mono"
                value={(data.iterableKey as string) ?? ''}
                onChange={(e) => set('iterableKey', e.target.value)}
                placeholder="e.g. items"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Iterations</Label>
              <Input
                className="h-7 text-xs"
                type="number"
                min={1}
                max={1000}
                value={(data.maxIterations as number) ?? 10}
                onChange={(e) => set('maxIterations', Number(e.target.value))}
              />
            </div>
          </>
        )}

        {/* ── Parallel ───────────────────────────────────────────────────── */}
        {node.type === 'parallel' && (
          <div className="space-y-1">
            <Label className="text-xs">Branches</Label>
            <Input
              className="h-7 text-xs"
              type="number"
              min={2}
              max={10}
              value={(data.branches as number) ?? 2}
              onChange={(e) => set('branches', Number(e.target.value))}
            />
          </div>
        )}

        {/* ── Output ─────────────────────────────────────────────────────── */}
        {node.type === 'output' && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Output Key</Label>
              <Input
                className="h-7 text-xs font-mono"
                value={(data.outputKey as string) ?? ''}
                onChange={(e) => set('outputKey', e.target.value)}
                placeholder="e.g. result"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Format</Label>
              <Select
                value={(data.format as string) ?? 'text'}
                onValueChange={(v) => set('format', v)}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text" className="text-xs">
                    Text
                  </SelectItem>
                  <SelectItem value="json" className="text-xs">
                    JSON
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
