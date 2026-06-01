'use client';

import React from 'react';
import type { ChatThread } from '@/types/domain/workspace';

export default function ThreadList({
  isLight,
  threads,
  activeThreadId,
  onSelectThread,
  panelId,
  title,
}: {
  isLight: boolean;
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  panelId: string;
  title: string;
}) {
  const threadRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(threads.findIndex((thread) => thread.id === activeThreadId), 0);

  const moveFocus = (nextIndex: number) => {
    const nextThread = threads[nextIndex];
    if (!nextThread) {
      return;
    }

    onSelectThread(nextThread.id);
    threadRefs.current[nextIndex]?.focus();
  };

  const handleThreadKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!threads.length) {
      return;
    }

    let nextIndex: number | null = null;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (index + 1) % threads.length;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + threads.length) % threads.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = threads.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    moveFocus(nextIndex);
  };

  return (
    <aside
      className="min-w-0 overflow-hidden rounded-3xl border p-4 lg:flex lg:min-h-0 lg:flex-col"
      style={{
        background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
        borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <h3 className="mb-4 shrink-0 text-sm font-black uppercase tracking-[0.14em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
        {title}
      </h3>
      <div
        aria-label={title}
        className="min-w-0 space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1"
        role="tablist"
        aria-orientation="vertical"
      >
        {threads.map((thread, index) => {
          const active = thread.id === activeThreadId;
          return (
            <button
              key={thread.id}
              ref={(element) => {
                threadRefs.current[index] = element;
              }}
              aria-controls={panelId}
              aria-selected={active}
              className="w-full rounded-2xl border px-4 py-3 text-left transition-colors"
              onClick={() => onSelectThread(thread.id)}
              onKeyDown={(event) => handleThreadKeyDown(event, index)}
              id={`chat-thread-tab-${thread.id}`}
              role="tab"
              style={{
                background: active ? 'rgba(0,229,186,0.15)' : (isLight ? 'rgba(248,250,252,0.8)' : 'rgba(255,255,255,0.03)'),
                borderColor: active ? 'rgba(0,229,186,0.3)' : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)'),
              }}
              tabIndex={index === activeIndex ? 0 : -1}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[15px] font-black tracking-[-0.01em]" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
                  {thread.title}
                </p>
                {thread.unreadCount > 0 ? (
                  <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-xs font-black text-[#041110]">
                    {thread.unreadCount}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-[13px]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                {thread.lastMessagePreview}
              </p>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
