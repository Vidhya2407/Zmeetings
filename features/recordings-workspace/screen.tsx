'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHydrated } from '@/hooks/useHydrated';
import { fetchJsonWithRetry } from '@/lib/api/fetchJsonWithRetry';
import { useThemeStore } from '@/lib/stores/themeStore';
import { useAppTranslations } from '@/lib/utils/translations';
import type { ActivityItem, Meeting, MeetingCarbonSummary } from '@/types/domain/workspace';

type MeetingSummary = {
  actionItems: string[];
  carbon?: MeetingCarbonSummary | null;
  meetingId: string;
  summary: string;
  title: string;
};

const HOST_NAME_BY_ID: Record<string, string> = {
  u1: 'Dr. Sarah Chen',
  u2: 'Marcus Webb',
  u3: 'Amara Diallo',
  u4: 'Prof. Erik Larsen',
  u5: 'Yuki Tanaka',
  u6: 'Leo Martins',
};

const APP_FONT_FAMILY = 'var(--font-sans)';
const LABEL_CLASS = 'text-sm font-black uppercase tracking-[0.12em]';
const ACTION_BUTTON_CLASS = 'rounded-xl border px-4 py-2.5 text-base font-black';

function formatTimeRange(meeting: Meeting, locale: string) {
  const startsAt = new Date(meeting.startsAt);
  const endsAt = new Date(meeting.endsAt);
  return `${startsAt.toLocaleString(locale)} - ${endsAt.toLocaleTimeString(locale)}`;
}

export default function RecordingsWorkspaceScreen() {
  return (
    <React.Suspense fallback={<RecordingsFallback />}>
      <RecordingsWorkspaceContent />
    </React.Suspense>
  );
}

function RecordingsWorkspaceContent() {
  const { language, t } = useAppTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetingId = searchParams.get('meetingId');
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';
  const [meeting, setMeeting] = React.useState<Meeting | null>(null);
  const [summary, setSummary] = React.useState<MeetingSummary | null>(null);
  const [loading, setLoading] = React.useState(Boolean(meetingId));
  const [error, setError] = React.useState<string | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [recordingItems, setRecordingItems] = React.useState<ActivityItem[]>([]);

  React.useEffect(() => {
    if (!meetingId) {
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    const loadRecording = async () => {
      setLoading(true);
      setError(null);
      const [meetingRes, summaryRes] = await Promise.all([
        fetchJsonWithRetry<{ meeting: Meeting }>(`/api/meetings/${encodeURIComponent(meetingId)}`, { cache: 'no-store' }),
        fetchJsonWithRetry<{ summary: MeetingSummary }>(`/api/meetings/${encodeURIComponent(meetingId)}/summary?lang=${language}`, { cache: 'no-store' }),
      ]);
      if (!active) return;

      if (meetingRes.unauthorized || summaryRes.unauthorized) {
        router.push(`/login?next=${encodeURIComponent(`/recordings?meetingId=${meetingId}`)}`);
        return;
      }
      if (!meetingRes.ok) {
        setError(meetingRes.error ?? 'Unable to load this recording.');
        setLoading(false);
        return;
      }

      setMeeting(meetingRes.data?.meeting ?? null);
      setSummary(summaryRes.ok ? (summaryRes.data?.summary ?? null) : null);
      setError(summaryRes.ok ? null : (summaryRes.error ?? null));
      setLoading(false);
    };

    void loadRecording();
    return () => {
      active = false;
    };
  }, [language, meetingId, router]);

  React.useEffect(() => {
    if (meetingId) return;

    let active = true;
    const loadRecordingList = async () => {
      setLoading(true);
      setError(null);
      const activityRes = await fetchJsonWithRetry<{ items: ActivityItem[] }>('/api/activity', { cache: 'no-store' });
      if (!active) return;

      if (!activityRes.ok) {
        setError(activityRes.error ?? 'Unable to load recordings.');
        setRecordingItems([]);
        setLoading(false);
        return;
      }

      const seen = new Set<string>();
      const nextItems = (activityRes.data?.items ?? []).filter((item) => {
        if (item.kind !== 'meeting_recording_ready' || !item.relatedMeetingId) return false;
        if (seen.has(item.relatedMeetingId)) return false;
        seen.add(item.relatedMeetingId);
        return true;
      });

      setRecordingItems(nextItems);
      setLoading(false);
    };

    void loadRecordingList();

    return () => {
      active = false;
    };
  }, [meetingId]);

  const textPrimary = isLight ? '#0f172a' : '#ffffff';
  const textSecondary = isLight ? '#475569' : '#cbd5e1';
  const muted = isLight ? '#64748b' : '#94a3b8';
  const panelBg = isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)';
  const panelBorder = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
  const softBg = isLight ? 'rgba(248,250,252,0.92)' : 'rgba(255,255,255,0.05)';
  const videoBg = isLight ? '#e8f0f4' : '#030712';
  const videoOverlay = isLight
    ? 'radial-gradient(circle at 50% 35%, rgba(0,229,186,0.18), transparent 34%), linear-gradient(135deg, rgba(226,232,240,0.96), rgba(241,245,249,0.92))'
    : 'radial-gradient(circle at 50% 35%, rgba(0,229,186,0.28), transparent 34%), linear-gradient(135deg, rgba(15,23,42,0.96), rgba(17,24,39,0.86))';

  if (loading) {
    return <RecordingsFallback />;
  }

  if (!meetingId) {
    return (
      <div className="space-y-5" style={{ fontFamily: APP_FONT_FAMILY }}>
        <section
          className="rounded-3xl border p-5 md:p-6"
          style={{ background: panelBg, borderColor: panelBorder }}
        >
          <p className={LABEL_CLASS} style={{ color: 'rgb(0,229,186)' }}>
            {t('workspace.recordings.eyebrow', 'Recording')}
          </p>
          <h2 className="mt-2 text-3xl font-black" style={{ color: textPrimary }}>
            {t('workspace.recordings.libraryTitle', 'Recordings')}
          </h2>
          <p className="mt-2 text-base leading-7" style={{ color: textSecondary }}>
            {t('workspace.recordings.librarySubtitle', 'Open a saved meeting recording from recent activity.')}
          </p>
        </section>

        {error ? (
          <section className="rounded-3xl border p-5" style={{ background: panelBg, borderColor: panelBorder }}>
            <p className="text-base font-bold" style={{ color: textPrimary }}>{error}</p>
          </section>
        ) : recordingItems.length ? (
          <section className="grid gap-3 md:grid-cols-2">
            {recordingItems.map((item) => (
              <article
                key={item.id}
                className="rounded-3xl border p-5"
                style={{ background: panelBg, borderColor: panelBorder }}
              >
                <p className={LABEL_CLASS} style={{ color: muted }}>
                  {t('workspace.recordings.ready', 'Ready to view')}
                </p>
                <h3 className="mt-3 text-lg font-black" style={{ color: textPrimary }}>
                  {item.title}
                </h3>
                <p className="mt-2 text-base leading-7" style={{ color: textSecondary }}>
                  {item.body}
                </p>
                <p className="mt-3 text-base" style={{ color: muted }}>
                  {new Date(item.createdAt).toLocaleString()}
                </p>
                <button
                  className={`mt-4 ${ACTION_BUTTON_CLASS}`}
                  onClick={() => router.push(`/recordings?meetingId=${encodeURIComponent(item.relatedMeetingId as string)}`)}
                  style={{ borderColor: 'rgba(0,229,186,0.35)', color: 'rgb(0,229,186)' }}
                  type="button"
                >
                  {t('workspace.recordings.viewRecording', 'View recording')}
                </button>
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded-3xl border p-5" style={{ background: panelBg, borderColor: panelBorder }}>
            <p className="text-base font-bold" style={{ color: textPrimary }}>
              {t('workspace.recordings.empty', 'No saved recordings yet.')}
            </p>
            <p className="mt-2 text-base leading-7" style={{ color: textSecondary }}>
              {t('workspace.recordings.emptyHint', 'When a meeting recording is ready, it appears here and in Activity.')}
            </p>
            <button
              className={`mt-4 ${ACTION_BUTTON_CLASS}`}
              onClick={() => router.push('/activity')}
              style={{ borderColor: 'rgba(0,229,186,0.35)', color: 'rgb(0,229,186)' }}
              type="button"
            >
              {t('workspace.recordings.openActivity', 'Open activity')}
            </button>
          </section>
        )}
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="rounded-3xl border p-6" style={{ background: panelBg, borderColor: panelBorder, fontFamily: APP_FONT_FAMILY }}>
        <p className="text-base font-bold" style={{ color: textPrimary }}>{error ?? t('workspace.recordings.notFound', 'Recording not found.')}</p>
        <button
          className={`mt-4 ${ACTION_BUTTON_CLASS}`}
          onClick={() => router.push('/recordings')}
          style={{ borderColor: 'rgba(0,229,186,0.35)', color: 'rgb(0,229,186)' }}
          type="button"
        >
          {t('workspace.recordings.allRecordings', 'All recordings')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5" style={{ fontFamily: APP_FONT_FAMILY }}>
      <section
        className="rounded-3xl border p-5 md:p-6"
        style={{ background: panelBg, borderColor: panelBorder }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={LABEL_CLASS} style={{ color: 'rgb(0,229,186)' }}>
              {t('workspace.recordings.eyebrow', 'Recording')}
            </p>
            <h2 className="mt-2 text-3xl font-black" style={{ color: textPrimary }}>
              {meeting.title}
            </h2>
            <p className="mt-2 text-base leading-7" style={{ color: textSecondary }}>
              {formatTimeRange(meeting, language)}
            </p>
          </div>
          <button
            className={ACTION_BUTTON_CLASS}
            onClick={() => router.push('/recordings')}
            style={{ borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.14)', color: muted }}
            type="button"
          >
            {t('workspace.recordings.allRecordings', 'All recordings')}
          </button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <section
          className="overflow-hidden rounded-3xl border"
          style={{ background: videoBg, borderColor: panelBorder }}
        >
          <div className="relative flex aspect-video min-h-[320px] items-center justify-center">
            <div className="absolute inset-0 opacity-90" style={{ background: videoOverlay }} />
            <div className="relative z-10 flex flex-col items-center text-center">
              <button
                aria-label={isPlaying ? t('workspace.recordings.pauseRecording', 'Pause recording') : t('workspace.recordings.playRecording', 'Play recording')}
                className="flex h-20 w-20 items-center justify-center rounded-full border"
                onClick={() => setIsPlaying((value) => !value)}
                style={{
                  background: 'rgba(0,229,186,0.16)',
                  borderColor: 'rgba(0,229,186,0.36)',
                  color: 'rgb(0,229,186)',
                }}
                type="button"
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
              <p className="mt-4 text-base font-black uppercase tracking-[0.12em]" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
                {isPlaying ? t('workspace.recordings.playing', 'Playing recording') : t('workspace.recordings.paused', 'Recording paused')}
              </p>
              <p className="mt-2 max-w-md text-base leading-7" style={{ color: isLight ? '#475569' : '#cbd5e1' }}>
                {t('workspace.recordings.assetNote', 'This is the saved meeting recording with summary and follow-up notes.')}
              </p>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border p-5" style={{ background: panelBg, borderColor: panelBorder }}>
            <p className={LABEL_CLASS} style={{ color: muted }}>
              {t('workspace.recordings.details', 'Details')}
            </p>
            <div className="mt-4 space-y-3">
              <DetailRow label={t('workspace.recordings.organizer', 'Organizer')} value={HOST_NAME_BY_ID[meeting.hostUserId] ?? meeting.hostUserId} isLight={isLight} />
              <DetailRow label={t('workspace.recordings.participants', 'Participants')} value={meeting.attendeesCount.toString()} isLight={isLight} />
              <DetailRow label={t('workspace.recordings.status', 'Status')} value={t('workspace.recordings.saved', 'Saved recording')} isLight={isLight} />
            </div>
          </section>

          <section className="rounded-3xl border p-5" style={{ background: panelBg, borderColor: panelBorder }}>
            <p className={LABEL_CLASS} style={{ color: muted }}>
              {t('workspace.recordings.summary', 'Summary')}
            </p>
            <p className="mt-3 text-base leading-7" style={{ color: textSecondary }}>
              {summary?.summary ?? t('workspace.recordings.summaryPending', 'Summary is still being prepared.')}
            </p>
          </section>
        </aside>
      </div>

      {summary?.actionItems?.length ? (
        <section className="rounded-3xl border p-5" style={{ background: panelBg, borderColor: panelBorder }}>
          <p className={LABEL_CLASS} style={{ color: muted }}>
            {t('workspace.recordings.followUp', 'Follow up')}
          </p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {summary.actionItems.map((item) => (
              <div
                key={item}
                className="rounded-2xl border p-3 text-base leading-7"
                style={{
                  background: isLight ? 'rgba(248,250,252,0.9)' : 'rgba(255,255,255,0.04)',
                  borderColor: panelBorder,
                  color: textSecondary,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DetailRow({ isLight, label, value }: { isLight: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-base" style={{ background: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)', fontFamily: APP_FONT_FAMILY }}>
      <span style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{label}</span>
      <span className="font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{value}</span>
    </div>
  );
}

function RecordingsFallback() {
  const { t } = useAppTranslations();
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';

  return (
    <div
      className="rounded-3xl border p-6 text-base font-semibold"
      style={{
        background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
        borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
        color: isLight ? '#64748b' : '#94a3b8',
        fontFamily: APP_FONT_FAMILY,
      }}
    >
      {t('workspace.recordings.loading', 'Loading recording...')}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden className="ml-1 h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
      <path d="M7 5h3.5v14H7V5Zm6.5 0H17v14h-3.5V5Z" />
    </svg>
  );
}
