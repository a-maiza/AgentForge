'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { promptsApi } from '@/lib/api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface RegressionResult {
  degraded: string[];
}

interface QualityBadgeProps {
  workspaceId: string;
  promptId: string;
}

export function QualityBadge({ workspaceId, promptId }: QualityBadgeProps) {
  const { data } = useQuery<RegressionResult | null>({
    queryKey: ['quality-badge', promptId],
    queryFn: async () => {
      try {
        const res = await promptsApi.regressionTest(workspaceId, promptId);
        return res.data as RegressionResult;
      } catch {
        // No baseline or no evaluations — badge not applicable
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!data || data.degraded.length === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center text-amber-500">
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Performance degraded: {data.degraded.join(', ')}</p>
      </TooltipContent>
    </Tooltip>
  );
}
