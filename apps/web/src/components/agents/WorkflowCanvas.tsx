'use client';

import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeTypes,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { StartNode } from './nodes/StartNode';
import { PromptNode } from './nodes/PromptNode';
import { ConditionNode } from './nodes/ConditionNode';
import { LoopNode } from './nodes/LoopNode';
import { ParallelNode } from './nodes/ParallelNode';
import { OutputNode } from './nodes/OutputNode';

const nodeTypes: NodeTypes = {
  start: StartNode,
  prompt: PromptNode,
  condition: ConditionNode,
  loop: LoopNode,
  parallel: ParallelNode,
  output: OutputNode,
};

const PALETTE_ITEMS = [
  { type: 'prompt', label: 'Prompt', color: 'bg-blue-600' },
  { type: 'condition', label: 'Condition', color: 'bg-orange-500' },
  { type: 'loop', label: 'Loop', color: 'bg-purple-600' },
  { type: 'parallel', label: 'Parallel', color: 'bg-emerald-700' },
  { type: 'output', label: 'Output', color: 'bg-pink-600' },
];

interface WorkflowCanvasProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onChange?: (nodes: Node[], edges: Edge[]) => void;
  readOnly?: boolean;
}

export function WorkflowCanvas({
  initialNodes = [],
  initialEdges = [],
  onChange,
  readOnly = false,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes.length > 0
      ? initialNodes
      : [
          {
            id: 'start-1',
            type: 'start',
            position: { x: 80, y: 200 },
            data: { label: 'Start' },
          },
        ],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeCounter, setNodeCounter] = useState(1);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const next = addEdge(connection, eds);
        onChange?.(nodes, next);
        return next;
      });
    },
    [nodes, onChange, setEdges],
  );

  const handleNodesChange = useCallback(
    (...args: Parameters<typeof onNodesChange>) => {
      onNodesChange(...args);
      onChange?.(nodes, edges);
    },
    [onNodesChange, nodes, edges, onChange],
  );

  const addNode = useCallback(
    (type: string, label: string) => {
      const id = `${type}-${nodeCounter + 1}`;
      setNodeCounter((c) => c + 1);
      const newNode: Node = {
        id,
        type,
        position: { x: 300 + Math.random() * 100, y: 100 + Math.random() * 200 },
        data: { label },
      };
      setNodes((nds) => {
        const next = [...nds, newNode];
        onChange?.(next, edges);
        return next;
      });
    },
    [nodeCounter, edges, onChange, setNodes],
  );

  return (
    <div className="flex h-full">
      {!readOnly && (
        <div className="w-44 shrink-0 border-r bg-card p-3 space-y-2 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Nodes
          </p>
          {PALETTE_ITEMS.map((item) => (
            <button
              key={item.type}
              onClick={() => addNode(item.type, item.label)}
              className="w-full rounded-md border text-left px-3 py-2 text-xs hover:bg-accent transition-colors"
            >
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${item.color}`} />
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          {...(!readOnly && {
            onNodesChange: handleNodesChange,
            onEdgesChange: onEdgesChange,
            onConnect: onConnect,
          })}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
