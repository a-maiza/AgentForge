import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';

export interface BaseNodeProps {
  id: string;
  selected?: boolean;
  children: React.ReactNode;
  headerColor: string;
  headerLabel: string;
  showTargetHandle?: boolean;
  showSourceHandle?: boolean;
}

export function BaseNode({
  selected,
  children,
  headerColor,
  headerLabel,
  showTargetHandle = true,
  showSourceHandle = true,
}: BaseNodeProps) {
  return (
    <div
      className={cn(
        'min-w-[180px] rounded-lg border-2 bg-card shadow-md',
        selected ? 'border-primary' : 'border-border',
      )}
    >
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
        />
      )}
      <div className={cn('rounded-t-md px-3 py-1.5 text-xs font-semibold text-white', headerColor)}>
        {headerLabel}
      </div>
      <div className="px-3 py-2 text-xs">{children}</div>
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
        />
      )}
    </div>
  );
}
