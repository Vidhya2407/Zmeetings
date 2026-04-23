import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WorkspaceSection = 'activity' | 'chat' | 'meet' | 'impact' | 'recordings' | 'people' | 'calendar' | 'settings';

interface WorkspaceState {
  activeSection: WorkspaceSection;
  globalSearch: string;
  setActiveSection: (section: WorkspaceSection) => void;
  setGlobalSearch: (value: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeSection: 'meet',
      globalSearch: '',
      setActiveSection: (activeSection) => set({ activeSection }),
      setGlobalSearch: (globalSearch) => set({ globalSearch }),
    }),
    { name: 'workspace-ui-store' },
  ),
);
