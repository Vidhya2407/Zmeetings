'use client';

import React from 'react';
import { useHydrated } from '@/hooks/useHydrated';
import { useThemeStore } from '@/lib/stores/themeStore';
import WorkspaceSidebar, { MobileWorkspaceNav } from './WorkspaceSidebar';
import WorkspaceTopbar from './WorkspaceTopbar';
import WorkspaceContent from './WorkspaceContent';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';

  return (
    <div
      className="h-[100dvh] overflow-hidden md:h-auto md:min-h-screen md:overflow-visible"
      style={{
        background: isLight
          ? 'linear-gradient(180deg, #edf4f7 0%, #f8fbfd 48%, #eef8f4 100%)'
          : 'linear-gradient(180deg, #060c14 0%, #0a1220 48%, #071713 100%)',
      }}
    >
      <div className="flex h-full min-h-0 md:min-h-screen">
        <WorkspaceSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:min-h-screen">
          <WorkspaceTopbar />
          <WorkspaceContent>{children}</WorkspaceContent>
          <MobileWorkspaceNav />
        </div>
      </div>
    </div>
  );
}
