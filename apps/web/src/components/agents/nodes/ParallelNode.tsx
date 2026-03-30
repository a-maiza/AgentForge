import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';

export interface ParallelNodeData {
  label?: string;
  branches?: number;
  [key: string]: unknown;
}

export function ParallelNode({ id, selected, data }: NodeProps) {
  const d = data as ParallelNodeData;
  return (
    <BaseNode id={id} selected={selected} headerColor="bg-emerald-700" headerLabel="Parallel">
      <p className="font-medium text-foreground">{d.label ?? 'Parallel'}</p>
      {(d.branches ?? 0) > 0 && (
        <p className="mt-0.5 text-muted-foreground">{d.branches} branch(es)</p>
      )}
    </BaseNode>
  );
}
