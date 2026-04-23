import React from 'react';

export default function WorkspaceContent({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[calc(100vh-4rem)] px-4 py-4 pb-24 md:px-6 md:py-5 md:pb-5">{children}</div>;
}
