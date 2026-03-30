'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { agentsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, Plus, Trash2 } from 'lucide-react';

interface Variable {
  key: string;
  value: string;
}

interface TraceEntry {
  nodeId: string;
  type: string;
  output: unknown;
}

interface TestRunResult {
  trace: TraceEntry[];
  output: unknown;
}

interface TestRunPanelProps {
  workspaceId: string;
  agentId: string;
}

export function TestRunPanel({ workspaceId, agentId }: TestRunPanelProps) {
  const [variables, setVariables] = useState<Variable[]>([{ key: '', value: '' }]);
  const [result, setResult] = useState<TestRunResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const inputs = Object.fromEntries(
        variables.filter((v) => v.key.trim()).map((v) => [v.key.trim(), v.value]),
      );
      return agentsApi.testRun(workspaceId, agentId, inputs);
    },
    onSuccess: (res) => setResult(res.data as TestRunResult),
  });

  const addVariable = () => setVariables((vs) => [...vs, { key: '', value: '' }]);

  const removeVariable = (idx: number) => setVariables((vs) => vs.filter((_, i) => i !== idx));

  const updateVariable = (idx: number, field: 'key' | 'value', val: string) =>
    setVariables((vs) => vs.map((v, i) => (i === idx ? { ...v, [field]: val } : v)));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Input Variables</p>
          <Button variant="ghost" size="sm" onClick={addVariable}>
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>

        {variables.map((v, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="flex-1">
              <Label className="sr-only">Key</Label>
              <Input
                placeholder="variable_name"
                value={v.key}
                onChange={(e) => updateVariable(idx, 'key', e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label className="sr-only">Value</Label>
              <Input
                placeholder="value"
                value={v.value}
                onChange={(e) => updateVariable(idx, 'value', e.target.value)}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeVariable(idx)}
              disabled={variables.length === 1}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}

        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Play className="mr-2 h-4 w-4" />
          {mutation.isPending ? 'Running…' : 'Run Test'}
        </Button>

        {mutation.isError && (
          <p className="text-xs text-destructive">Test run failed. Check the API logs.</p>
        )}
      </div>

      {result && (
        <div className="rounded-lg border p-5 space-y-4">
          <p className="text-sm font-semibold">Execution Trace</p>
          <div className="space-y-2">
            {result.trace.map((entry, i) => (
              <div key={i} className="rounded-md bg-muted px-3 py-2 text-xs">
                <p className="font-medium">
                  {entry.type} <span className="text-muted-foreground">({entry.nodeId})</span>
                </p>
                <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {JSON.stringify(entry.output, null, 2)}
                </pre>
              </div>
            ))}
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">Final Output</p>
            <pre className="rounded-md bg-muted px-3 py-2 text-xs whitespace-pre-wrap">
              {JSON.stringify(result.output, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
