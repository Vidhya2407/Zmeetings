'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useHydrated } from '@/hooks/useHydrated';
import { useNotificationStore } from '@/lib/stores/notificationStore';
import { useThemeStore } from '@/lib/stores/themeStore';
import { usePeopleStore } from '@/lib/stores/peopleStore';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';
import { useAppTranslations } from '@/lib/utils/translations';
import type { WorkspaceUser } from '@/types/domain/workspace';
import DirectoryGrid from './components/DirectoryGrid';

export default function PeopleWorkspaceScreen() {
  const { t } = useAppTranslations();
  const router = useRouter();
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';
  const globalSearch = useWorkspaceStore((state) => state.globalSearch);
  const {
    people,
    searchQuery,
    loading,
    setPeople,
    setSearchQuery,
    setLoading,
  } = usePeopleStore();
  const pushNotification = useNotificationStore((state) => state.push);

  const [inviteState, setInviteState] = React.useState<{ userId: string | null; message: string }>({
    userId: null,
    message: '',
  });
  const [messageState, setMessageState] = React.useState<{ userId: string | null; message: string }>({
    userId: null,
    message: '',
  });

  const effectiveQuery = (searchQuery || globalSearch).trim();

  const loadPeople = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/people${effectiveQuery ? `?q=${encodeURIComponent(effectiveQuery)}` : ''}`, { cache: 'no-store' });
      const body = await response.json();
      setPeople(body?.data?.people ?? []);
    } finally {
      setLoading(false);
    }
  }, [effectiveQuery, setLoading, setPeople]);

  React.useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  const onInvite = React.useCallback(async (user: WorkspaceUser) => {
    setInviteState({ userId: user.id, message: '' });
    try {
      const meetingRes = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: t('workspace.people.quickSyncTitle', 'Quick Sync - {name}').replace('{name}', user.name),
          hostUserId: 'u5',
        }),
      });
      const meetingBody = await meetingRes.json();
      const meetingId = meetingBody?.data?.meeting?.id as string | undefined;

      if (meetingId) {
        await fetch(`/api/meetings/${meetingId}/participants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, role: 'attendee' }),
        });

        pushNotification({
          type: 'meeting',
          source: 'meeting',
          priority: 'direct',
          title: t('workspace.people.notifications.inviteSent', 'Invite sent: {name}').replace('{name}', user.name),
          body: t('workspace.people.notifications.addedToMeeting', 'Added to {meeting}.').replace('{meeting}', meetingBody?.data?.meeting?.title ?? t('workspace.people.notifications.newMeeting', 'new meeting')),
          href: `/meet?meetingId=${encodeURIComponent(meetingId)}`,
          linkedEntityId: meetingId,
        });
      }

      setInviteState({
        userId: null,
        message: `${user.name} ${t('workspace.people.invitedSuffix', 'has been invited to a new meeting.')}`,
      });
    } catch {
      setInviteState({ userId: null, message: t('error.generic', 'Something went wrong. Please try again.') });
    }
  }, [pushNotification, t]);

  const onMessage = React.useCallback(async (user: WorkspaceUser) => {
    setMessageState({ userId: user.id, message: '' });
    try {
      const response = await fetch('/api/chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent('/people')}`);
        return;
      }

      const body = await response.json();
      const threadId = body?.data?.thread?.id as string | undefined;
      if (!response.ok || !threadId) {
        setMessageState({ userId: null, message: body?.error ?? t('error.generic', 'Something went wrong. Please try again.') });
        return;
      }

      const href = `/chat?threadId=${encodeURIComponent(threadId)}`;
      pushNotification({
        type: 'chat',
        source: 'chat',
        priority: 'direct',
        title: t('workspace.people.notifications.openingChat', 'Opening chat: {name}').replace('{name}', user.name),
        body: t('workspace.people.notifications.readyToMessage', 'Ready to message {name}.').replace('{name}', user.name),
        href,
        linkedEntityId: threadId,
      });
      router.push(href);
    } catch {
      setMessageState({ userId: null, message: t('error.generic', 'Something went wrong. Please try again.') });
    }
  }, [pushNotification, router, t]);

  return (
    <div className="space-y-6">
      <section
        className="rounded-3xl border p-6"
        style={{
          background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
          borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: 'rgb(0,229,186)' }}>
              {t('workspace.people.eyebrow', 'People')}
            </p>
            <h2 className="mt-2 text-3xl font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
              {t('workspace.people.title', 'Meet the Community')}
            </h2>
            <p className="mt-3 text-base leading-7" style={{ color: isLight ? '#475569' : '#9ca3af' }}>
              {t('workspace.people.subtitle', 'Find teammates, check presence, and invite people into meetings fast.')}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
          <input
            className="h-12 rounded-xl border px-4 text-base outline-none"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('workspace.people.searchPlaceholder', 'Search people...')}
            style={{
              background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.05)',
              borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.08)',
              color: isLight ? '#0f172a' : '#ffffff',
            }}
            value={searchQuery}
          />
          <button
            className="h-12 rounded-xl px-4 text-base font-black"
            onClick={() => void loadPeople()}
            style={{ background: 'rgba(0,229,186,0.15)', color: 'rgb(0,229,186)', border: '1px solid rgba(0,229,186,0.3)' }}
            type="button"
          >
            {t('workspace.people.refresh', 'Refresh')}
          </button>
        </div>
      </section>

      {inviteState.message ? (
        <div
          className="rounded-2xl border px-4 py-3 text-base font-semibold"
          style={{
            background: isLight ? 'rgba(240,253,250,0.82)' : 'rgba(0,229,186,0.08)',
            borderColor: 'rgba(0,229,186,0.25)',
            color: isLight ? '#065f46' : '#5eead4',
          }}
        >
          {inviteState.message}
        </div>
      ) : null}

      {messageState.message ? (
        <div
          className="rounded-2xl border px-4 py-3 text-base font-semibold"
          style={{
            background: isLight ? 'rgba(239,246,255,0.82)' : 'rgba(96,165,250,0.08)',
            borderColor: 'rgba(96,165,250,0.25)',
            color: isLight ? '#1d4ed8' : '#93c5fd',
          }}
        >
          {messageState.message}
        </div>
      ) : null}

      {loading ? (
        <div
          className="rounded-3xl border p-6 text-base"
          style={{
            background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
            borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
            color: isLight ? '#64748b' : '#94a3b8',
          }}
        >
          {t('workspace.people.loading', 'Loading people...')}
        </div>
      ) : people.length === 0 ? (
        <div
          className="rounded-3xl border p-6 text-base"
          style={{
            background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
            borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
            color: isLight ? '#64748b' : '#94a3b8',
          }}
        >
          {t('workspace.people.empty', 'No people match your search yet.')}
        </div>
      ) : (
        <DirectoryGrid
          isLight={isLight}
          onInvite={(user) => {
            if (!inviteState.userId) {
              void onInvite(user);
            }
          }}
          onMessage={onMessage}
          people={people}
        />
      )}
    </div>
  );
}
