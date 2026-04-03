'use client';

import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type NodeTypes,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { StartNode } from './nodes/StartNode';
import { PromptNode } from './nodes/PromptNode';
import { ConditionNode } from './nodes/ConditionNode';
import { LoopNode } from './nodes/LoopNode';
import { ParallelNode } from './nodes/ParallelNode';
import { OutputNode } from './nodes/OutputNode';
import { NodeConfigPanel } from './NodeConfigPanel';

const nodeTypes: NodeTypes = {
  start: StartNode,
  prompt: PromptNode,
  condition: ConditionNode,
  loop: LoopNode,
  parallel: ParallelNode,
  output: OutputNode,
};

const PALETTE_ITEMS = [
  { type: 'start', label: 'Start', subtitle: 'Entry Point', color: 'bg-green-600' },
  { type: 'prompt', label: 'Prompt', subtitle: 'AI prompt', color: 'bg-blue-600' },
  { type: 'condition', label: 'Condition', subtitle: 'If/else', color: 'bg-orange-500' },
  { type: 'loop', label: 'Loop', subtitle: 'Iterate', color: 'bg-purple-600' },
  { type: 'parallel', label: 'Parallel', subtitle: 'Concurrent', color: 'bg-emerald-700' },
  { type: 'output', label: 'Output', subtitle: 'Display', color: 'bg-pink-600' },
];

interface WorkflowCanvasProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onChange?: (nodes: Node[], edges: Edge[]) => void;
  readOnly?: boolean;
}

let nodeIdCounter = 100;
function nextId(type: string) {
  return `${type}-${++nodeIdCounter}`;
}

function WorkflowCanvasInner({
  initialNodes = [],
  initialEdges = [],
  onChange,
  readOnly = false,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes.length > 0
      ? initialNodes
      : [{ id: 'start-1', type: 'start', position: { x: 80, y: 200 }, data: { label: 'Start' } }],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const dragTypeRef = useRef<string | null>(null);

  const notify = useCallback(
    (n: Node[], e: Edge[]) => onChange?.(n, e),
    [onChange],
  );

  // ── Connections ────────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        // Label true/false edges from condition nodes
        const sourceNode = nodes.find((n) => n.id === connection.source);
        const label =
          sourceNode?.type === 'condition' && connection.sourceHandle
            ? connection.sourceHandle
            : undefined;
        const next = addEdge({ ...connection, ...(label && { label }) }, eds);
        notify(nodes, next);
        return next;
      });
    },
    [nodes, notify, setEdges],
  );

  // ── Node changes ───────────────────────────────────────────────────────────

  const handleNodesChange = useCallback(
    (...args: Parameters<typeof onNodesChange>) => {
      onNodesChange(...args);
      notify(nodes, edges);
    },
    [onNodesChange, nodes, edges, notify],
  );

  // ── Add node (click from palette) ──────────────────────────────────────────

  const addNode = useCallback(
    (type: string, label: string, position?: { x: number; y: number }) => {
      const id = nextId(type);
      const newNode: Node = {
        id,
        type,
        position: position ?? { x: 280 + Math.random() * 80, y: 100 + Math.random() * 200 },
        data: { label },
      };
      setNodes((nds) => {
        const next = [...nds, newNode];
        notify(next, edges);
        return next;
      });
      setSelectedNodeId(id);
    },
    [edges, notify, setNodes],
  );

  // ── Drag from palette ──────────────────────────────────────────────────────

  const onDragStart = useCallback((e: React.DragEvent, type: string) => {
    dragTypeRef.current = type;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = dragTypeRef.current;
      if (!type) return;
      dragTypeRef.current = null;
      const item = PALETTE_ITEMS.find((p) => p.type === type);
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(type, item?.label ?? type, position);
    },
    [addNode, screenToFlowPosition],
  );

  // ── Node selection ─────────────────────────────────────────────────────────

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    if (!readOnly) setSelectedNodeId(node.id);
  }, [readOnly]);

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  // ── Update node data (from config panel) ───────────────────────────────────

  const updateNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) => {
        const next = nds.map((n) => (n.id === nodeId ? { ...n, data } : n));
        notify(next, edges);
        return next;
      });
    },
    [edges, notify, setNodes],
  );

  // ── Delete node ────────────────────────────────────────────────────────────

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => {
        const next = nds.filter((n) => n.id !== nodeId);
        notify(next, edges);
        return next;
      });
      setEdges((eds) => {
        const next = eds.filter((e) => e.source !== nodeId && e.target !== nodeId);
        notify(nodes, next);
        return next;
      });
      setSelectedNodeId(null);
    },
    [edges, nodes, notify, setEdges, setNodes],
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="flex h-full">
      {/* ── Palette ─────────────────────────────────────────────────── */}
      {!readOnly && (
        <div className="w-44 shrink-0 border-r bg-card p-3 space-y-1.5 overflow-y-auto">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Node Palette
          </p>
          <p className="text-[10px] text-muted-foreground mb-2">
            Drag to canvas or click to add
          </p>
          {PALETTE_ITEMS.map((item) => (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
              onClick={() => addNode(item.type, item.label)}
              className="w-full rounded-md border text-left px-2.5 py-2 text-xs hover:bg-accent transition-colors cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${item.color}`} />
                <div>
                  <p className="font-medium leading-tight">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{item.subtitle}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="pt-3 border-t mt-3">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              • Drag to canvas
              <br />
              • Connect handles
              <br />
              • Click to config
              <br />
              • Delete key to remove
            </p>
          </div>
        </div>
      )}

      {/* ── Canvas ──────────────────────────────────────────────────── */}
      <div className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          {...(!readOnly && {
            onNodesChange: handleNodesChange,
            onEdgesChange: onEdgesChange,
            onConnect: onConnect,
          })}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{ animated: true, type: 'smoothstep' }}
          deleteKeyCode={['Delete', 'Backspace']}
          fitView
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>

        {/* Node count badge */}
        {!readOnly && (
          <div className="absolute top-3 left-3 pointer-events-none">
            <span className="rounded-full bg-background/80 border px-3 py-1 text-xs text-muted-foreground shadow-sm">
              {nodes.length} node{nodes.length !== 1 ? 's' : ''} · {edges.length} edge{edges.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* ── Config panel ────────────────────────────────────────────── */}
      {!readOnly && selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          onUpdate={updateNodeData}
          onDelete={deleteNode}
        />
      )}
    </div>
  );
}

// Wrap with ReactFlowProvider so screenToFlowPosition works
export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
