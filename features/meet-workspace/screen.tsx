'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { Meeting } from '@/types/domain/workspace';
import { fetchJsonWithRetry } from '@/lib/api/fetchJsonWithRetry';
import { useHydrated } from '@/hooks/useHydrated';
import { useNotificationStore } from '@/lib/stores/notificationStore';
import { useThemeStore } from '@/lib/stores/themeStore';
import { useAppTranslations } from '@/lib/utils/translations';
import NetworkQualityBadge from '@/components/meetings/NetworkQualityBadge';
import WeeklyImpactCard from '@/features/carbon/components/WeeklyImpactCard';
import SummaryCard from '@/features/meeting-summary/components/SummaryCard';
import ActionItemsList from '@/features/meeting-summary/components/ActionItemsList';
import QuickStartCard from './components/QuickStartCard';
import JoinByCodeCard from './components/JoinByCodeCard';
import UpcomingMeetingsList from './components/UpcomingMeetingsList';

type WeeklyCarbon = {
  totalSavedKg: number;
  meetingsCount: number;
  avgSavedPerMeetingKg: number;
};

type MeetingSummary = {
  meetingId: string;
  summary: string;
  actionItems: string[];
};

function canModerateMeeting(sessionUser: { id?: string; role?: string } | undefined, meeting: Meeting | null) {
  if (!sessionUser?.id || !meeting) return false;
  if (sessionUser.role === 'admin' || sessionUser.role === 'creator') return true;
  if (meeting.hostUserId === sessionUser.id) return true;
  return meeting.participants.some((participant) => (
    participant.userId === sessionUser.id && (participant.role === 'host' || participant.role === 'cohost')
  ));
}

function canEnterMeetingNow(meeting: Meeting | null, nowMs: number) {
  if (!meeting || meeting.status === 'ended') return false;
  if (meeting.status === 'live') return true;

  const startsAtMs = new Date(meeting.startsAt).getTime();
  const endsAtMs = new Date(meeting.endsAt).getTime();
  if (!Number.isFinite(startsAtMs)) return false;
  if (Number.isFinite(endsAtMs) && nowMs > endsAtMs) return false;

  return startsAtMs - nowMs <= 10 * 60 * 1000;
}

export default function MeetWorkspaceScreen() {
  return (
    <React.Suspense fallback={<MeetWorkspaceFallback />}>
      <MeetWorkspaceScreenContent />
    </React.Suspense>
  );
}

function MeetWorkspaceScreenContent() {
  const { t, language } = useAppTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';
  const selectedFromQuery = searchParams.get('meetingId');

  const [meetings, setMeetings] = React.useState<Meeting[]>([]);
  const [weekly, setWeekly] = React.useState<WeeklyCarbon | null>(null);
  const [selectedMeetingId, setSelectedMeetingId] = React.useState<string | null>(selectedFromQuery);
  const [selectedMeeting, setSelectedMeeting] = React.useState<Meeting | null>(null);
  const [selectedSummary, setSelectedSummary] = React.useState<MeetingSummary | null>(null);
  const [joinCode, setJoinCode] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [detailsError, setDetailsError] = React.useState<string | null>(null);
  const [reconnecting, setReconnecting] = React.useState(false);
  const [creatingMeeting, setCreatingMeeting] = React.useState(false);
  const [nowMs, setNowMs] = React.useState(0);
  const pushNotification = useNotificationStore((state) => state.push);
  const joinMeetingHref = selectedMeeting
    ? `/meetings/attendee?meetingId=${encodeURIComponent(selectedMeeting.id)}`
    : null;
  const canModerateSelectedMeeting = canModerateMeeting(session?.user, selectedMeeting);
  const selectedSummaryMatchesMeeting = Boolean(
    selectedMeeting?.id && selectedSummary?.meetingId === selectedMeeting.id,
  );
  const selectedMeetingReadyToStart = React.useMemo(() => canEnterMeetingNow(selectedMeeting, nowMs), [nowMs, selectedMeeting]);
  const selectedMeetingStartsAtMs = selectedMeeting ? new Date(selectedMeeting.startsAt).getTime() : Number.NaN;
  const selectedMeetingMinutesUntilStart = Number.isFinite(selectedMeetingStartsAtMs)
    ? Math.max(0, Math.ceil((selectedMeetingStartsAtMs - nowMs) / 60000))
    : null;
  const selectedMeetingActionLabel = canModerateSelectedMeeting
    ? t('workspace.meet.selected.startMeeting', 'Start meeting')
    : t('workspace.meet.selected.joinMeeting', 'Join meeting');
  const selectedMeetingGateMessage = selectedMeeting?.status === 'ended'
    ? t('workspace.meet.selected.ended', 'This meeting has ended.')
    : selectedMeetingReadyToStart
      ? t('workspace.meet.selected.openNow', 'The room is open now.')
      : selectedMeetingMinutesUntilStart !== null
        ? t('workspace.meet.selected.opensBeforeStart', 'Opens 10 minutes before start. {count} min remaining.').replace('{count}', `${selectedMeetingMinutesUntilStart}`)
        : t('workspace.meet.selected.opensBeforeStartUnknown', 'Opens 10 minutes before start.');

  React.useEffect(() => {
    setNowMs(Date.now());
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  React.useEffect(() => {
    setSelectedMeetingId(selectedFromQuery);
  }, [selectedFromQuery]);

  const loadMeetData = React.useCallback(async (preferredMeetingId?: string | null) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [meetingsRes, weeklyRes] = await Promise.all([
        fetchJsonWithRetry<{ meetings: Meeting[] }>('/api/meetings', { cache: 'no-store' }),
        fetchJsonWithRetry<{ weekly: WeeklyCarbon }>(`/api/carbon/weekly?lang=${encodeURIComponent(language)}`, { cache: 'no-store' }),
      ]);

      if (meetingsRes.unauthorized || weeklyRes.unauthorized) {
        router.push(`/login?next=${encodeURIComponent('/meet')}`);
        return;
      }

      if (!meetingsRes.ok || !weeklyRes.ok) {
        setReconnecting(true);
        setLoadError(meetingsRes.error ?? weeklyRes.error ?? 'Unable to sync meetings data.');
        return;
      }

      const nextMeetings = meetingsRes.data?.meetings ?? [];
      const nextSelectedMeetingId = preferredMeetingId ?? selectedMeetingId;
      setMeetings(nextMeetings);
      setWeekly(weeklyRes.data?.weekly ?? null);
      if (preferredMeetingId) {
        setSelectedMeetingId(preferredMeetingId);
      } else if (!nextSelectedMeetingId && nextMeetings.length > 0) {
        setSelectedMeetingId(nextMeetings[0].id);
      }
      setReconnecting(false);
    } finally {
      setLoading(false);
    }
  }, [language, router, selectedMeetingId]);

  React.useEffect(() => {
    void loadMeetData();
  }, [loadMeetData]);

  const loadSelectedMeeting = React.useCallback(async (meetingId: string) => {
    setDetailsLoading(true);
    setDetailsError(null);
    setSelectedSummary(null);
    try {
      const [meetingRes, summaryRes] = await Promise.all([
        fetchJsonWithRetry<{ meeting: Meeting }>(`/api/meetings/${meetingId}`, { cache: 'no-store' }),
        fetchJsonWithRetry<{ summary: MeetingSummary }>(`/api/meetings/${meetingId}/summary?lang=${encodeURIComponent(language)}`, { cache: 'no-store' }),
      ]);

      if (meetingRes.unauthorized || summaryRes.unauthorized) {
        router.push(`/login?next=${encodeURIComponent('/meet')}`);
        return;
      }

      if (!meetingRes.ok || !summaryRes.ok) {
        setReconnecting(true);
        setDetailsError(meetingRes.error ?? summaryRes.error ?? 'Unable to load selected meeting details.');
        return;
      }

      setSelectedMeeting(meetingRes.data?.meeting ?? null);
      setSelectedSummary(summaryRes.data?.summary ?? null);
      setReconnecting(false);
    } finally {
      setDetailsLoading(false);
    }
  }, [language, router]);

  React.useEffect(() => {
    if (!selectedMeetingId) {
      setSelectedMeeting(null);
      setSelectedSummary(null);
      return;
    }
    void loadSelectedMeeting(selectedMeetingId);
  }, [loadSelectedMeeting, selectedMeetingId]);

  const handleCreateMeeting = React.useCallback(async () => {
    if (creatingMeeting) return;

    setCreatingMeeting(true);
    setLoadError(null);
    setReconnecting(false);

    try {
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
      const response = await fetchJsonWithRetry<{ meeting: Meeting }>('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: t('workspace.meet.quickStart.defaultTitle', 'New Team Meeting'),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        }),
      });
      if (response.unauthorized) {
        router.push(`/login?next=${encodeURIComponent('/meet')}`);
        return;
      }
      if (!response.ok) {
        setLoadError(response.error ?? t('workspace.meet.quickStart.createFailed', 'Unable to create meeting. Please retry.'));
        setReconnecting(true);
        return;
      }

      const meeting = response.data?.meeting;
      if (!meeting?.id) {
        setLoadError(t('workspace.meet.quickStart.missingMeetingId', 'Meeting was created, but the response did not include a meeting id.'));
        setReconnecting(true);
        return;
      }

      const startResponse = await fetchJsonWithRetry<{ meeting: Meeting }>(`/api/meetings/${encodeURIComponent(meeting.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'live' }),
      });

      if (startResponse.unauthorized) {
        router.push(`/login?next=${encodeURIComponent('/meet')}`);
        return;
      }

      if (!startResponse.ok) {
        setSelectedMeetingId(meeting.id);
        setSelectedMeeting(meeting);
        setLoadError(startResponse.error ?? t('workspace.meet.quickStart.startFailed', 'Meeting was created, but it could not be started. Please try Start meeting.'));
        setReconnecting(true);
        return;
      }

      const liveMeeting = startResponse.data?.meeting ?? meeting;
      setSelectedMeetingId(liveMeeting.id);
      setSelectedMeeting(liveMeeting);
      setMeetings((currentMeetings) => {
        const withoutCreated = currentMeetings.filter((currentMeeting) => currentMeeting.id !== liveMeeting.id);
        return [...withoutCreated, liveMeeting].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      });

      pushNotification({
        type: 'meeting',
        source: 'meeting',
        priority: 'direct',
        title: liveMeeting.title,
        body: 'Meeting started and ready for attendees.',
        href: `/meetings/live?meetingId=${encodeURIComponent(liveMeeting.id)}`,
        linkedEntityId: liveMeeting.id,
      });
      router.push(`/meetings/live?meetingId=${encodeURIComponent(liveMeeting.id)}`);
    } catch {
      setLoadError(t('workspace.meet.quickStart.createFailed', 'Unable to create meeting. Please retry.'));
      setReconnecting(true);
    } finally {
      setCreatingMeeting(false);
    }
  }, [creatingMeeting, pushNotification, router, t]);

  const handleStartSelectedMeeting = React.useCallback(async () => {
    if (!selectedMeeting) return;

    if (selectedMeeting.status !== 'live') {
      const response = await fetchJsonWithRetry<{ meeting: Meeting }>(`/api/meetings/${encodeURIComponent(selectedMeeting.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'live' }),
      });

      if (response.unauthorized) {
        router.push(`/login?next=${encodeURIComponent(`/meet?meetingId=${selectedMeeting.id}`)}`);
        return;
      }

      if (!response.ok) {
        pushNotification({
          type: 'system',
          source: 'system',
          priority: 'direct',
          title: 'Unable to start meeting',
          body: response.error ?? 'Please try again.',
          href: `/meet?meetingId=${encodeURIComponent(selectedMeeting.id)}`,
        });
        return;
      }

      const updatedMeeting = response.data?.meeting;
      if (updatedMeeting) {
        setSelectedMeeting(updatedMeeting);
        setMeetings((currentMeetings) => currentMeetings.map((meeting) => (
          meeting.id === updatedMeeting.id ? updatedMeeting : meeting
        )));
      }
    }

    router.push(`/meetings/live?meetingId=${encodeURIComponent(selectedMeeting.id)}`);
  }, [pushNotification, router, selectedMeeting]);

  const handleJoin = React.useCallback(async () => {
    const normalizedCode = joinCode.trim().toUpperCase();
    if (!normalizedCode) return;

    try {
      const response = await fetchJsonWithRetry<{ meeting: Meeting }>(`/api/meetings/lookup?code=${encodeURIComponent(normalizedCode)}`, {
        cache: 'no-store',
      });

      if (response.unauthorized) {
        router.push(`/login?next=${encodeURIComponent('/meet')}`);
        return;
      }

      if (!response.ok) {
        pushNotification({
          type: 'system',
          source: 'system',
          priority: 'direct',
          title: t('workspace.meet.errors.codeNotFoundTitle', 'Meeting code not found'),
          body: t('workspace.meet.errors.noMeetingForCode', 'No meeting found for code {code}.').replace('{code}', normalizedCode),
          href: '/meet',
        });
        return;
      }

      const meetingId = response.data?.meeting?.id;
      if (!meetingId) {
        pushNotification({
          type: 'system',
          source: 'system',
          priority: 'direct',
          title: t('workspace.meet.errors.joinTitle', 'Unable to join meeting'),
          body: t('workspace.meet.errors.invalidLookupPayload', 'Meeting lookup returned an invalid payload.'),
          href: '/meet',
        });
        return;
      }

      router.push(`/meetings/attendee?meetingId=${encodeURIComponent(meetingId)}`);
    } catch {
      pushNotification({
        type: 'system',
        source: 'system',
        priority: 'direct',
        title: t('workspace.meet.errors.joinTitle', 'Unable to join meeting'),
        body: t('workspace.meet.errors.lookupFailed', 'Meeting lookup failed. Please try again.'),
        href: '/meet',
      });
      setReconnecting(true);
    }
  }, [joinCode, pushNotification, router, t]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <NetworkQualityBadge isLight={isLight} />
      </div>

      {(loadError || reconnecting) ? (
        <section
          className="rounded-3xl border px-4 py-3"
          style={{
            background: isLight ? 'rgba(254,242,242,0.82)' : 'rgba(127,29,29,0.22)',
            borderColor: isLight ? 'rgba(220,38,38,0.2)' : 'rgba(248,113,113,0.35)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-base font-semibold" style={{ color: isLight ? '#7f1d1d' : '#fecaca' }}>
              {loadError ?? t('workspace.meet.reconnecting', 'Connection is unstable. Reconnecting...')}
            </p>
            <button
              type="button"
              onClick={() => void loadMeetData()}
              className="rounded-xl px-3 py-2 text-base font-bold"
              style={{
                background: isLight ? 'rgba(220,38,38,0.12)' : 'rgba(248,113,113,0.22)',
                border: `1px solid ${isLight ? 'rgba(220,38,38,0.28)' : 'rgba(248,113,113,0.35)'}`,
                color: isLight ? '#991b1b' : '#fee2e2',
              }}
            >
              {t('workspace.meet.retryNow', 'Retry now')}
            </button>
          </div>
        </section>
      ) : null}

      <section
        className="rounded-3xl border p-5 md:p-6"
        style={{
          background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
          borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
        }}
      >
        <p className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: 'rgb(0,229,186)' }}>
          {t('workspace.meet.eyebrow', 'Meet Workspace')}
        </p>
        <h2 className="mt-2 text-3xl font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
          {t('workspace.meet.title', 'Welcome to ZMeetings')}
        </h2>
        <p className="mt-2 text-base leading-7" style={{ color: isLight ? '#475569' : '#9ca3af' }}>
          {t('workspace.meet.subtitle', 'Start meetings quickly, join by code, and track your team impact from one place.')}
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <QuickStartCard
            ctaLabel={creatingMeeting ? t('workspace.meet.quickStart.creating', 'Creating...') : t('workspace.meet.quickStart.cta', 'New meeting')}
            description={t('workspace.meet.quickStart.description', 'Jump in instantly, invite participants, and track live sustainability impact.')}
            disabled={creatingMeeting}
            isLight={isLight}
            onStartMeeting={handleCreateMeeting}
            title={t('workspace.meet.quickStart.title', 'Start a new meeting')}
          />
          <JoinByCodeCard
            ctaLabel={t('workspace.meet.joinByCode.cta', 'Join')}
            description={t('workspace.meet.joinByCode.description', 'Paste your meeting code to open attendee controls quickly.')}
            isLight={isLight}
            joinCode={joinCode}
            onJoin={handleJoin}
            onJoinCodeChange={setJoinCode}
            placeholder={t('workspace.meet.joinByCode.placeholder', 'ECO-XXXX-XXXX')}
            title={t('workspace.meet.joinByCode.title', 'Join by code')}
          />
          <UpcomingMeetingsList
            activeMeetingId={selectedMeetingId}
            isLight={isLight}
            locale={language}
            meetings={meetings}
            onSelectMeeting={setSelectedMeetingId}
            attendingLabel={t('workspace.meet.upcoming.attending', 'attending')}
            openCalendarLabel={t('workspace.meet.upcoming.openCalendar', 'Open calendar')}
            title={t('workspace.meet.upcoming.title', 'Upcoming meetings')}
          />
        </div>

        <section className="space-y-4">
          {loading ? (
            <section
              className="rounded-3xl border p-5"
              style={{
                background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.04)',
                borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
              }}
            >
              <p className="text-sm" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                {t('workspace.meet.weekly.loading', 'Loading impact data...')}
              </p>
            </section>
          ) : (
            <>
              <WeeklyImpactCard
                avgSavedPerMeetingKg={weekly?.avgSavedPerMeetingKg ?? 0}
                isLight={isLight}
                meetingsCount={weekly?.meetingsCount ?? 0}
                totalSavedKg={weekly?.totalSavedKg ?? 0}
              />
            </>
          )}

          <section
            className="rounded-2xl border p-4"
            style={{
              background: isLight ? 'rgba(248,250,252,0.9)' : 'rgba(255,255,255,0.03)',
              borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
            }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
              {t('workspace.meet.selected.title', 'Selected meeting')}
            </p>

            {detailsLoading ? (
              <p className="mt-2 text-sm" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{t('workspace.meet.selected.loading', 'Loading details...')}</p>
            ) : detailsError ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-semibold" style={{ color: isLight ? '#991b1b' : '#fecaca' }}>{detailsError}</p>
                <button
                  type="button"
                  onClick={() => selectedMeetingId ? void loadSelectedMeeting(selectedMeetingId) : undefined}
                  className="rounded-lg px-3 py-2 text-xs font-bold"
                  style={{
                    background: isLight ? 'rgba(220,38,38,0.12)' : 'rgba(248,113,113,0.22)',
                    border: `1px solid ${isLight ? 'rgba(220,38,38,0.28)' : 'rgba(248,113,113,0.35)'}`,
                    color: isLight ? '#991b1b' : '#fee2e2',
                  }}
                >
                  Retry details
                </button>
              </div>
            ) : selectedMeeting ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
                  {selectedMeeting.title}
                </p>
                <p className="text-xs" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                  {new Date(selectedMeeting.startsAt).toLocaleString(language)} | {t(`workspace.meet.status.${selectedMeeting.status}`, selectedMeeting.status)}
                </p>
                {selectedSummary && selectedSummaryMatchesMeeting ? (
                  <>
                    <SummaryCard isLight={isLight} summary={selectedSummary.summary} />
                    <ActionItemsList isLight={isLight} items={selectedSummary.actionItems} />
                  </>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{t('workspace.meet.selected.empty', 'Pick a meeting to inspect room impact.')}</p>
            )}

            {selectedMeeting?.status !== 'ended' && (canModerateSelectedMeeting || joinMeetingHref) ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {canModerateSelectedMeeting ? (
                  <button
                    type="button"
                    disabled={!selectedMeetingReadyToStart}
                    onClick={() => {
                      if (selectedMeetingReadyToStart) void handleStartSelectedMeeting();
                    }}
                    className="rounded-xl px-3 py-2 text-base font-bold"
                    style={{
                      background: selectedMeetingReadyToStart
                        ? 'rgba(0,229,186,0.18)'
                        : (isLight ? 'rgba(148,163,184,0.16)' : 'rgba(255,255,255,0.06)'),
                      border: selectedMeetingReadyToStart
                        ? '1px solid rgba(0,229,186,0.35)'
                        : `1px solid ${isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.1)'}`,
                      color: selectedMeetingReadyToStart
                        ? (isLight ? '#047857' : '#5eead4')
                        : (isLight ? '#64748b' : '#94a3b8'),
                      cursor: selectedMeetingReadyToStart ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {selectedMeetingActionLabel}
                  </button>
                ) : selectedMeetingReadyToStart && joinMeetingHref ? (
                  <Link
                    href={joinMeetingHref}
                    className="rounded-xl px-3 py-2 text-base font-bold"
                    style={{
                      background: 'rgba(0,229,186,0.18)',
                      border: '1px solid rgba(0,229,186,0.35)',
                      color: isLight ? '#047857' : '#5eead4',
                    }}
                  >
                    {selectedMeetingActionLabel}
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="rounded-xl px-3 py-2 text-base font-bold"
                    style={{
                      background: isLight ? 'rgba(148,163,184,0.16)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.1)'}`,
                      color: isLight ? '#64748b' : '#94a3b8',
                      cursor: 'not-allowed',
                    }}
                  >
                    {selectedMeetingActionLabel}
                  </button>
                )}
                <p className="basis-full text-xs font-semibold" style={{ color: selectedMeetingReadyToStart ? (isLight ? '#047857' : '#5eead4') : (isLight ? '#64748b' : '#94a3b8') }}>
                  {selectedMeetingGateMessage}
                </p>
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </div>
  );
}

function MeetWorkspaceFallback() {
  const { t } = useAppTranslations();
  const { theme } = useThemeStore();
  const isLight = theme === 'light';
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-base font-semibold" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{t('workspace.meet.loading', 'Loading meet workspace...')}</p>
    </div>
  );
}
