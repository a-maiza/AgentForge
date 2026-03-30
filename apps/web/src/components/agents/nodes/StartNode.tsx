import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';

export interface StartNodeData {
  label?: string;
  promptName?: string;
  environment?: string;
  variables?: { name: string; type: string; defaultValue?: string }[];
  [key: string]: unknown;
}

export function StartNode({ id, selected, data }: NodeProps) {
  const d = data as StartNodeData;
  return (
    <BaseNode
      id={id}
      selected={selected}
      headerColor="bg-green-600"
      headerLabel="Start"
      showTargetHandle={false}
    >
      <p className="font-medium text-foreground">{d.label ?? 'Start'}</p>
      {d.promptName && (
        <p className="mt-0.5 text-muted-foreground truncate max-w-[160px]">{d.promptName}</p>
      )}
      {d.environment && (
        <span className="mt-1 inline-block rounded bg-green-100 px-1 text-[10px] text-green-800">
          {d.environment}
        </span>
      )}
      {(d.variables?.length ?? 0) > 0 && (
        <p className="mt-1 text-muted-foreground">{d.variables!.length} variable(s)</p>
      )}
    </BaseNode>
  );
}
