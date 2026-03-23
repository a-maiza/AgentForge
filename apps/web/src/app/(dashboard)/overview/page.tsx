'use client';

import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Bot, Database, Rocket, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { promptsApi, datasetsApi, workspacesApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Sparkline placeholder data
const sparkData = [
  { day: 'Mon', calls: 120 },
  { day: 'Tue', calls: 185 },
  { day: 'Wed', calls: 160 },
  { day: 'Thu', calls: 230 },
  { day: 'Fri', calls: 198 },
  { day: 'Sat', calls: 85 },
  { day: 'Sun', calls: 95 },
];

interface KpiCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}

function KpiCard({ title, value, description, icon: Icon, color, loading }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-3xl font-bold">{value}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function OverviewPage() {
  const { activeWorkspace } = useWorkspaceStore();

  const { data: prompts = [], isLoading: promptsLoading } = useQuery({
    queryKey: ['prompts', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return [];
      const res = await promptsApi.list(activeWorkspace.id);
      return res.data as { id: string; status: string }[];
    },
    enabled: !!activeWorkspace,
  });

  const { data: datasets = [], isLoading: datasetsLoading } = useQuery({
    queryKey: ['datasets', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return [];
      const res = await datasetsApi.list(activeWorkspace.id);
      return res.data as { id: string }[];
    },
    enabled: !!activeWorkspace,
  });

  const { data: deploymentData, isLoading: deploymentsLoading } = useQuery({
    queryKey: ['active-deployments-count', activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace) return { count: 0 };
      const res = await workspacesApi.activeDeploymentCount(activeWorkspace.id);
      return res.data as { count: number };
    },
    enabled: !!activeWorkspace,
  });

  const totalPrompts = prompts.length;
  const activePrompts = prompts.filter((p) => p.status === 'active').length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {activeWorkspace
            ? `Workspace: ${activeWorkspace.name}`
            : 'Select a workspace to get started'}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Prompts"
          value={totalPrompts}
          description={`${activePrompts} active`}
          icon={MessageSquare}
          color="bg-indigo-600"
          loading={promptsLoading}
        />
        <KpiCard
          title="Agents"
          value="—"
          description="Coming in phase 3"
          icon={Bot}
          color="bg-violet-600"
        />
        <KpiCard
          title="Datasets"
          value={datasets.length}
          description={`${datasets.length} dataset${datasets.length !== 1 ? 's' : ''} in this workspace`}
          icon={Database}
          color="bg-emerald-500"
          loading={datasetsLoading}
        />
        <KpiCard
          title="Active Deployments"
          value={deploymentData?.count ?? 0}
          description="Live prompt deployments"
          icon={Rocket}
          color="bg-amber-500"
          loading={deploymentsLoading}
        />
      </div>

      {/* API call volume chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">API Call Volume</CardTitle>
              <CardDescription>Last 7 days (sample data)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={sparkData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <defs>
                <linearGradient id="callsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Area
                type="monotone"
                dataKey="calls"
                stroke="#4F46E5"
                strokeWidth={2}
                fill="url(#callsGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-600" />
              Prompt Library
            </CardTitle>
            <CardDescription>
              {totalPrompts > 0
                ? `You have ${totalPrompts} prompt${totalPrompts !== 1 ? 's' : ''}. Click to manage them.`
                : 'No prompts yet. Create your first prompt →'}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4 text-violet-600" />
              Deploy to Gateway
            </CardTitle>
            <CardDescription>Go live with your prompts via the Fastify API gateway</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
