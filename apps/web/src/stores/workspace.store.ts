import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
}

interface WorkspaceStore {
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (workspace: Workspace | null) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      activeWorkspace: null,
      setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
    }),
    {
      name: 'agentforge-workspace',
    },
  ),
);
