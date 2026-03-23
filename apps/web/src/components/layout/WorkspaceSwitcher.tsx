'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronsUpDown, Plus, Building2, FolderOpen, Check } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { workspacesApi, organizationsApi } from '@/lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CreateOrganizationModal } from './CreateOrganizationModal';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { activeWorkspace, setActiveWorkspace } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [wsModalOpen, setWsModalOpen] = useState(false);
  const [wsModalOrgId, setWsModalOrgId] = useState<string | undefined>(undefined);

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

  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await organizationsApi.list();
      // API returns OrgMember[] with nested { org: Organization }
      const members = res.data as { org: Organization }[];
      return members.map((m) => m.org);
    },
  });

  const activeOrg = organizations.find((o) => o.id === activeWorkspace?.organizationId);

  const handleOrgCreated = (org: Organization) => {
    void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    // After creating an org, open workspace creation so user can set up their first workspace.
    // Pass the new org's ID explicitly — activeWorkspace may still be null at this point.
    const firstWsForOrg = workspaces.find((ws) => ws.organizationId === org.id);
    if (!firstWsForOrg) {
      setWsModalOrgId(org.id);
      setWsModalOpen(true);
    }
  };

  if (collapsed) {
    return (
      <div className="flex h-12 items-center justify-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white">
          <Building2 className="h-4 w-4" />
        </div>
      </div>
    );
  }

  // Group workspaces by org for the dropdown
  const workspacesByOrg = organizations.reduce<Record<string, Workspace[]>>((acc, org) => {
    acc[org.id] = workspaces.filter((ws) => ws.organizationId === org.id);
    return acc;
  }, {});

  const showGrouped = organizations.length > 1;

  const handleOrgSelect = (org: Organization) => {
    const firstWs = workspacesByOrg[org.id]?.[0];
    if (firstWs) {
      setActiveWorkspace(firstWs);
    } else {
      setWsModalOrgId(org.id);
      setWsModalOpen(true);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-white/10 focus:outline-none">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white text-xs font-bold">
              {activeWorkspace?.name.charAt(0).toUpperCase() ?? 'W'}
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-start">
              {activeOrg && (
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {activeOrg.name}
                </span>
              )}
              <span className="truncate text-sm font-medium">
                {activeWorkspace?.name ?? 'Select workspace'}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-64" align="start">
          {showGrouped ? (
            organizations.map((org) => (
              <div key={org.id}>
                <DropdownMenuItem
                  onSelect={() => handleOrgSelect(org)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium text-muted-foreground',
                    activeOrg?.id === org.id && 'text-foreground',
                  )}
                >
                  <Building2 className="h-3 w-3" />
                  <span className="flex-1 truncate">{org.name}</span>
                  {activeOrg?.id === org.id && <Check className="ml-auto h-3 w-3" />}
                </DropdownMenuItem>
                {(workspacesByOrg[org.id] ?? []).map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onSelect={() => setActiveWorkspace(ws)}
                    className={cn(activeWorkspace?.id === ws.id && 'bg-accent')}
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-600 text-white text-xs font-bold mr-2">
                      {ws.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{ws.name}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </div>
            ))
          ) : (
            <>
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
            </>
          )}

          <DropdownMenuItem
            onSelect={() => {
              setWsModalOrgId(activeWorkspace?.organizationId ?? organizations[0]?.id);
              setWsModalOpen(true);
            }}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            New workspace
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOrgModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationModal
        open={orgModalOpen}
        onClose={() => setOrgModalOpen(false)}
        onSuccess={handleOrgCreated}
      />
      <CreateWorkspaceModal
        open={wsModalOpen}
        onClose={() => {
          setWsModalOpen(false);
          setWsModalOrgId(undefined);
        }}
        organizationId={wsModalOrgId}
      />
    </>
  );
}
