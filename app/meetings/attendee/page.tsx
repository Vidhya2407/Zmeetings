'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { fetchJsonWithRetry } from '@/lib/api/fetchJsonWithRetry';
import { useThemeStore } from '../../../lib/stores/themeStore';
import { DEMO_MEETING_ROOM_ID } from '@/lib/meetings/config';
import { useAppTranslations } from '@/lib/utils/translations';
import type { Meeting } from '../../../types/domain/workspace';

export const dynamic = 'force-dynamic';

const HOST_NAME_BY_ID: Record<string, string> = {
  u1: 'Dr. Sarah Chen',
  u2: 'Marcus Webb',
  u3: 'Amara Diallo',
  u4: 'Prof. Erik Larsen',
  u5: 'Yuki Tanaka',
  u6: 'Leo Martins',
};

function formatMeetingTimeLabel(startsAt: string, locale: string, isGerman: boolean): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return isGerman ? 'Offen' : 'TBD';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(start);
}

function formatMeetingDurationLabel(startsAt: string, endsAt: string, isGerman: boolean): string {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return isGerman ? '60 Min' : '60 min';
  return `${Math.round((end - start) / 60000)} ${isGerman ? 'Min' : 'min'}`;
}

function formatMeetingStateLabel(status: Meeting['status'], isGerman: boolean): string {
  if (status === 'live') return isGerman ? 'Jetzt live' : 'Live now';
  if (status === 'ended') return isGerman ? 'Abgeschlossen' : 'Completed';
  return isGerman ? 'Geplant' : 'Scheduled';
}

function canEnterMeeting(meeting: Meeting | null, nowMs: number) {
  if (!meeting || meeting.status === 'ended') return false;
  if (meeting.status === 'live') return true;
  const startsAt = new Date(meeting.startsAt).getTime();
  if (!Number.isFinite(startsAt)) return false;
  return startsAt - nowMs <= 10 * 60 * 1000;
}

export default function MeetingsAttendeePage() {
  return (
    <Suspense fallback={<MeetingsAttendeeFallback />}>
      <MeetingsAttendeePageContent />
    </Suspense>
  );
}

function MeetingsAttendeePageContent() {
  const searchParams = useSearchParams();
  const { isGerman } = useAppTranslations();
  const { status: sessionStatus } = useSession();
  const { theme } = useThemeStore();
  const isLight = theme === 'light';
  const activeMeetingId = searchParams.get('meetingId')?.trim() || DEMO_MEETING_ROOM_ID;
  const liveMeetingHref = `/meetings/live?meetingId=${encodeURIComponent(activeMeetingId)}`;
  const locale = isGerman ? 'de-DE' : 'en-US';

  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  const pageBg = isLight ? '#f3f6f9' : 'linear-gradient(135deg, #0A0F18 0%, #0D1524 55%, #121b2a 100%)';
  const textPrimary = isLight ? '#0f172a' : '#f8fafc';
  const textSecondary = isLight ? '#475569' : '#cbd5e1';
  const textMuted = isLight ? '#64748b' : '#94a3b8';
  const shellBorder = isLight ? 'rgba(148,163,184,0.26)' : 'rgba(255,255,255,0.08)';
  const softCard = isLight ? 'rgba(248,250,252,0.82)' : 'rgba(255,255,255,0.04)';
  const strongCard = isLight ? 'rgba(255,255,255,0.88)' : 'rgba(15,23,42,0.82)';
  const elevatedBg = isLight ? 'linear-gradient(160deg,rgba(255,255,255,0.88),rgba(239,246,255,0.90))' : 'linear-gradient(160deg,rgba(17,24,39,0.92),rgba(15,23,42,0.88))';

  const organizerName = activeMeeting ? (HOST_NAME_BY_ID[activeMeeting.hostUserId] ?? (isGerman ? 'Meeting-Team' : 'Meeting team')) : (isGerman ? 'Meeting-Team' : 'Meeting team');
  const activeMeetingTitle = activeMeeting?.title ?? (isGerman ? 'Meeting wird geladen' : 'Loading meeting');
  const activeMeetingStartLabel = activeMeeting ? formatMeetingTimeLabel(activeMeeting.startsAt, locale, isGerman) : (isGerman ? 'Offen' : 'TBD');
  const activeMeetingDurationLabel = activeMeeting ? formatMeetingDurationLabel(activeMeeting.startsAt, activeMeeting.endsAt, isGerman) : (isGerman ? '60 Min' : '60 min');
  const activeMeetingRoomCode = activeMeeting?.roomCode ?? `ROOM-${activeMeetingId.toUpperCase()}`;
  const activeMeetingStatusLabel = activeMeeting ? formatMeetingStateLabel(activeMeeting.status, isGerman) : (isGerman ? 'Laden' : 'Loading');
  const roomCanOpen = useMemo(() => canEnterMeeting(activeMeeting, nowMs), [activeMeeting, nowMs]);
  const startsAtMs = activeMeeting ? new Date(activeMeeting.startsAt).getTime() : Number.NaN;
  const minutesUntilStart = Number.isFinite(startsAtMs) ? Math.max(0, Math.ceil((startsAtMs - nowMs) / 60000)) : null;

  useEffect(() => {
    setNowMs(Date.now());
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMeetingData = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const meetingRes = await fetchJsonWithRetry<{ meeting: Meeting }>(`/api/meetings/${encodeURIComponent(activeMeetingId)}`, { cache: 'no-store' });

        if (meetingRes.unauthorized) {
          if (!cancelled) {
            setSessionExpired(true);
          }
          return;
        }

        if (!meetingRes.ok || !meetingRes.data?.meeting) {
          throw new Error(meetingRes.error ?? (isGerman ? 'Meeting konnte nicht geladen werden.' : 'Unable to load this meeting.'));
        }

        if (!cancelled) {
          setActiveMeeting(meetingRes.data.meeting);
          setSessionExpired(false);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : (isGerman ? 'Meeting konnte nicht geladen werden.' : 'Unable to load this meeting.'));
          setActiveMeeting(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMeetingData();

    return () => {
      cancelled = true;
    };
  }, [activeMeetingId, isGerman]);

  return (
    <main className="min-h-screen relative overflow-hidden" style={{ background: pageBg, color: textPrimary }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div className="absolute -top-16 left-[8%] h-80 w-80 rounded-full blur-3xl" style={{ background: isLight ? 'rgba(0,229,186,0.16)' : 'rgba(0,229,186,0.10)' }} animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 10, repeat: Infinity }} />
        <motion.div className="absolute bottom-[-10%] right-[-4%] h-96 w-96 rounded-full blur-3xl" style={{ background: isLight ? 'rgba(0,128,255,0.14)' : 'rgba(0,128,255,0.10)' }} animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 12, repeat: Infinity }} />
        <div className="absolute inset-0" style={{ background: isLight ? 'linear-gradient(180deg,rgba(255,255,255,0.55),rgba(243,246,249,0.92))' : 'linear-gradient(180deg,rgba(10,15,24,0.28),rgba(10,15,24,0.88))' }} />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-10 lg:px-10">
        {sessionExpired ? (
          <div
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: isLight ? 'rgba(220,38,38,0.24)' : 'rgba(248,113,113,0.35)',
              background: isLight ? 'rgba(254,242,242,0.9)' : 'rgba(127,29,29,0.32)',
              color: isLight ? '#7f1d1d' : '#fecaca',
            }}
          >
            <span>{isGerman ? 'Bitte melde dich an, um dieses Meeting zu oeffnen.' : 'Please sign in to open this meeting.'}</span>
            <Link
              href={`/login?next=${encodeURIComponent(`/meetings/attendee?meetingId=${activeMeetingId}`)}`}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{
                borderColor: isLight ? 'rgba(220,38,38,0.28)' : 'rgba(248,113,113,0.40)',
                background: isLight ? 'rgba(255,255,255,0.84)' : 'rgba(255,255,255,0.08)',
                color: isLight ? '#991b1b' : '#fee2e2',
              }}
            >
              {isGerman ? 'Anmelden' : 'Sign in'}
            </Link>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.32em]" style={{ color: isLight ? 'rgba(4,120,87,0.7)' : 'rgba(110,231,183,0.7)' }}>{isGerman ? 'Teilnehmer-Studio' : 'Attendee Studio'}</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight" style={{ color: textPrimary }}>{isGerman ? 'Bereit machen' : 'Get Ready'}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: textSecondary }}>
              {isGerman ? 'Pruefe Details und Geraete. Wenn der Raum offen ist, kannst du direkt beitreten.' : 'Review the details and device settings. When the room opens, you can enter the live meeting.'}
            </p>
          </div>
          <Link
            href="/meet"
            className="rounded-2xl px-5 py-3 text-sm font-bold"
            style={{
              border: `1px solid ${shellBorder}`,
              background: strongCard,
              color: textPrimary,
            }}
          >
            {isGerman ? 'Zurueck zu Meetings' : 'Back to meetings'}
          </Link>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[34px] p-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl" style={{ border: `1px solid ${shellBorder}`, background: strongCard }}>
            {loading ? (
              <p className="text-sm" style={{ color: textSecondary }}>{isGerman ? 'Meeting wird geladen...' : 'Loading meeting...'}</p>
            ) : loadError ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-black" style={{ color: textPrimary }}>{isGerman ? 'Meeting nicht verfuegbar' : 'Meeting unavailable'}</h2>
                <p className="text-sm leading-6" style={{ color: textSecondary }}>{loadError}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em]" style={{ border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.10)', color: isLight ? '#047857' : '#6ee7b7' }}>{isGerman ? 'Meeting-Details' : 'Meeting Details'}</div>
                    <h2 className="mt-4 text-2xl font-black" style={{ color: textPrimary }}>{activeMeetingTitle}</h2>
                    <p className="mt-3 text-sm leading-6" style={{ color: textSecondary }}>
                      {isGerman ? `Organisiert von ${organizerName}.` : `Organized by ${organizerName}.`}
                    </p>
                  </div>
                  <span className="rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em]" style={{ border: '1px solid rgba(96,165,250,0.25)', background: 'rgba(96,165,250,0.10)', color: isLight ? '#1d4ed8' : '#93c5fd' }}>
                    {activeMeetingStatusLabel}
                  </span>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: isGerman ? 'Start' : 'Start', value: activeMeetingStartLabel },
                    { label: isGerman ? 'Dauer' : 'Duration', value: activeMeetingDurationLabel },
                    { label: isGerman ? 'Raumcode' : 'Room code', value: activeMeetingRoomCode },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl p-4" style={{ border: `1px solid ${shellBorder}`, background: softCard }}>
                      <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: textMuted }}>{item.label}</div>
                      <div className="mt-2 text-sm font-black" style={{ color: textPrimary }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap items-start gap-3">
                  {roomCanOpen ? (
                    <Link href={liveMeetingHref} className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-black text-[#041110] shadow-[0_14px_30px_rgba(16,185,129,0.25)]">{isGerman ? 'Meeting beitreten' : 'Join meeting'}</Link>
                  ) : (
                    <div className="space-y-2">
                      <button
                        className="rounded-2xl px-6 py-3 text-sm font-black"
                        disabled
                        style={{
                          background: isLight ? 'rgba(148,163,184,0.18)' : 'rgba(255,255,255,0.08)',
                          border: `1px solid ${shellBorder}`,
                          color: textMuted,
                        }}
                        type="button"
                      >
                        {isGerman ? 'Meeting beitreten' : 'Join meeting'}
                      </button>
                      <p className="max-w-xs text-xs font-semibold" style={{ color: textMuted }}>
                        {activeMeeting?.status === 'ended'
                          ? (isGerman ? 'Dieses Meeting ist beendet.' : 'This meeting has ended.')
                          : minutesUntilStart !== null
                            ? (isGerman ? `Der Beitritt oeffnet ${minutesUntilStart} Minuten vor dem Start.` : `Joining opens ${minutesUntilStart} minutes before start.`)
                            : (isGerman ? 'Der Beitritt ist noch nicht offen.' : 'Joining is not open yet.')}
                      </p>
                    </div>
                  )}
                  <Link href="/calendar" className="rounded-2xl px-6 py-3 text-sm font-bold" style={{ border: `1px solid ${shellBorder}`, background: strongCard, color: textPrimary }}>{isGerman ? 'Kalender oeffnen' : 'Open calendar'}</Link>
                </div>
              </>
            )}
          </section>

          <section className="rounded-[34px] p-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl" style={{ border: `1px solid ${shellBorder}`, background: elevatedBg }}>
            <div className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: textMuted }}>{isGerman ? 'Geraetecheck' : 'Device Check'}</div>
            <h2 className="mt-3 text-2xl font-black" style={{ color: textPrimary }}>{isGerman ? 'Vor dem Beitritt' : 'Before You Join'}</h2>
            <p className="mt-2 text-sm leading-6" style={{ color: textSecondary }}>
              {isGerman ? 'Passe Kamera und Mikrofon an, bevor du den Live-Raum betrittst.' : 'Adjust camera and microphone before entering the live room.'}
            </p>
            <div className="mt-5 space-y-3">
              {[
                { label: isGerman ? 'Kamera' : 'Camera', value: cameraOn, set: setCameraOn },
                { label: isGerman ? 'Mikrofon' : 'Microphone', value: micOn, set: setMicOn },
                { label: isGerman ? 'Bildschirmfreigabe' : 'Screen share', value: screenShareOn, set: setScreenShareOn },
              ].map((control) => (
                <button
                  key={control.label}
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left"
                  onClick={() => control.set((current) => !current)}
                  style={{ border: `1px solid ${shellBorder}`, background: strongCard }}
                  type="button"
                >
                  <span className="text-sm font-semibold" style={{ color: textSecondary }}>{control.label}</span>
                  <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background: control.value ? 'rgba(0,229,186,0.13)' : softCard, color: control.value ? 'rgb(0,150,118)' : textMuted }}>
                    {control.value ? (isGerman ? 'Ein' : 'On') : (isGerman ? 'Aus' : 'Off')}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-[34px] p-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl" style={{ border: `1px solid ${shellBorder}`, background: strongCard }}>
          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[28px] p-5" style={{ border: `1px solid ${shellBorder}`, background: softCard }}>
              <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: textMuted }}>{isGerman ? 'Agenda' : 'Agenda'}</div>
              <div className="mt-4 space-y-3">
                {[
                  isGerman ? 'Begruessung und Meeting-Ziel' : 'Welcome and meeting goal',
                  isGerman ? 'Hauptdiskussion' : 'Main discussion',
                  isGerman ? 'Fragen und Entscheidungen' : 'Questions and decisions',
                  isGerman ? 'Zusammenfassung und naechste Schritte' : 'Summary and next steps',
                ].map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-2xl px-4 py-3 shadow-sm" style={{ background: strongCard }}>
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-black text-emerald-700">{index + 1}</div>
                    <div className="text-sm" style={{ color: textSecondary }}>{step}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] p-5" style={{ border: `1px solid ${shellBorder}`, background: elevatedBg }}>
              <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: textMuted }}>{isGerman ? 'Hinweise' : 'Notes'}</div>
              <div className="mt-4 space-y-4 text-sm leading-6" style={{ color: textSecondary }}>
                <p>{isGerman ? 'Halte deinen Raumcode bereit, falls du erneut beitreten musst.' : 'Keep your room code nearby in case you need to rejoin.'}</p>
                <p>{isGerman ? 'Untertitel und Chat sind im Live-Raum verfuegbar, wenn sie fuer dieses Meeting aktiviert sind.' : 'Captions and chat are available in the live room when enabled for this meeting.'}</p>
                <p>{isGerman ? 'Aufzeichnungen und Zusammenfassungen erscheinen nach dem Meeting unter Aufzeichnungen.' : 'Recordings and summaries appear in Recordings after the meeting.'}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MeetingsAttendeeFallback() {
  const { isGerman } = useAppTranslations();
  const { theme } = useThemeStore();
  const isLight = theme === 'light';
  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: isLight ? '#f3f6f9' : 'linear-gradient(180deg, #09121f 0%, #0a1320 100%)' }}>
      <p className="text-sm font-semibold" style={{ color: isLight ? '#475569' : '#cbd5e1' }}>{isGerman ? 'Teilnehmer-Studio wird geladen...' : 'Loading attendee studio...'}</p>
    </main>
  );
}
