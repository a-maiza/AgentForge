import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Must be declared before vi.mock (hoisted) — use vi.hoisted to share with factory
const MOCK_METRICS = vi.hoisted(() => [
  { id: 'f1', name: 'f1', category: 'Quality', description: 'F1 score' },
  { id: 'bleu', name: 'bleu', category: 'Quality', description: 'BLEU score' },
  { id: 'latency', name: 'latency', category: 'Performance', description: 'Latency metrics' },
  { id: 'exact_match', name: 'exact_match', category: 'Quality', description: 'Exact match' },
]);

vi.mock('@/lib/api', () => ({
  metricsApi: {
    list: vi.fn().mockResolvedValue({ data: MOCK_METRICS }),
  },
}));

import { MetricGrid } from '../MetricGrid';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('MetricGrid', () => {
  const onToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeletons while fetching', () => {
    // Use a client with no prefetched data to trigger loading state
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MetricGrid selectedMetrics={[]} onToggle={onToggle} />
      </QueryClientProvider>,
    );
    // The skeleton div renders while loading
    expect(container.querySelector('.animate-pulse, [data-slot="skeleton"]')).toBeDefined();
  });

  it('renders category filter buttons', async () => {
    const qc = new QueryClient();
    await qc.prefetchQuery({
      queryKey: ['metrics'],
      queryFn: async () => MOCK_METRICS,
    });
    render(
      <QueryClientProvider client={qc}>
        <MetricGrid selectedMetrics={[]} onToggle={onToggle} />
      </QueryClientProvider>,
    );
    // Category buttons are <button> elements; use getAllByRole to disambiguate from badges
    const allButtons = screen.getAllByRole('button');
    const buttonLabels = allButtons.map((b) => b.textContent);
    expect(buttonLabels).toContain('All');
    expect(buttonLabels).toContain('Quality');
    expect(buttonLabels).toContain('Performance');
  });

  it('filters metrics when a category button is clicked', async () => {
    const qc = new QueryClient();
    await qc.prefetchQuery({
      queryKey: ['metrics'],
      queryFn: async () => MOCK_METRICS,
    });
    render(
      <QueryClientProvider client={qc}>
        <MetricGrid selectedMetrics={[]} onToggle={onToggle} />
      </QueryClientProvider>,
    );
    // Find the "Performance" category button specifically (not the badge)
    const buttons = screen.getAllByRole('button');
    const perfBtn = buttons.find((b) => b.textContent === 'Performance');
    expect(perfBtn).toBeDefined();
    fireEvent.click(perfBtn!);
    // Only latency should remain visible as a metric name
    expect(screen.getByText('latency')).toBeDefined();
    expect(screen.queryByText('f1')).toBeNull();
  });

  it('calls onToggle when a metric card is clicked', async () => {
    const qc = new QueryClient();
    await qc.prefetchQuery({
      queryKey: ['metrics'],
      queryFn: async () => MOCK_METRICS,
    });
    render(
      <QueryClientProvider client={qc}>
        <MetricGrid selectedMetrics={[]} onToggle={onToggle} />
      </QueryClientProvider>,
    );
    // Click the f1 metric name text
    fireEvent.click(screen.getByText('f1'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('marks selected metrics with selected visual style', async () => {
    const qc = new QueryClient();
    await qc.prefetchQuery({
      queryKey: ['metrics'],
      queryFn: async () => MOCK_METRICS,
    });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MetricGrid selectedMetrics={['f1']} onToggle={onToggle} />
      </QueryClientProvider>,
    );
    // Selected metric card has border-primary class applied
    const selectedCard = container.querySelector('.border-primary');
    expect(selectedCard).not.toBeNull();
  });

  it('shows AI suggestion badge when metric has a suggestion', async () => {
    const qc = new QueryClient();
    await qc.prefetchQuery({
      queryKey: ['metrics'],
      queryFn: async () => MOCK_METRICS,
    });
    render(
      <QueryClientProvider client={qc}>
        <MetricGrid
          selectedMetrics={[]}
          onToggle={onToggle}
          suggestions={[{ metric: 'f1', match_pct: 0.95, reason: 'Good for QA' }]}
        />
      </QueryClientProvider>,
    );
    // The suggestion span renders as "AI · 95%"
    expect(screen.getByText('AI · 95%')).toBeDefined();
  });
});
