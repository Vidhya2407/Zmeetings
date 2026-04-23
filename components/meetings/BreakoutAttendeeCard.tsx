'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { fetchJsonWithRetry } from '@/lib/api/fetchJsonWithRetry';
import { formatBreakoutAnnouncementType } from '@/lib/meetings/breakoutUi';
import { useAppTranslations } from '@/lib/utils/translations';
import type { BreakoutSessionResponse } from '@/types/domain/breakout';

type BreakoutAttendeeCardProps = {
  isLight: boolean;
  meetingId: string;
  onUnauthorized?: () => void;
  participantId: string;
};

export default function BreakoutAttendeeCard(props: BreakoutAttendeeCardProps) {
  const { isLight, meetingId, onUnauthorized, participantId } = props;
  const { isGerman } = useAppTranslations();
  const router = useRouter();
  const [session, setSession] = React.useState<BreakoutSessionResponse['session']>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const movedSessionRef = React.useRef<string | null>(null);
  const locale = isGerman ? 'de-DE' : 'en-US';

  const loadBreakoutState = React.useCallback(async () => {
    const result = await fetchJsonWithRetry<BreakoutSessionResponse>(
      `/api/meetings/${encodeURIComponent(meetingId)}/breakouts/current?participantId=${encodeURIComponent(participantId)}`,
      { cache: 'no-store' },
    );
    if (result.unauthorized) {
      onUnauthorized?.();
      return;
    }
    if (!result.ok) {
      setError(result.error ?? (isGerman ? 'Breakout-Zuweisung konnte nicht geladen werden.' : 'Unable to load breakout assignment.'));
      return;
    }
    setSession(result.data?.session ?? null);
    setError(null);
  }, [isGerman, meetingId, onUnauthorized, participantId]);

  React.useEffect(() => {
    void loadBreakoutState();
    const timer = window.setInterval(() => {
      void loadBreakoutState();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [loadBreakoutState]);

  React.useEffect(() => {
    const activeSession = session;
    const myAssignment = activeSession?.myAssignment;
    const assignedRoom = myAssignment
      ? activeSession?.rooms.find((room) => room.id === myAssignment.roomId) ?? null
      : null;
    if (!activeSession || !myAssignment || activeSession.status !== 'active' || assignedRoom?.status === 'merged') {
      return;
    }
    if (movedSessionRef.current === activeSession.sessionId) {
      return;
    }
    movedSessionRef.current = activeSession.sessionId;
    const timeout = window.setTimeout(() => {
      router.push(`/meetings/live?meetingId=${encodeURIComponent(meetingId)}&breakoutSessionId=${encodeURIComponent(activeSession.sessionId)}&breakoutRoomId=${encodeURIComponent(myAssignment.roomId)}`);
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [meetingId, router, session]);

  const toggleHelpRequest = React.useCallback(async () => {
    if (!session) {
      return;
    }

    setBusy(true);
    const result = await fetchJsonWithRetry<BreakoutSessionResponse>(
      `/api/meetings/${encodeURIComponent(meetingId)}/breakouts/sessions/${encodeURIComponent(session.sessionId)}/actions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          session.myHelpRequest
            ? {
                action: 'clearHelpRequest',
                participantId,
              }
            : {
                action: 'requestHelp',
                participantId,
                participantName: session.myAssignment?.participantName ?? (isGerman ? 'Teilnehmer' : 'Participant'),
              },
        ),
      },
    );
    setBusy(false);
    if (result.unauthorized) {
      onUnauthorized?.();
      return;
    }
    if (!result.ok) {
      setError(result.error ?? (isGerman ? 'Host-Hilfeanfrage konnte nicht aktualisiert werden.' : 'Unable to update breakout help request.'));
      return;
    }
    setSession(result.data?.session ?? null);
    setError(null);
  }, [isGerman, meetingId, onUnauthorized, participantId, session]);

  if (!session?.myAssignment && !error) {
    return null;
  }

  const assignedRoom = session?.myAssignment
    ? session.rooms.find((room) => room.id === session.myAssignment?.roomId) ?? null
    : null;
  const latestBroadcast = session?.latestBroadcast ?? null;
  const latestAnnouncement = session?.latestAnnouncement ?? null;

  const borderColor = isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.14)';
  const cardBg = isLight ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.05)';
  const textPrimary = isLight ? '#0f172a' : '#f8fafc';
  const textMuted = isLight ? '#64748b' : '#94a3b8';

  return (
    <section className="rounded-[26px] border p-4" style={{ borderColor, background: cardBg }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: textMuted }}>
            {isGerman ? 'Breakout-Zuweisung' : 'Breakout Assignment'}
          </p>
          {error ? (
            <p className="mt-1 text-xs font-semibold" style={{ color: isLight ? '#991b1b' : '#fecaca' }}>{error}</p>
          ) : session?.myAssignment ? (
            <>
              <p className="mt-1 text-sm font-black" style={{ color: textPrimary }}>{session.myAssignment.roomName}</p>
              <p className="text-xs" style={{ color: textMuted }}>
                {assignedRoom?.status === 'closing'
                  ? (isGerman ? `Rueckkehr zum Hauptraum in ${assignedRoom.secondsUntilMerge}s` : `Returning to the main room in ${assignedRoom.secondsUntilMerge}s`)
                  : assignedRoom?.status === 'merged'
                    ? (isGerman ? 'Zurueck in den Hauptraum zusammengefuehrt.' : 'Merged back to the main room.')
                  : session.status === 'countdown'
                  ? (isGerman ? `Start in ${session.secondsRemaining}s` : `Starts in ${session.secondsRemaining}s`)
                  : session.status === 'active'
                    ? (isGerman ? 'Du wirst jetzt in deinen Breakout-Raum verschoben...' : 'Moving you to your breakout room...')
                    : (isGerman ? 'Warten auf den Host, um die Breakouts zu starten.' : 'Waiting for host to start breakout.')}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs" style={{ color: textMuted }}>
              {isGerman ? 'Warten auf eine Zuweisung durch den Host.' : 'Waiting for host assignment.'}
            </p>
          )}
        </div>
        <span
          className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]"
          style={{
            border: `1px solid ${borderColor}`,
            background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.74)',
            color: session?.status === 'active'
              ? '#10b981'
              : session?.status === 'countdown'
                ? '#f59e0b'
                : textMuted,
          }}
        >
          {session?.status === 'active'
            ? (isGerman ? 'aktiv' : 'active')
            : session?.status === 'countdown'
              ? (isGerman ? 'countdown' : 'countdown')
              : session?.status === 'draft'
                ? (isGerman ? 'entwurf' : 'draft')
                : session?.status === 'ended'
                  ? (isGerman ? 'beendet' : 'ended')
                  : (isGerman ? 'ausstehend' : 'pending')}
        </span>
      </div>

      {latestBroadcast ? (
        <div className="mt-3 rounded-2xl border px-3 py-3" style={{ borderColor, background: isLight ? 'rgba(248,250,252,0.92)' : 'rgba(15,23,42,0.72)' }}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: textMuted }}>
            {isGerman ? 'Host-Durchsage' : 'Host Broadcast'}
          </p>
          <p className="mt-2 text-xs leading-5" style={{ color: textPrimary }}>{latestBroadcast.message}</p>
        </div>
      ) : null}

      {latestAnnouncement ? (
        <div className="mt-3 rounded-2xl border px-3 py-3" style={{ borderColor, background: isLight ? 'rgba(237,246,255,0.92)' : 'rgba(30,41,59,0.78)' }}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: textMuted }}>
            {formatBreakoutAnnouncementType(latestAnnouncement.type, isGerman ? 'de' : 'en')}
          </p>
          <p className="mt-2 text-xs leading-5" style={{ color: textPrimary }}>{latestAnnouncement.message}</p>
        </div>
      ) : null}

      {session?.status === 'active' && assignedRoom?.status !== 'merged' ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => { void toggleHelpRequest(); }}
            disabled={busy}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            style={{
              borderColor,
              background: session.myHelpRequest
                ? (isLight ? 'rgba(244,114,182,0.12)' : 'rgba(244,114,182,0.2)')
                : (isLight ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.2)'),
              color: session.myHelpRequest
                ? (isLight ? '#9d174d' : '#f9a8d4')
                : (isLight ? '#1d4ed8' : '#93c5fd'),
            }}
          >
            {session.myHelpRequest
              ? session.myHelpRequest.kind === 'merge'
                ? (isGerman ? 'Merge-Anfrage abbrechen' : 'Cancel Merge Request')
                : (isGerman ? 'Hilfeanfrage abbrechen' : 'Cancel Help Request')
              : (isGerman ? 'Host-Hilfe anfragen' : 'Request Host Help')}
          </button>
          <p className="mt-2 text-xs" style={{ color: textMuted }}>
            {session.myHelpRequest
              ? session.myHelpRequest.kind === 'merge'
                ? (isGerman
                  ? `Merge angefragt um ${new Date(session.myHelpRequest.requestedAt).toLocaleTimeString(locale)}.`
                  : `Merge requested at ${new Date(session.myHelpRequest.requestedAt).toLocaleTimeString(locale)}.`)
                : (isGerman
                  ? `Host-Hilfe angefragt um ${new Date(session.myHelpRequest.requestedAt).toLocaleTimeString(locale)}.`
                  : `Host help requested at ${new Date(session.myHelpRequest.requestedAt).toLocaleTimeString(locale)}.`)
              : (isGerman
                ? 'Nutze dies, wenn dein Breakout-Raum einen Host oder Moderator braucht.'
                : 'Use this if your breakout room needs a host or moderator to join.')}
          </p>
        </div>
      ) : null}
    </section>
  );
}
