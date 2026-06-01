'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useHydrated } from '@/hooks/useHydrated';
import { useActivityStore } from '@/lib/stores/activityStore';
import { useNotificationStore } from '@/lib/stores/notificationStore';
import { useThemeStore } from '@/lib/stores/themeStore';
import { useAppTranslations } from '@/lib/utils/translations';
import type { ActivityItem } from '@/types/domain/workspace';
import FeedFilters from './components/FeedFilters';
import ActivityFeed from './components/ActivityFeed';

export default function ActivityWorkspaceScreen() {
  const { t } = useAppTranslations();
  const router = useRouter();
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';
  const { items, filter, loading, setItems, setFilter, setLoading } = useActivityStore();
  const syncActivityNotifications = useNotificationStore((state) => state.syncActivity);

  const loadActivity = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/activity', { cache: 'no-store' });
      const body = await response.json();
      const nextItems = body?.data?.items ?? [];
      setItems(nextItems);
      syncActivityNotifications(nextItems);
    } finally {
      setLoading(false);
    }
  }, [setItems, setLoading, syncActivityNotifications]);

  React.useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const visibleItems = React.useMemo(() => {
    if (filter === 'unread') return items.filter((item) => !item.read);
    if (filter === 'mentions') return items.filter((item) => item.kind === 'mention');
    return items;
  }, [filter, items]);

  const markRead = React.useCallback(async (id: string) => {
    await fetch(`/api/activity/${id}/read`, { method: 'POST' });
    await loadActivity();
  }, [loadActivity]);

  const markAll = React.useCallback(async () => {
    const unread = items.filter((item) => !item.read);
    await Promise.all(unread.map((item) => fetch(`/api/activity/${item.id}/read`, { method: 'POST' })));
    await loadActivity();
  }, [items, loadActivity]);

  const openContext = (item: ActivityItem) => {
    if (item.kind === 'meeting_recording_ready' && item.relatedMeetingId) {
      router.push(`/recordings?meetingId=${encodeURIComponent(item.relatedMeetingId)}`);
      return;
    }
    if (item.relatedMeetingId) {
      router.push(`/meet?meetingId=${encodeURIComponent(item.relatedMeetingId)}`);
      return;
    }
    if (item.relatedThreadId) {
      router.push(`/chat?threadId=${encodeURIComponent(item.relatedThreadId)}`);
      return;
    }
    router.push('/activity');
  };

  return (
    <div className="mx-auto max-w-[1240px] space-y-4 md:space-y-6">
      <section
        className="rounded-3xl border px-6 py-5"
        style={{
          background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
          borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: 'rgb(0,229,186)' }}>
              {t('workspace.activity.eyebrow', 'Activity')}
            </p>
            <h2 className="mt-2 text-3xl font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
              {t('workspace.activity.title', 'Stay on top of what changed')}
            </h2>
            <p className="mt-2 text-base leading-7" style={{ color: isLight ? '#475569' : '#9ca3af' }}>
              {t('workspace.activity.subtitle', 'Mentions, invite reminders, and meeting updates in one feed.')}
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <FeedFilters isLight={isLight} onChange={setFilter} value={filter} />
            <button
              className="self-start rounded-xl border px-4 py-2 text-sm font-bold md:self-auto"
              onClick={() => void markAll()}
              style={{ borderColor: 'rgba(0,229,186,0.35)', color: 'rgb(0,229,186)' }}
              type="button"
            >
              {t('workspace.activity.markAll', 'Mark all read')}
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div
          className="rounded-3xl border p-6 text-base"
          style={{
            background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
            borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
            color: isLight ? '#64748b' : '#94a3b8',
          }}
        >
          {t('workspace.activity.loading', 'Loading activity...')}
        </div>
      ) : visibleItems.length === 0 ? (
        <div
          className="rounded-3xl border p-6 text-base"
          style={{
            background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
            borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
            color: isLight ? '#64748b' : '#94a3b8',
          }}
        >
          {t('workspace.activity.empty', 'No items in this view yet.')}
        </div>
      ) : (
        <ActivityFeed
          isLight={isLight}
          items={visibleItems}
          onMarkRead={(id) => void markRead(id)}
          onOpenContext={openContext}
        />
      )}
    </div>
  );
}
