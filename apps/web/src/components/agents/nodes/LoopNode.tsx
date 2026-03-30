import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';

export interface LoopNodeData {
  label?: string;
  iterableKey?: string;
  maxIterations?: number;
  [key: string]: unknown;
}

export function LoopNode({ id, selected, data }: NodeProps) {
  const d = data as LoopNodeData;
  return (
    <BaseNode id={id} selected={selected} headerColor="bg-purple-600" headerLabel="Loop">
      <p className="font-medium text-foreground">{d.label ?? 'Loop'}</p>
      {d.iterableKey && (
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate max-w-[160px]">
          each {d.iterableKey}
        </p>
      )}
      {d.maxIterations !== undefined && (
        <p className="mt-1 text-muted-foreground">max {d.maxIterations} iterations</p>
      )}
    </BaseNode>
  );
}
