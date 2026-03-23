'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Plus, Building2 } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { workspacesApi } from '@/lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
}

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { activeWorkspace, setActiveWorkspace } = useWorkspaceStore();

  const { data: workspaces = [] } = useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await workspacesApi.list();
      // API returns WorkspaceMember[] with nested workspace; Prisma field is orgId not organizationId
      const members = res.data as {
        workspace: { id: string; name: string; slug: string; orgId: string };
      }[];
      const list: Workspace[] = members.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        organizationId: m.workspace.orgId,
      }));
      // Auto-select if none stored or stored value is stale (wrong shape from old code)
      const storedIsValid = activeWorkspace && list.some((ws) => ws.id === activeWorkspace.id);
      if (list.length > 0 && !storedIsValid) {
        setActiveWorkspace(list[0] ?? null);
      }
      return list;
    },
  });

  if (collapsed) {
    return (
      <div className="flex h-12 items-center justify-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white">
          <Building2 className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-white/10 focus:outline-none">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white text-xs font-bold">
            {activeWorkspace?.name.charAt(0).toUpperCase() ?? 'W'}
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-start">
            <span className="truncate text-sm font-medium">
              {activeWorkspace?.name ?? 'Select workspace'}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onSelect={() => setActiveWorkspace(ws)}
            className={cn(activeWorkspace?.id === ws.id && 'bg-accent')}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 text-white text-xs font-bold mr-2">
              {ws.name.charAt(0).toUpperCase()}
            </div>
            <span className="truncate">{ws.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Plus className="mr-2 h-4 w-4" />
          New workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
