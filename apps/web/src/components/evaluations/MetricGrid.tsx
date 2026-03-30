'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { metricsApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Metric {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface Suggestion {
  metric: string;
  match_pct: number;
  reason: string;
}

interface Props {
  selectedMetrics: string[];
  onToggle: (id: string) => void;
  suggestions?: Suggestion[];
}

const CATEGORIES = [
  'All',
  'Quality',
  'Coherence',
  'Consistency',
  'Cost',
  'Performance',
  'Speed',
  'Sustainability',
  'Composite',
] as const;

type Category = (typeof CATEGORIES)[number];

export function MetricGrid({ selectedMetrics, onToggle, suggestions = [] }: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>('All');

  const { data: metrics = [], isLoading } = useQuery<Metric[]>({
    queryKey: ['metrics'],
    queryFn: async () => {
      const res = await metricsApi.list();
      return res.data as Metric[];
    },
  });

  const filtered = metrics.filter((m) => activeCategory === 'All' || m.category === activeCategory);

  const suggestionMap = new Map(suggestions.map((s) => [s.metric, s]));

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(['a', 'b', 'c', 'd', 'e', 'f'] as const).map((k) => (
          <Skeleton key={k} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((metric) => {
          const suggestion = suggestionMap.get(metric.id) ?? suggestionMap.get(metric.name);
          const isSelected = selectedMetrics.includes(metric.id);

          return (
            <div
              key={metric.id}
              onClick={() => onToggle(metric.id)}
              className={cn(
                'relative rounded-lg border p-3 cursor-pointer transition-colors',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30',
              )}
            >
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggle(metric.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <p className="text-sm font-medium">{metric.name}</p>
                    {suggestion && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 font-medium">
                        <Sparkles className="h-2.5 w-2.5" />
                        AI · {(suggestion.match_pct * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 mt-0.5">
                    {metric.category}
                  </Badge>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {metric.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
