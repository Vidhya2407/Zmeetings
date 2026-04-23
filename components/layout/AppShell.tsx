'use client';

import React from 'react';
import { useHydrated } from '@/hooks/useHydrated';
import { useThemeStore } from '@/lib/stores/themeStore';
import WorkspaceSidebar from './WorkspaceSidebar';
import WorkspaceTopbar from './WorkspaceTopbar';
import WorkspaceContent from './WorkspaceContent';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';

  return (
    <div
      className="min-h-screen"
      style={{
        background: isLight
          ? 'linear-gradient(180deg, #edf4f7 0%, #f8fbfd 48%, #eef8f4 100%)'
          : 'linear-gradient(180deg, #060c14 0%, #0a1220 48%, #071713 100%)',
      }}
    >
      <div className="flex min-h-screen">
        <WorkspaceSidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <WorkspaceTopbar />
          <WorkspaceContent>{children}</WorkspaceContent>
        </div>
      </div>
    </div>
  );
}
