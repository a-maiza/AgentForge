import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';

export interface ConditionNodeData {
  label?: string;
  expression?: string;
  [key: string]: unknown;
}

export function ConditionNode({ id, selected, data }: NodeProps) {
  const d = data as ConditionNodeData;
  return (
    <BaseNode id={id} selected={selected} headerColor="bg-orange-500" headerLabel="Condition">
      <p className="font-medium text-foreground">{d.label ?? 'Condition'}</p>
      {d.expression && (
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate max-w-[160px]">
          {d.expression}
        </p>
      )}
    </BaseNode>
  );
}
