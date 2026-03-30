import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';

export interface OutputNodeData {
  label?: string;
  outputKey?: string;
  [key: string]: unknown;
}

export function OutputNode({ id, selected, data }: NodeProps) {
  const d = data as OutputNodeData;
  return (
    <BaseNode
      id={id}
      selected={selected}
      headerColor="bg-pink-600"
      headerLabel="Output"
      showSourceHandle={false}
    >
      <p className="font-medium text-foreground">{d.label ?? 'Output'}</p>
      {d.outputKey && (
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">→ {d.outputKey}</p>
      )}
    </BaseNode>
  );
}
