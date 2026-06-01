import React from 'react';

export default function WorkspaceContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 md:min-h-[calc(100vh-4rem)] md:flex-none md:overflow-visible md:px-6 md:py-6">
      {children}
    </div>
  );
}
