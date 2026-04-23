'use client';

import type { ChatThread } from '@/types/domain/workspace';

export default function ThreadList({
  isLight,
  threads,
  activeThreadId,
  onSelectThread,
  title,
}: {
  isLight: boolean;
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  title: string;
}) {
  return (
    <aside
      className="rounded-3xl border p-3"
      style={{
        background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
        borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <h3 className="mb-3 text-sm font-black uppercase tracking-[0.14em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
        {title}
      </h3>
      <div className="space-y-1.5">
        {threads.map((thread) => {
          const active = thread.id === activeThreadId;
          return (
            <button
              key={thread.id}
              className="w-full rounded-2xl border px-3 py-2 text-left transition-colors"
              onClick={() => onSelectThread(thread.id)}
              style={{
                background: active ? 'rgba(0,229,186,0.15)' : (isLight ? 'rgba(248,250,252,0.8)' : 'rgba(255,255,255,0.03)'),
                borderColor: active ? 'rgba(0,229,186,0.3)' : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)'),
              }}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-base font-bold" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
                  {thread.title}
                </p>
                {thread.unreadCount > 0 ? (
                  <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-sm font-black text-[#041110]">
                    {thread.unreadCount}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-sm" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                {thread.lastMessagePreview}
              </p>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
