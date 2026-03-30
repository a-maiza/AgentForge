import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';

export interface PromptNodeData {
  label?: string;
  promptName?: string;
  environment?: string;
  outputKey?: string;
  [key: string]: unknown;
}

export function PromptNode({ id, selected, data }: NodeProps) {
  const d = data as PromptNodeData;
  return (
    <BaseNode id={id} selected={selected} headerColor="bg-blue-600" headerLabel="Prompt">
      <p className="font-medium text-foreground">{d.label ?? 'Prompt'}</p>
      {d.promptName && (
        <p className="mt-0.5 text-muted-foreground truncate max-w-[160px]">{d.promptName}</p>
      )}
      {d.environment && (
        <span className="mt-1 inline-block rounded bg-blue-100 px-1 text-[10px] text-blue-800">
          {d.environment}
        </span>
      )}
      {d.outputKey && (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">→ {d.outputKey}</p>
      )}
    </BaseNode>
  );
}
