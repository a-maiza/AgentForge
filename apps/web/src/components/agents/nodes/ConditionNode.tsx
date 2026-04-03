import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';

export interface ConditionNodeData {
  label?: string;
  expression?: string;
  [key: string]: unknown;
}

export function ConditionNode({ selected, data }: NodeProps) {
  const d = data as ConditionNodeData;
  return (
    <div
      className={cn(
        'min-w-[180px] rounded-lg border-2 bg-card shadow-md',
        selected ? 'border-primary' : 'border-border',
      )}
    >
      {/* Target handle — left */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
      />

      <div className="rounded-t-md px-3 py-1.5 text-xs font-semibold text-white bg-orange-500">
        Condition
      </div>

      <div className="px-3 py-2 text-xs">
        <p className="font-medium text-foreground">{d.label ?? 'Condition'}</p>
        {d.expression && (
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate max-w-[160px]">
            {d.expression}
          </p>
        )}
        <div className="mt-2 flex justify-between text-[10px] font-semibold">
          <span className="text-green-600">✓ true</span>
          <span className="text-red-500">✗ false</span>
        </div>
      </div>

      {/* True handle — top-right */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '35%' }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-background"
      />
      {/* False handle — bottom-right */}
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '65%' }}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-background"
      />
    </div>
  );
}
