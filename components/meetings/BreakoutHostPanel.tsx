'use client';

import * as React from 'react';
import Link from 'next/link';
import { fetchJsonWithRetry } from '@/lib/api/fetchJsonWithRetry';
import { formatBreakoutAnnouncementType } from '@/lib/meetings/breakoutUi';
import { useAppTranslations } from '@/lib/utils/translations';
import type { BreakoutParticipantSeed, BreakoutSessionResponse, BreakoutSessionSnapshot } from '@/types/domain/breakout';

type BreakoutHostPanelProps = {
  isLight: boolean;
  meetingId: string;
  onNotice?: (message: string) => void;
  onUnauthorized?: () => void;
  participants: BreakoutParticipantSeed[];
};

function isModeratorRole(role: string) {
  const normalized = role.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('host')
    || normalized.includes('cohost')
    || normalized.includes('moderator')
    || normalized.includes('admin')
    || normalized.includes('owner')
  );
}

function buildBreakoutJoinHref(meetingId: string, sessionId: string, roomId: string) {
  const params = new URLSearchParams({ meetingId });
  params.set('breakoutSessionId', sessionId);
  params.set('breakoutRoomId', roomId);
  return `/meetings/live?${params.toString()}`;
}

export default function BreakoutHostPanel(props: BreakoutHostPanelProps) {
  const { isLight, meetingId, onNotice, onUnauthorized, participants } = props;
  const { isGerman } = useAppTranslations();
  const [session, setSession] = React.useState<BreakoutSessionSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [roomCountInput, setRoomCountInput] = React.useState('3');
  const [countdownInput, setCountdownInput] = React.useState('20');
  const [mergeCountdownInput, setMergeCountdownInput] = React.useState('15');
  const [broadcastMessageInput, setBroadcastMessageInput] = React.useState('');
  const [selectedParticipantId, setSelectedParticipantId] = React.useState('');
  const [selectedRoomId, setSelectedRoomId] = React.useState('');
  const [batchTargetRoomId, setBatchTargetRoomId] = React.useState('');
  const [selectedBatchParticipantIds, setSelectedBatchParticipantIds] = React.useState<string[]>([]);
  const locale = isGerman ? 'de-DE' : 'en-US';

  const assignableParticipants = React.useMemo(
    () => participants.filter((participant) => !isModeratorRole(participant.role)),
    [participants],
  );
  const selectedParticipant = React.useMemo(
    () => assignableParticipants.find((participant) => participant.id === selectedParticipantId) ?? null,
    [assignableParticipants, selectedParticipantId],
  );
  const openRooms = React.useMemo(
    () => session?.rooms.filter((room) => room.status === 'open') ?? [],
    [session],
  );
  const selectedBatchAssignments = React.useMemo(
    () => session?.assignments.filter((assignment) => selectedBatchParticipantIds.includes(assignment.participantId)) ?? [],
    [selectedBatchParticipantIds, session],
  );

  const loadCurrentSession = React.useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    const result = await fetchJsonWithRetry<BreakoutSessionResponse>(
      `/api/meetings/${encodeURIComponent(meetingId)}/breakouts/current`,
      { cache: 'no-store' },
    );
    if (result.unauthorized) {
      onUnauthorized?.();
      setLoading(false);
      return;
    }
    if (!result.ok) {
      if (!silent) {
        setError(result.error ?? (isGerman ? 'Breakout-Raeume konnten nicht geladen werden.' : 'Unable to load breakout rooms.'));
      }
      setLoading(false);
      return;
    }
    setSession(result.data?.session ?? null);
    setError(null);
    setLoading(false);
  }, [isGerman, meetingId, onUnauthorized]);

  React.useEffect(() => {
    void loadCurrentSession(false);
  }, [loadCurrentSession]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void loadCurrentSession(true);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [loadCurrentSession]);

  React.useEffect(() => {
    if (!openRooms.length) {
      if (selectedRoomId) {
        setSelectedRoomId('');
      }
      if (batchTargetRoomId) {
        setBatchTargetRoomId('');
      }
      return;
    }
    if (!selectedRoomId || !openRooms.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId(openRooms[0].id);
    }
    if (!batchTargetRoomId || !openRooms.some((room) => room.id === batchTargetRoomId)) {
      setBatchTargetRoomId(openRooms[0].id);
    }
  }, [batchTargetRoomId, openRooms, selectedRoomId]);

  React.useEffect(() => {
    if (!session) {
      if (selectedBatchParticipantIds.length) {
        setSelectedBatchParticipantIds([]);
      }
      return;
    }

    const validParticipantIds = new Set(session.assignments.map((assignment) => assignment.participantId));
    const nextSelectedParticipantIds = selectedBatchParticipantIds.filter((participantId) => validParticipantIds.has(participantId));
    if (nextSelectedParticipantIds.length !== selectedBatchParticipantIds.length) {
      setSelectedBatchParticipantIds(nextSelectedParticipantIds);
    }
  }, [selectedBatchParticipantIds, session]);

  const runAction = React.useCallback(
    async (payload: unknown) => {
      if (!session) {
        setError(isGerman ? 'Erstelle zuerst ein Breakout-Set.' : 'Create a breakout set first.');
        return null;
      }
      setBusy(true);
      const result = await fetchJsonWithRetry<BreakoutSessionResponse>(
        `/api/meetings/${encodeURIComponent(meetingId)}/breakouts/sessions/${encodeURIComponent(session.sessionId)}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      setBusy(false);
      if (result.unauthorized) {
        onUnauthorized?.();
        return null;
      }
      if (!result.ok) {
        setError(result.error ?? (isGerman ? 'Breakout-Aktion konnte nicht ausgefuehrt werden.' : 'Unable to execute breakout action.'));
        return null;
      }
      const nextSession = result.data?.session ?? null;
      setSession(nextSession);
      setError(null);
      return nextSession;
    },
    [isGerman, meetingId, onUnauthorized, session],
  );

  const handleCreateSession = async () => {
    const parsedRoomCount = Number.parseInt(roomCountInput, 10);
    if (!Number.isFinite(parsedRoomCount) || parsedRoomCount < 1) {
      setError(isGerman ? 'Die Anzahl der Raeume muss mindestens 1 sein.' : 'Room count must be at least 1.');
      return;
    }
    setBusy(true);
    const result = await fetchJsonWithRetry<BreakoutSessionResponse>(
      `/api/meetings/${encodeURIComponent(meetingId)}/breakouts/sessions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCount: parsedRoomCount,
        }),
      },
    );
    setBusy(false);
    if (result.unauthorized) {
      onUnauthorized?.();
      return;
    }
    if (!result.ok) {
      setError(result.error ?? (isGerman ? 'Breakout-Raeume konnten nicht erstellt werden.' : 'Unable to create breakout rooms.'));
      return;
    }
    setSession(result.data?.session ?? null);
    setError(null);
    onNotice?.(
      isGerman
        ? `Breakout-Set mit ${Math.max(1, parsedRoomCount)} Raeumen erstellt.`
        : `Breakout set created with ${Math.max(1, parsedRoomCount)} rooms.`,
    );
  };

  const handleAutoAssign = async () => {
    if (!session) {
      setError(isGerman ? 'Erstelle zuerst ein Breakout-Set.' : 'Create a breakout set first.');
      return;
    }
    if (!assignableParticipants.length) {
      setError(isGerman ? 'Keine Teilnehmer fuer eine Zuweisung verfuegbar.' : 'No attendee participants available for assignment.');
      return;
    }
    const next = await runAction({
      action: 'autoAssign',
      participants: assignableParticipants,
    });
    if (next) {
      onNotice?.(
        isGerman
          ? `${next.assignments.length} Teilnehmer automatisch zugewiesen.`
          : `Auto-assigned ${next.assignments.length} participants.`,
      );
    }
  };

  const handleManualAssign = async () => {
    if (!session) {
      setError(isGerman ? 'Erstelle zuerst ein Breakout-Set.' : 'Create a breakout set first.');
      return;
    }
    if (!selectedParticipant || !selectedRoomId) {
      setError(isGerman ? 'Waehle fuer die manuelle Zuweisung einen Teilnehmer und einen Raum aus.' : 'Choose a participant and a room for manual assignment.');
      return;
    }
    const targetRoom = session.rooms.find((room) => room.id === selectedRoomId);
    if (!targetRoom) {
      setError(isGerman ? 'Der ausgewaehlte Raum ist nicht mehr verfuegbar.' : 'Selected room is no longer available.');
      return;
    }
    const next = await runAction({
      action: 'manualAssign',
      assignments: [
        {
          participantId: selectedParticipant.id,
          participantName: selectedParticipant.displayName,
          participantRole: selectedParticipant.role,
          roomId: selectedRoomId,
        },
      ],
    });
    if (next) {
      onNotice?.(
        isGerman
          ? `${selectedParticipant.displayName} wurde ${targetRoom.name} zugewiesen.`
          : `${selectedParticipant.displayName} assigned to ${targetRoom.name}.`,
      );
    }
  };

  const handleStartBreakout = async () => {
    if (!session) {
      setError(isGerman ? 'Erstelle zuerst ein Breakout-Set.' : 'Create a breakout set first.');
      return;
    }
    const parsedCountdown = Number.parseInt(countdownInput, 10);
    if (!Number.isFinite(parsedCountdown) || parsedCountdown < 0) {
      setError(isGerman ? 'Der Countdown muss 0 oder groesser sein.' : 'Countdown must be 0 or greater.');
      return;
    }
    const next = await runAction({
      action: 'start',
      countdownSeconds: parsedCountdown,
      participants: assignableParticipants,
    });
    if (next) {
      onNotice?.(
        parsedCountdown > 0
          ? (isGerman ? `Breakout startet in ${parsedCountdown}s.` : `Breakout starts in ${parsedCountdown}s.`)
          : (isGerman ? 'Breakout gestartet.' : 'Breakout started.'),
      );
    }
  };

  const handleBroadcast = async () => {
    if (!session) {
      setError(isGerman ? 'Erstelle zuerst ein Breakout-Set.' : 'Create a breakout set first.');
      return;
    }
    const message = broadcastMessageInput.trim();
    if (!message) {
      setError(isGerman ? 'Gib eine Nachricht fuer die Durchsage ein.' : 'Enter a message to broadcast.');
      return;
    }
    const next = await runAction({
      action: 'broadcast',
      message,
    });
    if (next) {
      setBroadcastMessageInput('');
      onNotice?.(isGerman ? 'Durchsage an alle Breakout-Raeume gesendet.' : 'Broadcast sent to all breakout rooms.');
    }
  };

  const handleMergeRoom = async (roomId: string, roomName: string) => {
    if (!session) {
      setError(isGerman ? 'Keine aktive Breakout-Sitzung zum Zusammenfuehren vorhanden.' : 'No active breakout session to merge.');
      return;
    }
    const parsedCountdown = Number.parseInt(mergeCountdownInput, 10);
    if (!Number.isFinite(parsedCountdown) || parsedCountdown < 0) {
      setError(isGerman ? 'Der Merge-Countdown muss 0 oder groesser sein.' : 'Merge countdown must be 0 or greater.');
      return;
    }
    const next = await runAction({
      action: 'mergeRoom',
      roomId,
      countdownSeconds: parsedCountdown,
    });
    if (next) {
      onNotice?.(
        parsedCountdown > 0
          ? (isGerman ? `${roomName} wird in ${parsedCountdown}s wieder zusammengefuehrt.` : `${roomName} will merge back in ${parsedCountdown}s.`)
          : (isGerman ? `${roomName} wird jetzt zusammengefuehrt.` : `${roomName} is merging back now.`),
      );
    }
  };

  const handleMergeAll = async () => {
    if (!session) {
      setError(isGerman ? 'Keine aktive Breakout-Sitzung zum Zusammenfuehren vorhanden.' : 'No active breakout session to merge.');
      return;
    }
    const parsedCountdown = Number.parseInt(mergeCountdownInput, 10);
    if (!Number.isFinite(parsedCountdown) || parsedCountdown < 0) {
      setError(isGerman ? 'Der Merge-Countdown muss 0 oder groesser sein.' : 'Merge countdown must be 0 or greater.');
      return;
    }
    const next = await runAction({
      action: 'mergeAll',
      countdownSeconds: parsedCountdown,
    });
    if (next) {
      onNotice?.(
        parsedCountdown > 0
          ? (isGerman ? `Alle Breakout-Raeume werden in ${parsedCountdown}s wieder zusammengefuehrt.` : `All breakout rooms will merge back in ${parsedCountdown}s.`)
          : (isGerman ? 'Alle Breakout-Raeume werden jetzt zusammengefuehrt.' : 'All breakout rooms are merging back now.'),
      );
    }
  };

  const handleEndBreakout = async () => {
    if (!session) {
      setError(isGerman ? 'Keine aktive Breakout-Sitzung zum Beenden vorhanden.' : 'No active breakout session to end.');
      return;
    }
    const next = await runAction({ action: 'end' });
    if (next) {
      onNotice?.(isGerman ? 'Breakout-Raeume beendet. Teilnehmer koennen zurueckkehren.' : 'Breakout rooms ended. Participants can merge back.');
      await loadCurrentSession(true);
    }
  };

  const handleResolveHelpRequest = async (participantId: string, participantName: string) => {
    const next = await runAction({
      action: 'clearHelpRequest',
      participantId,
    });
    if (next) {
      onNotice?.(
        isGerman
          ? `${participantName} benoetigt keine Host-Hilfe mehr.`
          : `${participantName} no longer needs host help.`,
      );
    }
  };

  const toggleBatchParticipantSelection = (participantId: string) => {
    setSelectedBatchParticipantIds((current) => (
      current.includes(participantId)
        ? current.filter((entry) => entry !== participantId)
        : [...current, participantId]
    ));
  };

  const toggleRoomSelection = (participantIds: string[]) => {
    setSelectedBatchParticipantIds((current) => {
      const roomFullySelected = participantIds.every((participantId) => current.includes(participantId));
      if (roomFullySelected) {
        return current.filter((participantId) => !participantIds.includes(participantId));
      }

      return Array.from(new Set([...current, ...participantIds]));
    });
  };

  const handleBatchMove = async () => {
    if (!session) {
      setError(isGerman ? 'Erstelle zuerst ein Breakout-Set.' : 'Create a breakout set first.');
      return;
    }
    if (!selectedBatchAssignments.length) {
      setError(isGerman ? 'Waehle mindestens einen Teilnehmer zum Verschieben aus.' : 'Select at least one attendee to move.');
      return;
    }
    if (!batchTargetRoomId) {
      setError(isGerman ? 'Waehle einen Breakout-Raum als Ziel fuer die ausgewaehlten Teilnehmer aus.' : 'Choose a breakout room to move the selected attendees into.');
      return;
    }

    const targetRoom = session.rooms.find((room) => room.id === batchTargetRoomId);
    if (!targetRoom || targetRoom.status !== 'open') {
      setError(isGerman ? 'Das ausgewaehlte Ziel fuer den Sammelzug ist nicht mehr offen.' : 'Selected batch move target is no longer open.');
      return;
    }

    const next = await runAction({
      action: 'manualAssign',
      assignments: selectedBatchAssignments.map((assignment) => ({
        participantId: assignment.participantId,
        participantName: assignment.participantName,
        participantRole: assignment.participantRole,
        roomId: batchTargetRoomId,
      })),
    });
    if (next) {
      setSelectedBatchParticipantIds([]);
      onNotice?.(
        isGerman
          ? `${selectedBatchAssignments.length} Teilnehmer nach ${targetRoom.name} verschoben.`
          : `Moved ${selectedBatchAssignments.length} participant${selectedBatchAssignments.length === 1 ? '' : 's'} to ${targetRoom.name}.`,
      );
    }
  };

  const borderColor = isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.14)';
  const cardBg = isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.04)';
  const textPrimary = isLight ? '#0f172a' : '#f8fafc';
  const textMuted = isLight ? '#64748b' : '#94a3b8';
  const statusTone = session?.status === 'active'
    ? '#10b981'
    : session?.status === 'countdown'
      ? '#f59e0b'
      : session?.status === 'draft'
        ? '#3b82f6'
        : '#64748b';

  return (
    <section className="rounded-[32px] p-6 backdrop-blur-xl" style={{ border: `1px solid ${borderColor}`, background: cardBg }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: textMuted }}>
            {isGerman ? 'Breakout-Raeume' : 'Breakout Rooms'}
          </div>
          <h2 className="mt-2 text-xl font-black" style={{ color: textPrimary }}>
            {isGerman ? 'Aufteilen, zuweisen und Raumdiskussionen starten' : 'Split, assign, and start room discussions'}
          </h2>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]"
          style={{
            border: `1px solid ${isLight ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.2)'}`,
            background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(15,23,42,0.65)',
            color: statusTone,
          }}
        >
          {loading ? (isGerman ? 'Laden' : 'Loading') : (session ? session.status : (isGerman ? 'Keine Sitzung' : 'No session'))}
        </span>
      </div>

      {error ? (
        <p
          aria-live="polite"
          className="mt-3 rounded-xl border px-3 py-2 text-xs font-semibold"
          style={{ borderColor: 'rgba(239,68,68,0.35)', background: isLight ? 'rgba(254,242,242,0.9)' : 'rgba(127,29,29,0.35)', color: isLight ? '#7f1d1d' : '#fecaca' }}
        >
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        <label className="rounded-2xl border p-3" style={{ borderColor, background: isLight ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.16)' }}>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: textMuted }}>
            {isGerman ? 'Anzahl Raeume' : 'Room Count'}
          </span>
          <input
            aria-label={isGerman ? 'Anzahl Raeume' : 'Room Count'}
            type="number"
            min={1}
            max={20}
            value={roomCountInput}
            onChange={(event) => setRoomCountInput(event.target.value)}
            className="mt-2 w-full rounded-xl border px-3 py-2 text-sm font-semibold"
            style={{ borderColor, background: isLight ? '#fff' : 'rgba(15,23,42,0.78)', color: textPrimary }}
          />
        </label>
        <button
          type="button"
          onClick={() => { void handleCreateSession(); }}
          disabled={busy}
          className="rounded-2xl px-4 py-3 text-sm font-bold"
          style={{ border: `1px solid ${borderColor}`, background: isLight ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.2)', color: isLight ? '#1d4ed8' : '#93c5fd' }}
        >
          {isGerman ? 'Set erstellen' : 'Create Set'}
        </button>
        <button
          type="button"
          onClick={() => { void handleAutoAssign(); }}
          disabled={busy || !session || session.status !== 'draft'}
          className="rounded-2xl px-4 py-3 text-sm font-bold"
          style={{ border: `1px solid ${borderColor}`, background: isLight ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.2)', color: isLight ? '#065f46' : '#6ee7b7' }}
        >
          {isGerman ? 'Automatisch zuweisen' : 'Auto Assign'}
        </button>
        <button
          type="button"
          onClick={() => { void handleEndBreakout(); }}
          disabled={busy || !session}
          className="rounded-2xl px-4 py-3 text-sm font-bold"
          style={{ border: `1px solid ${borderColor}`, background: isLight ? 'rgba(239,68,68,0.12)' : 'rgba(127,29,29,0.35)', color: isLight ? '#991b1b' : '#fecaca' }}
        >
          {isGerman ? 'Beenden und zurueckfuehren' : 'End & Merge Back'}
        </button>
      </div>

      {session ? (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border p-4" style={{ borderColor, background: isLight ? 'rgba(255,255,255,0.66)' : 'rgba(0,0,0,0.18)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: textMuted }}>Broadcast To All Rooms</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: textMuted }}>
                  {isGerman ? 'Durchsage an alle Raeume' : 'Broadcast To All Rooms'}
                </p>
                {session.latestBroadcast ? (
                  <span className="text-[11px] font-semibold" style={{ color: textMuted }}>
                    {isGerman ? 'Zuletzt gesendet ' : 'Last sent '}
                    {new Date(session.latestBroadcast.createdAt).toLocaleTimeString(locale)}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  aria-label={isGerman ? 'Durchsage' : 'Broadcast Message'}
                  type="text"
                  maxLength={1000}
                  value={broadcastMessageInput}
                  onChange={(event) => setBroadcastMessageInput(event.target.value)}
                  placeholder={isGerman ? 'Rundet eure Diskussion ab und seid bereit fuer die Rueckfuehrung.' : 'Wrap up your discussion and be ready to merge back.'}
                  className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm font-semibold"
                  style={{ borderColor, background: isLight ? '#fff' : 'rgba(15,23,42,0.78)', color: textPrimary }}
                />
                <button
                  type="button"
                  onClick={() => { void handleBroadcast(); }}
                  disabled={busy || !broadcastMessageInput.trim()}
                  className="rounded-xl px-4 py-2 text-sm font-bold"
                  style={{ border: `1px solid ${borderColor}`, background: isLight ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.24)', color: isLight ? '#6b21a8' : '#d8b4fe' }}
                >
                  {isGerman ? 'Senden' : 'Broadcast'}
                </button>
              </div>
              {session.latestBroadcast ? (
                <p className="mt-3 rounded-xl border px-3 py-2 text-xs leading-5" style={{ borderColor, background: isLight ? 'rgba(248,250,252,0.92)' : 'rgba(15,23,42,0.72)', color: textPrimary }}>
                  {session.latestBroadcast.message}
                </p>
              ) : (
                <p className="mt-3 text-xs" style={{ color: textMuted }}>
                  {isGerman ? 'Hosts koennen eine Nachricht senden, die jeder Breakout-Teilnehmer im Raum sieht.' : 'Hosts can send one message that every breakout attendee sees in-room.'}
                </p>
              )}

              {session.latestAnnouncement ? (
                <div className="mt-3 rounded-xl border px-3 py-2 text-xs leading-5" style={{ borderColor, background: isLight ? 'rgba(237,246,255,0.92)' : 'rgba(30,41,59,0.78)', color: textPrimary }}>
                  <span className="font-black uppercase tracking-[0.18em]" style={{ color: textMuted }}>
                    {formatBreakoutAnnouncementType(session.latestAnnouncement.type, isGerman ? 'de' : 'en')}
                  </span>
                  <p className="mt-1">{session.latestAnnouncement.message}</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor, background: isLight ? 'rgba(255,255,255,0.66)' : 'rgba(0,0,0,0.18)' }}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: textMuted }}>
                {isGerman ? 'Zusammenfuehren' : 'Merge Controls'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  aria-label={isGerman ? 'Merge-Countdown Sekunden' : 'Merge Countdown Seconds'}
                  type="number"
                  min={0}
                  max={300}
                  value={mergeCountdownInput}
                  onChange={(event) => setMergeCountdownInput(event.target.value)}
                  className="w-32 rounded-xl border px-3 py-2 text-sm font-semibold"
                  style={{ borderColor, background: isLight ? '#fff' : 'rgba(15,23,42,0.78)', color: textPrimary }}
                />
                <button
                  type="button"
                  onClick={() => { void handleMergeAll(); }}
                  disabled={busy || !session.rooms.some((room) => room.status !== 'merged')}
                  className="rounded-xl px-3 py-2 text-xs font-bold"
                  style={{ border: `1px solid ${borderColor}`, background: isLight ? 'rgba(244,114,182,0.12)' : 'rgba(244,114,182,0.2)', color: isLight ? '#9d174d' : '#f9a8d4' }}
                >
                  {isGerman ? 'Alle Raeume zusammenfuehren' : 'Merge All Rooms'}
                </button>
              </div>
              <p className="mt-2 text-xs" style={{ color: textMuted }}>
                {isGerman ? 'Plane eine sichere Rueckkehr in den Hauptraum fuer einzelne Raeume oder fuer alle gemeinsam.' : 'Schedule a safe handoff back to the main room for one room at a time or for everyone together.'}
              </p>
              <p className="mt-2 text-xs font-semibold" style={{ color: session.assignmentsLocked ? '#f59e0b' : textMuted }}>
                {session.assignmentsLocked
                  ? (isGerman ? 'Die Aufteilung ist serverseitig gesperrt. Automatische Zuweisung ist deaktiviert, manuelle Verschiebungen bleiben aber moeglich.' : 'Split is locked on the server. Auto-assign is disabled, but manual participant moves stay available.')
                  : (isGerman ? 'Zuweisungen bleiben editierbar, bis der Breakout-Countdown startet.' : 'Assignments stay editable until the breakout countdown starts.')}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border p-4" style={{ borderColor, background: isLight ? 'rgba(255,255,255,0.66)' : 'rgba(0,0,0,0.18)' }}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: textMuted }}>
                {isGerman ? 'Manuell zuweisen' : 'Manual Assign'}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select
                  aria-label={isGerman ? 'Zuzuweisender Teilnehmer' : 'Participant To Assign'}
                  value={selectedParticipantId}
                  onChange={(event) => setSelectedParticipantId(event.target.value)}
                  className="rounded-xl border px-3 py-2 text-sm font-semibold"
                  style={{ borderColor, background: isLight ? '#fff' : 'rgba(15,23,42,0.78)', color: textPrimary }}
                >
                  <option value="">{isGerman ? 'Teilnehmer auswaehlen' : 'Select participant'}</option>
                  {assignableParticipants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.displayName}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={isGerman ? 'Zielraum fuer Breakout-Zuweisung' : 'Breakout Room Assignment Target'}
                  value={selectedRoomId}
                  onChange={(event) => setSelectedRoomId(event.target.value)}
                  className="rounded-xl border px-3 py-2 text-sm font-semibold"
                  style={{ borderColor, background: isLight ? '#fff' : 'rgba(15,23,42,0.78)', color: textPrimary }}
                >
                  <option value="">{isGerman ? 'Raum auswaehlen' : 'Select room'}</option>
                  {openRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => { void handleManualAssign(); }}
                disabled={busy || !selectedParticipantId || !selectedRoomId || session.status === 'countdown'}
                className="mt-3 rounded-xl px-3 py-2 text-xs font-bold"
                style={{ border: `1px solid ${borderColor}`, background: isLight ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.2)', color: isLight ? '#0c4a6e' : '#bae6fd' }}
              >
                {isGerman ? 'Ausgewaehlten Teilnehmer zuweisen' : 'Assign Selected Participant'}
              </button>
              <p className="mt-2 text-xs" style={{ color: textMuted }}>
                {session.status === 'countdown'
                  ? (isGerman ? 'Waehrend des Countdowns sind Zuweisungen gesperrt.' : 'Assignments are locked while the countdown runs.')
                  : (isGerman ? 'Eine neue Zuweisung verschiebt einen Teilnehmer zwischen aktiven Breakout-Raeumen.' : 'Reassigning an attendee moves them between active breakout rooms.')}
              </p>
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor, background: isLight ? 'rgba(255,255,255,0.66)' : 'rgba(0,0,0,0.18)' }}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: textMuted }}>
                {isGerman ? 'Breakout starten' : 'Start Breakout'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  aria-label={isGerman ? 'Breakout-Start-Countdown Sekunden' : 'Breakout Start Countdown Seconds'}
                  type="number"
                  min={0}
                  max={300}
                  value={countdownInput}
                  onChange={(event) => setCountdownInput(event.target.value)}
                  className="w-36 rounded-xl border px-3 py-2 text-sm font-semibold"
                  style={{ borderColor, background: isLight ? '#fff' : 'rgba(15,23,42,0.78)', color: textPrimary }}
                />
                <button
                  type="button"
                  onClick={() => { void handleStartBreakout(); }}
                  disabled={busy}
                  className="rounded-xl px-3 py-2 text-xs font-bold"
                  style={{ border: `1px solid ${borderColor}`, background: isLight ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.25)', color: isLight ? '#92400e' : '#fcd34d' }}
                >
                  {isGerman ? 'Countdown starten' : 'Start Countdown'}
                </button>
              </div>
              <p className="mt-2 text-xs" style={{ color: textMuted }}>
                {session.status === 'countdown'
                  ? (isGerman ? `Breakout startet in ${session.secondsRemaining}s.` : `Breakout starts in ${session.secondsRemaining}s.`)
                  : session.status === 'active'
                    ? (isGerman ? 'Breakout ist jetzt aktiv.' : 'Breakout is active now.')
                    : (isGerman ? 'Mit 0 Sekunden startet es sofort.' : 'Use 0 seconds to start immediately.')}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border p-4" style={{ borderColor, background: isLight ? 'rgba(255,255,255,0.66)' : 'rgba(0,0,0,0.18)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: textMuted }}>
                  {isGerman ? 'Sammelverschiebung' : 'Batch Move'}
                </p>
                <p className="mt-1 text-xs" style={{ color: textMuted }}>
                  {isGerman ? 'Waehle Teilnehmer aus den Raumlisten aus und verschiebe sie gemeinsam, ohne Einzelzuweisungen zu wiederholen.' : 'Select attendees from room rosters, then move them together without repeating single-person assignments.'}
                </p>
              </div>
              <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ border: `1px solid ${borderColor}`, background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(15,23,42,0.68)', color: textPrimary }}>
                {selectedBatchAssignments.length} {isGerman ? 'ausgewaehlt' : 'selected'}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <select
                aria-label={isGerman ? 'Zielraum fuer Sammelverschiebung' : 'Batch Move Target Room'}
                value={batchTargetRoomId}
                onChange={(event) => setBatchTargetRoomId(event.target.value)}
                className="rounded-xl border px-3 py-2 text-sm font-semibold"
                style={{ borderColor, background: isLight ? '#fff' : 'rgba(15,23,42,0.78)', color: textPrimary }}
              >
                <option value="">{isGerman ? 'Zielraum auswaehlen' : 'Select destination room'}</option>
                {openRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => { void handleBatchMove(); }}
                disabled={busy || !selectedBatchAssignments.length || !batchTargetRoomId || session.status === 'countdown'}
                className="rounded-xl px-4 py-2 text-xs font-bold"
                style={{ border: `1px solid ${borderColor}`, background: isLight ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.2)', color: isLight ? '#166534' : '#86efac' }}
              >
                {isGerman ? 'Ausgewaehlte verschieben' : 'Move Selected'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedBatchParticipantIds([])}
                disabled={busy || !selectedBatchAssignments.length}
                className="rounded-xl px-4 py-2 text-xs font-bold"
                style={{ border: `1px solid ${borderColor}`, background: isLight ? 'rgba(148,163,184,0.12)' : 'rgba(51,65,85,0.42)', color: textMuted }}
              >
                {isGerman ? 'Auswahl loeschen' : 'Clear Selection'}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border p-4" style={{ borderColor, background: isLight ? 'rgba(255,255,255,0.66)' : 'rgba(0,0,0,0.18)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: textMuted }}>
                {isGerman ? 'Raumanfragen' : 'Room Requests'}
              </p>
              <span className="text-xs font-semibold" style={{ color: textMuted }}>
                {session.helpRequests.length} {isGerman ? 'aktiv' : 'active'}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {session.helpRequests.length ? session.helpRequests.map((request) => (
                <div key={request.participantId} className="rounded-xl border px-3 py-3 text-xs" style={{ borderColor, background: isLight ? 'rgba(248,250,252,0.92)' : 'rgba(15,23,42,0.72)', color: textPrimary }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-bold">{request.participantName}</div>
                      <div style={{ color: textMuted }}>{request.roomName}</div>
                    </div>
                    <div className="text-[11px] font-semibold" style={{ color: isLight ? '#92400e' : '#fcd34d' }}>
                      {request.kind === 'merge'
                        ? (isGerman ? 'Merge angefragt ' : 'Merge requested ')
                        : (isGerman ? 'Hilfe angefragt ' : 'Help requested ')}
                      {new Date(request.requestedAt).toLocaleTimeString(locale)}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={buildBreakoutJoinHref(meetingId, session.sessionId, request.roomId)}
                      className="rounded-xl px-3 py-2 text-[11px] font-bold"
                      style={{ border: `1px solid ${borderColor}`, background: isLight ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.2)', color: isLight ? '#1d4ed8' : '#93c5fd' }}
                    >
                      {isGerman ? 'Angefragten Raum betreten' : 'Join Requested Room'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        if (request.kind === 'merge') {
                          void handleMergeRoom(request.roomId, request.roomName);
                          return;
                        }
                        void handleResolveHelpRequest(request.participantId, request.participantName);
                      }}
                      disabled={busy}
                      className="rounded-xl px-3 py-2 text-[11px] font-bold"
                      style={{ border: `1px solid ${borderColor}`, background: isLight ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.2)', color: isLight ? '#065f46' : '#6ee7b7' }}
                    >
                      {request.kind === 'merge'
                        ? (isGerman ? 'Raum zusammenfuehren' : 'Merge Room')
                        : (isGerman ? 'Anfrage erledigen' : 'Resolve Request')}
                    </button>
                  </div>
                </div>
              )) : (
                <p className="text-xs" style={{ color: textMuted }}>
                  {isGerman ? 'Aktuell wartet kein Teilnehmer auf Host-Aktion.' : 'No attendees are waiting for a host action right now.'}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {session.rooms.map((room) => (
              <div key={room.id} className="rounded-2xl border p-4" style={{ borderColor, background: isLight ? 'rgba(255,255,255,0.66)' : 'rgba(0,0,0,0.18)' }}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black" style={{ color: textPrimary }}>{room.name}</p>
                    <p className="mt-1 text-xs" style={{ color: textMuted }}>
                      {room.status === 'closing'
                        ? `Merging back in ${room.secondsUntilMerge}s`
                        : room.status === 'merged'
                          ? 'Merged back to main room'
                          : 'Open for breakout discussion'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {room.participants.length ? (
                      <button
                        type="button"
                        onClick={() => toggleRoomSelection(room.participants.map((participant) => participant.participantId))}
                        disabled={busy}
                        className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                        style={{
                          border: `1px solid ${borderColor}`,
                          background: isLight ? 'rgba(224,231,255,0.82)' : 'rgba(49,46,129,0.28)',
                          color: isLight ? '#4338ca' : '#c7d2fe',
                        }}
                    >
                        {isGerman ? 'Raum waehlen' : 'Select Room'}
                      </button>
                    ) : null}
                    <span
                      className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                      style={{
                        border: `1px solid ${borderColor}`,
                        background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(15,23,42,0.68)',
                        color: room.status === 'closing'
                          ? '#f59e0b'
                          : room.status === 'merged'
                            ? '#64748b'
                            : '#10b981',
                      }}
                    >
                      {room.status}
                    </span>
                    <span className="text-xs font-bold" style={{ color: textMuted }}>
                      {room.participantCount} {isGerman ? 'zugewiesen' : 'assigned'}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {room.status !== 'merged' ? (
                    <Link
                      href={buildBreakoutJoinHref(meetingId, session.sessionId, room.id)}
                      className="rounded-xl px-3 py-2 text-xs font-bold"
                      style={{ border: `1px solid ${borderColor}`, background: isLight ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.2)', color: isLight ? '#1d4ed8' : '#93c5fd' }}
                    >
                      {isGerman ? 'Als Host beitreten' : 'Join As Host'}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => { void handleMergeRoom(room.id, room.name); }}
                    disabled={busy || room.status === 'merged'}
                    className="rounded-xl px-3 py-2 text-xs font-bold"
                    style={{ border: `1px solid ${borderColor}`, background: isLight ? 'rgba(244,114,182,0.12)' : 'rgba(244,114,182,0.2)', color: isLight ? '#9d174d' : '#f9a8d4' }}
                  >
                    {room.status === 'closing'
                      ? (isGerman ? 'Merge neu planen' : 'Reschedule Merge')
                      : (isGerman ? 'Diesen Raum zusammenfuehren' : 'Merge This Room')}
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {room.participants.length ? room.participants.map((participant) => (
                    <div key={participant.participantId} className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor, background: isLight ? 'rgba(248,250,252,0.92)' : 'rgba(15,23,42,0.72)', color: textPrimary }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold">{participant.participantName}</div>
                          <div style={{ color: textMuted }}>{participant.participantRole}</div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-[11px] font-semibold" style={{ color: textMuted }}>
                          <input
                            aria-label={`Select ${participant.participantName}`}
                            type="checkbox"
                            checked={selectedBatchParticipantIds.includes(participant.participantId)}
                            onChange={() => toggleBatchParticipantSelection(participant.participantId)}
                          />
                          {isGerman ? 'Waehlen' : 'Select'}
                        </label>
                      </div>
                    </div>
                  )) : (
                    <p className="text-xs" style={{ color: textMuted }}>
                      {isGerman ? 'Noch keine Zuweisungen.' : 'No assignments yet.'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm" style={{ color: textMuted }}>
          {isGerman ? 'Kein aktives Breakout-Set. Erstelle eines, um den Raum aufzuteilen.' : 'No active breakout set. Create one to split the room.'}
        </p>
      )}
    </section>
  );
}
