import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock @xyflow/react for the Node type import
vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

// Mock API
vi.mock('@/lib/api', () => ({
  promptsApi: {
    list: vi.fn().mockResolvedValue({ data: [{ id: 'p1', name: 'My Prompt' }] }),
  },
}));

// Mock workspace store
vi.mock('@/stores/workspace.store', () => ({
  useWorkspaceStore: () => ({
    activeWorkspace: { id: 'ws-1', name: 'Test Workspace', slug: 'test', organizationId: 'org-1' },
    setActiveWorkspace: vi.fn(),
  }),
}));

import { NodeConfigPanel } from '../NodeConfigPanel';
import type { Node } from '@xyflow/react';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const makeNode = (type: string, data: Record<string, unknown> = {}): Node =>
  ({
    id: `node-${type}`,
    type,
    position: { x: 0, y: 0 },
    data: { label: `${type} node`, ...data },
  }) as Node;

describe('NodeConfigPanel', () => {
  const onClose = vi.fn();
  const onUpdate = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the panel header with node type label', () => {
    render(
      <NodeConfigPanel
        node={makeNode('prompt')}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
      { wrapper },
    );
    expect(screen.getByText('Prompt Config')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <NodeConfigPanel
        node={makeNode('prompt')}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
      { wrapper },
    );
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onDelete when delete button is clicked (non-start node)', () => {
    render(
      <NodeConfigPanel
        node={makeNode('prompt')}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
      { wrapper },
    );
    const deleteBtn = screen.getByTitle('Delete node');
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('node-prompt');
  });

  it('does not show delete button for start node', () => {
    render(
      <NodeConfigPanel
        node={makeNode('start')}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
      { wrapper },
    );
    expect(screen.queryByTitle('Delete node')).toBeNull();
  });

  it('calls onUpdate when label input changes', () => {
    render(
      <NodeConfigPanel
        node={makeNode('condition', { label: 'old label' })}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
      { wrapper },
    );
    const input = screen.getByPlaceholderText('Node label');
    fireEvent.change(input, { target: { value: 'new label' } });
    expect(onUpdate).toHaveBeenCalledWith(
      'node-condition',
      expect.objectContaining({ label: 'new label' }),
    );
  });

  it('renders start node header with green color class', () => {
    const { container } = render(
      <NodeConfigPanel
        node={makeNode('start')}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
      { wrapper },
    );
    expect(container.querySelector('.bg-green-600')).toBeDefined();
  });

  it('renders output node header with pink color class', () => {
    const { container } = render(
      <NodeConfigPanel
        node={makeNode('output')}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
      { wrapper },
    );
    expect(container.querySelector('.bg-pink-600')).toBeDefined();
  });
});
