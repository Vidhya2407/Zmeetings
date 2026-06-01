'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useMeetingCarbonRoom } from '../../../hooks/useMeetingCarbonRoom';
import { fetchJsonWithRetry } from '@/lib/api/fetchJsonWithRetry';
import {
  type MeetingMediaState,
  type MeetingParticipantNetworkDetails,
} from '../../../lib/meetings/carbonCalc';
import { useThemeStore } from '../../../lib/stores/themeStore';
import { DEMO_MEETING_ROOM_ID } from '@/lib/meetings/config';
import BreakoutHostPanel from '../../../components/meetings/BreakoutHostPanel';
import { useAppTranslations } from '@/lib/utils/translations';
import type { Meeting } from '../../../types/domain/workspace';

export const dynamic = 'force-dynamic';

type StageParticipant = {
  id: string;
  name: string;
  role: string;
  initials: string;
  bg: string;
  media: MeetingMediaState;
};

const INITIAL_STAGE_PARTICIPANTS: StageParticipant[] = [
  { id: 'host-1', name: 'Rajesh K.', role: 'Moderator', initials: 'RK', bg: 'linear-gradient(135deg,#001a12,#003d28)', media: { camera: true, microphone: true, screenShare: false } },
  { id: 'guest-1', name: 'Sarah M.', role: 'Guest Speaker', initials: 'SM', bg: 'linear-gradient(135deg,#001228,#002d60)', media: { camera: true, microphone: true, screenShare: true } },
  { id: 'guest-2', name: 'Tim B.', role: 'Finance Lead', initials: 'TB', bg: 'linear-gradient(135deg,#180028,#3d006a)', media: { camera: false, microphone: true, screenShare: false } },
  { id: 'guest-3', name: 'Priya S.', role: 'Operations', initials: 'PS', bg: 'linear-gradient(135deg,#1a1400,#3d3000)', media: { camera: true, microphone: false, screenShare: false } },
  { id: 'guest-4', name: 'Klaus W.', role: 'Board', initials: 'KW', bg: 'linear-gradient(135deg,#001818,#003d3d)', media: { camera: true, microphone: true, screenShare: false } },
  { id: 'guest-5', name: 'Anna L.', role: 'Legal', initials: 'AL', bg: 'linear-gradient(135deg,#180000,#400008)', media: { camera: false, microphone: false, screenShare: false } },
  { id: 'guest-6', name: 'Marco R.', role: 'Partner', initials: 'MR', bg: 'linear-gradient(135deg,#001a10,#004228)', media: { camera: true, microphone: true, screenShare: false } },
  { id: 'guest-7', name: 'Lena F.', role: 'Product', initials: 'LF', bg: 'linear-gradient(135deg,#0a0018,#240040)', media: { camera: false, microphone: true, screenShare: true } },
];

export default function MeetingsHostPage() {
  return (
    <Suspense fallback={<MeetingsHostFallback />}>
      <MeetingsHostPageContent />
    </Suspense>
  );
}

function MeetingsHostPageContent() {
  const searchParams = useSearchParams();
  const { isGerman } = useAppTranslations();
  const { data: session, status: sessionStatus } = useSession();
  const { theme } = useThemeStore();
  const isLight = theme === 'light';
  const activeMeetingId = searchParams.get('meetingId')?.trim() || DEMO_MEETING_ROOM_ID;
  const locale = isGerman ? 'de-DE' : 'en-US';
  const isAuthenticated = sessionStatus === 'authenticated';

  const [meetingEnded, setMeetingEnded] = useState(false);
  const [openStageMenu, setOpenStageMenu] = useState<'room' | 'preview' | null>(null);
  const [bannerMessage, setBannerMessage] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);
  const [stagePresentationMode, setStagePresentationMode] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [meetingMeta, setMeetingMeta] = useState<Meeting | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const nativeStageFullscreenSeenRef = useRef(false);
  const stageSectionRef = useRef<HTMLElement | null>(null);
  const hostParticipantId = isAuthenticated ? (session?.user?.id ?? 'host-self') : '';
  const hostParticipantName = session?.user?.name?.trim() || 'Host';
  const initialRoomParticipants = useMemo(
    () => [] as Array<{ id: string; displayName: string; role: string; media: MeetingMediaState }>,
    [],
  );
  const hostAutoJoinParticipant = useMemo(() => (
    {
      id: hostParticipantId,
      displayName: hostParticipantName,
      role: 'Moderator',
      media: { camera: true, microphone: true, screenShare: false },
    }
  ), [hostParticipantId, hostParticipantName]);
  const {
    admitWaitingParticipant,
    isSyncing,
    participantJoined,
    participants,
    recordingEnabled,
    removeParticipant,
    roomLocked,
    roomId,
    setRoomFeature,
    setRoomLock,
    syncError,
    syncedAt,
    transcriptEnabled,
    syncRoomNow,
    unauthorized,
    updateAllMediaState,
    updateMediaState,
    waitingParticipants,
  } = useMeetingCarbonRoom({
    autoJoinParticipant: hostParticipantId ? hostAutoJoinParticipant : undefined,
    enabled: isAuthenticated,
    roomId: activeMeetingId,
    initialParticipants: initialRoomParticipants,
  });
  const withMeetingId = (path: string) => `${path}?meetingId=${encodeURIComponent(activeMeetingId)}`;

  const pageBg = isLight ? 'linear-gradient(135deg, #eef4f8 0%, #e8eff7 55%, #f6fbff 100%)' : '#07111f';
  const textPrimary = isLight ? '#0f172a' : '#ffffff';
  const textSecondary = isLight ? '#475569' : '#cbd5e1';
  const textMuted = isLight ? '#64748b' : '#94a3b8';
  const shellBg = isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.04)';
  const shellBorder = isLight ? 'rgba(15,23,42,0.09)' : 'rgba(255,255,255,0.10)';
  const darkInset = isLight ? 'rgba(15,23,42,0.04)' : 'rgba(0,0,0,0.20)';
  const badgeBg = isLight ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.05)';
  const stageBg = isLight ? 'linear-gradient(135deg, rgba(222,238,252,0.95), rgba(231,244,247,0.92))' : 'linear-gradient(135deg,rgba(10,20,38,0.92),rgba(9,27,39,0.88))';
  const stageBorder = isLight ? 'rgba(96,165,250,0.18)' : 'rgba(96,165,250,0.20)';
  const isStageExpanded = isStageFullscreen || stagePresentationMode;

  const liveParticipantCount = participants.length;
  const meetingTitle = meetingMeta?.title ?? 'Meeting Session';
  const meetingRoomCode = meetingMeta?.roomCode ?? roomId.toUpperCase();
  const participantUi = useMemo(() => {
    const stageMap = new Map(INITIAL_STAGE_PARTICIPANTS.map((participant) => [participant.id, participant]));
    return participants.map((participant) => {
      const stage = stageMap.get(participant.id);
      return {
        ...participant,
        bg: stage?.bg ?? 'linear-gradient(135deg,#0b2235,#143a52)',
        initials: stage?.initials ?? participant.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2),
      };
    });
  }, [participants]);
  const hostParticipant = participants.find((participant) => participant.id === hostParticipantId);
  const hostMedia = hostParticipant?.media ?? hostAutoJoinParticipant.media;
  const breakoutParticipantSeeds = useMemo(() => (
    participants.map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      role: participant.role,
    }))
  ), [participants]);
  const joineeNetworkParticipants = useMemo(
    () => participants.filter((participant) => participant.id !== hostParticipantId),
    [hostParticipantId, participants],
  );
  const syncStatusText = syncError ? syncError : isSyncing ? (isGerman ? 'Raum wird synchronisiert...' : 'Syncing room...') : syncedAt ? `${isGerman ? 'Synchronisiert' : 'Synced'} ${syncedAt.toLocaleTimeString(locale)}` : (isGerman ? 'Warten auf Raumsynchronisierung' : 'Waiting for room sync');

  useEffect(() => {
    let cancelled = false;

    const loadMeetingMeta = async () => {
      if (!isAuthenticated) {
        setMeetingMeta(null);
        setSessionExpired(sessionStatus !== 'loading');
        return;
      }

      try {
        const response = await fetchJsonWithRetry<{ meeting: Meeting }>(`/api/meetings/${encodeURIComponent(activeMeetingId)}`, { cache: 'no-store' });
        if (response.unauthorized) {
          if (!cancelled) {
            setSessionExpired(true);
          }
          return;
        }
        if (!cancelled && response.ok && response.data?.meeting) {
          setMeetingMeta(response.data.meeting);
          setMeetingEnded(response.data.meeting.status === 'ended');
          setSessionExpired(false);
          return;
        }
      } catch {
        // Keep fallback labels from meetingId when meeting metadata fails.
      }

      if (!cancelled) {
        setMeetingMeta(null);
      }
    };

    void loadMeetingMeta();
    return () => {
      cancelled = true;
    };
  }, [activeMeetingId, isAuthenticated, sessionStatus]);

  useEffect(() => {
    if (unauthorized) {
      setSessionExpired(true);
    }
  }, [unauthorized]);

  useEffect(() => () => {
    if (bannerTimerRef.current) {
      window.clearTimeout(bannerTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const nativeStageFullscreen = document.fullscreenElement === stageSectionRef.current;
      if (nativeStageFullscreen) {
        nativeStageFullscreenSeenRef.current = true;
      } else if (nativeStageFullscreenSeenRef.current && !document.fullscreenElement) {
        nativeStageFullscreenSeenRef.current = false;
        setStagePresentationMode(false);
      }
      setIsStageFullscreen(nativeStageFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!stagePresentationMode) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStagePresentationMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [stagePresentationMode]);

  const setFlashMessage = (message: string) => {
    setBannerMessage(message);
    if (bannerTimerRef.current) {
      window.clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setBannerMessage('');
    }, 2600);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: isGerman ? 'Meeting verwalten' : 'Manage Meeting', text: isGerman ? 'Host-Ansicht oeffnen' : 'Open the host controls', url });
        setFlashMessage(isGerman ? 'Teilen-Dialog geoeffnet.' : 'Share sheet opened.');
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setFlashMessage(isGerman ? 'Link zur Host-Seite kopiert.' : 'Host page link copied.');
        window.setTimeout(() => setShareCopied(false), 1800);
        return;
      }
    } catch {
      setFlashMessage(isGerman ? 'Teilen wurde abgebrochen.' : 'Share was cancelled.');
      return;
    }
    setFlashMessage(isGerman ? 'Teilen ist in diesem Browser nicht verfuegbar.' : 'Sharing is not available in this browser.');
  };

  const copyAttendeeInvite = async () => {
    const url = `${window.location.origin}/meetings/attendee?meetingId=${encodeURIComponent(activeMeetingId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setFlashMessage(isGerman ? 'Einladungslink kopiert.' : 'Invite link copied.');
    } catch {
      setFlashMessage(isGerman ? 'Einladungslink konnte nicht kopiert werden.' : 'Unable to copy invite link.');
    }
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(meetingRoomCode);
      setFlashMessage(isGerman ? 'Raumcode kopiert.' : 'Room code copied.');
    } catch {
      setFlashMessage(isGerman ? 'Raumcode konnte nicht kopiert werden.' : 'Unable to copy room code.');
    }
  };

  const handleSyncNow = async () => {
    setFlashMessage(isGerman ? 'Raum wird synchronisiert...' : 'Syncing room...');
    const updatedRoom = await syncRoomNow();
    setFlashMessage(updatedRoom ? (isGerman ? 'Raumsteuerung synchronisiert.' : 'Room controls synced.') : (isGerman ? 'Raum konnte nicht synchronisiert werden.' : 'Unable to sync room.'));
  };

  const toggleStageFullscreen = async () => {
    try {
      if (isStageFullscreen && document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (stagePresentationMode) {
        setStagePresentationMode(false);
        return;
      }

      const stageElement = stageSectionRef.current;
      setStagePresentationMode(true);
      setFlashMessage(isGerman ? 'Buehne im Vollbildmodus geoeffnet.' : 'Stage opened in full-screen layout.');

      if (stageElement && document.fullscreenEnabled && stageElement.requestFullscreen) {
        void stageElement.requestFullscreen().catch(() => undefined);
        return;
      }
    } catch {
      setFlashMessage(isGerman ? 'Vollbild ist in diesem Browser nicht verfuegbar.' : 'Full screen is not available in this browser.');
    }
  };

  const ensureHostParticipantReady = async () => {
    if (!hostParticipantId) {
      return null;
    }
    const existingHost = participants.find((participant) => participant.id === hostParticipantId);
    if (existingHost) return existingHost;

    const joinedRoom = await participantJoined(hostAutoJoinParticipant);
    if (!joinedRoom) return null;
    return joinedRoom.participants.find((participant) => participant.id === hostParticipantId) ?? null;
  };

  const toggleHostMedia = async (field: 'camera' | 'microphone' | 'screenShare') => {
    const resolvedHost = await ensureHostParticipantReady();
    if (!resolvedHost) {
      setFlashMessage('Host controls are syncing. Please try again.');
      return;
    }

    const nextValue = !resolvedHost.media[field];
    const updatedRoom = await updateMediaState(hostParticipantId, field, nextValue);
    if (!updatedRoom) {
      setFlashMessage('Unable to update host controls right now.');
      return;
    }

    if (field === 'microphone') {
      setFlashMessage(nextValue ? 'Host microphone enabled.' : 'Host microphone muted.');
      return;
    }
    if (field === 'camera') {
      setFlashMessage(nextValue ? 'Host camera turned on.' : 'Host camera turned off.');
      return;
    }
    setFlashMessage(nextValue ? 'Host screen share started.' : 'Host screen share stopped.');
  };

  const toggleParticipantMedia = async (
    participantId: string,
    field: keyof MeetingMediaState,
    current: boolean,
    participantName: string,
  ) => {
    const nextValue = !current;
    const updatedRoom = await updateMediaState(participantId, field, nextValue);
    if (!updatedRoom) {
      setFlashMessage(`Unable to update ${participantName}.`);
      return;
    }
    const controlName = field === 'camera' ? 'camera' : field === 'microphone' ? 'microphone' : 'screen share';
    setFlashMessage(`${participantName} ${controlName} ${nextValue ? 'enabled' : 'disabled'}.`);
  };

  const toggleRoomLock = async () => {
    setOpenStageMenu(null);
    const payload = await setRoomLock(!roomLocked);
    if (!payload) {
      setFlashMessage('Unable to update waiting room lock.');
      return;
    }
    setFlashMessage(payload.roomLocked ? 'Waiting room locked.' : 'Waiting room unlocked.');
  };

  const turnAllParticipantCamerasOff = async () => {
    setOpenStageMenu(null);
    setFlashMessage(isGerman ? 'Kamera-aus-Befehl wird angewendet...' : 'Applying camera-off command...');
    const updatedRoom = await updateAllMediaState('camera', false);
    setFlashMessage(updatedRoom ? (isGerman ? 'Alle Teilnehmerkameras wurden ausgeschaltet.' : 'All participant cameras turned off.') : (isGerman ? 'Alle Kameras konnten nicht ausgeschaltet werden.' : 'Unable to turn off all cameras.'));
  };

  const muteAllParticipants = async () => {
    setOpenStageMenu(null);
    setFlashMessage(isGerman ? 'Alle-stumm-Befehl wird angewendet...' : 'Applying mute-all command...');
    const updatedRoom = await updateAllMediaState('microphone', false);
    setFlashMessage(updatedRoom ? (isGerman ? 'Alle Teilnehmermikrofone wurden stummgeschaltet.' : 'All participant microphones muted.') : (isGerman ? 'Alle Mikrofone konnten nicht stummgeschaltet werden.' : 'Unable to mute all microphones.'));
  };

  const togglePreviewRecording = () => {
    setOpenStageMenu(null);
    void (async () => {
      const next = !recordingEnabled;
      setFlashMessage(next ? (isGerman ? 'Aufzeichnung wird gestartet...' : 'Starting recording state...') : (isGerman ? 'Aufzeichnung wird gestoppt...' : 'Stopping recording state...'));
      const updatedRoom = await setRoomFeature('recordingEnabled', next);
      setFlashMessage(updatedRoom ? (next ? (isGerman ? 'Aufzeichnung ist aktiv.' : 'Recording is on.') : (isGerman ? 'Aufzeichnung ist aus.' : 'Recording is off.')) : (isGerman ? 'Aufzeichnung konnte nicht aktualisiert werden.' : 'Unable to update recording.'));
    })();
  };

  const togglePreviewTranscript = () => {
    setOpenStageMenu(null);
    void (async () => {
      const next = !transcriptEnabled;
      setFlashMessage(next ? (isGerman ? 'Transkript wird gestartet...' : 'Starting transcript state...') : (isGerman ? 'Transkript wird gestoppt...' : 'Stopping transcript state...'));
      const updatedRoom = await setRoomFeature('transcriptEnabled', next);
      setFlashMessage(updatedRoom ? (next ? (isGerman ? 'Transkript ist aktiv.' : 'Transcript is on.') : (isGerman ? 'Transkript ist aus.' : 'Transcript is off.')) : (isGerman ? 'Transkript konnte nicht aktualisiert werden.' : 'Unable to update transcript.'));
    })();
  };

  const endMeetingPreview = () => {
    setOpenStageMenu(null);
    void (async () => {
      setFlashMessage(isGerman ? 'Meeting wird beendet...' : 'Ending meeting...');
      const response = await fetchJsonWithRetry<{ meeting: Meeting }>(
        `/api/meetings/${encodeURIComponent(activeMeetingId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ended' }),
        },
      );

      if (response.unauthorized) {
        setSessionExpired(true);
        setFlashMessage(isGerman ? 'Bitte melde dich erneut an.' : 'Please sign in again.');
        return;
      }

      if (!response.ok || !response.data?.meeting) {
        setFlashMessage(response.error ?? (isGerman ? 'Meeting konnte nicht beendet werden.' : 'Unable to end meeting.'));
        return;
      }

      setMeetingMeta(response.data.meeting);
      setMeetingEnded(true);
      setFlashMessage(isGerman ? 'Meeting beendet.' : 'Meeting ended.');
    })();
  };

  const admitQueuedParticipant = async (participantId: string, displayName: string) => {
    const payload = await admitWaitingParticipant(participantId);
    if (!payload) {
      setFlashMessage(`Unable to admit ${displayName}.`);
      return;
    }
    setFlashMessage(`${displayName} admitted from live waiting queue.`);
  };

  const removeQueuedParticipant = async (participantId: string, displayName: string) => {
    const payload = await removeParticipant(participantId);
    if (!payload) {
      setFlashMessage(`Unable to remove ${displayName}.`);
      return;
    }
    setFlashMessage(`${displayName} removed from room queue.`);
  };

  if (sessionStatus === 'loading') {
    return <MeetingsHostFallback />;
  }

  if (!isAuthenticated) {
    return (
      <HostAuthRequired
        isGerman={isGerman}
        isLight={isLight}
        meetingId={activeMeetingId}
      />
    );
  }

  return (
    <main className="min-h-screen relative overflow-hidden" style={{ background: pageBg, color: textPrimary }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div className="absolute -top-20 right-[-5%] h-[26rem] w-[26rem] rounded-full blur-3xl" style={{ background: isLight ? 'rgba(0,128,255,0.10)' : 'rgba(0,128,255,0.14)' }} animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 11, repeat: Infinity }} />
        <motion.div className="absolute bottom-[-8%] left-[-8%] h-[24rem] w-[24rem] rounded-full blur-3xl" style={{ background: isLight ? 'rgba(0,229,186,0.10)' : 'rgba(0,229,186,0.12)' }} animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 9, repeat: Infinity }} />
        <div className="absolute inset-0" style={{ background: isLight ? 'radial-gradient(circle at top, rgba(255,255,255,0.55), transparent 45%)' : 'radial-gradient(circle at top, rgba(255,255,255,0.04), transparent 45%)' }} />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-10 lg:px-10">
        {(syncError || isSyncing) ? (
          <div
            className="mb-6 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: isLight ? 'rgba(220,38,38,0.24)' : 'rgba(248,113,113,0.35)',
              background: isLight ? 'rgba(254,242,242,0.9)' : 'rgba(127,29,29,0.32)',
              color: isLight ? '#7f1d1d' : '#fecaca',
            }}
          >
            <span>{syncError ?? (isGerman ? 'Host-Steuerung wird synchronisiert...' : 'Syncing host controls...')}</span>
            {sessionExpired ? (
              <Link
                href={`/login?next=${encodeURIComponent(`/meetings/host?meetingId=${activeMeetingId}`)}`}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  borderColor: isLight ? 'rgba(220,38,38,0.28)' : 'rgba(248,113,113,0.40)',
                  background: isLight ? 'rgba(255,255,255,0.84)' : 'rgba(255,255,255,0.08)',
                  color: isLight ? '#991b1b' : '#fee2e2',
                }}
              >
                {isGerman ? 'Anmelden' : 'Sign in'}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => { void syncRoomNow(); }}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  borderColor: isLight ? 'rgba(220,38,38,0.28)' : 'rgba(248,113,113,0.40)',
                  background: isLight ? 'rgba(255,255,255,0.84)' : 'rgba(255,255,255,0.08)',
                  color: isLight ? '#991b1b' : '#fee2e2',
                }}
              >
                {isGerman ? 'Erneut versuchen' : 'Retry'}
              </button>
            )}
          </div>
        ) : null}

        {bannerMessage ? (
          <div className="mb-6 rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)', border: `1px solid ${shellBorder}`, color: textPrimary }}>
            {bannerMessage}
          </div>
        ) : null}

        {meetingEnded ? (
          <div className="mb-6 rounded-[28px] p-6" style={{ background: isLight ? 'rgba(255,255,255,0.84)' : 'rgba(7,17,31,0.86)', border: `1px solid ${shellBorder}` }}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: textMuted }}>{isGerman ? 'Meeting beendet' : 'Meeting ended'}</div>
                <h2 className="mt-2 text-2xl font-black" style={{ color: textPrimary }}>{isGerman ? 'Dieser Host-Raum ist geschlossen' : 'This host room is closed'}</h2>
                <p className="mt-2 text-sm" style={{ color: textSecondary }}>{isGerman ? 'Das Meeting wurde beendet. Du kannst zum Meetings-Hub zurueckkehren.' : 'The meeting has ended. You can return to the meetings hub.'}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={withMeetingId('/meet')} className="rounded-2xl px-4 py-3 text-sm font-bold text-eco-green" style={{ border: '1px solid rgba(0,229,186,0.2)', background: 'rgba(0,229,186,0.10)' }}>{isGerman ? 'Zurueck zu Meetings' : 'Back to meetings'}</Link>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: isLight ? 'rgba(37,99,235,0.82)' : 'rgba(147,197,253,0.8)' }}>{isGerman ? 'Meeting verwalten' : 'Manage Meeting'}</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight" style={{ color: textPrimary }}>{isGerman ? 'Den Raum sicher steuern' : 'Run The Room With Confidence'}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: textSecondary }}>{isGerman ? 'Steuere Live-Buehne, Teilnehmerzugang, Medien, Warteschlange und Breakout-Raeume in einer Host-Ansicht.' : 'Control the live stage, attendee access, participant media, waiting queue, and breakout rooms from one host view.'}</p>
          </div>
          <div
            className="w-full max-w-md rounded-[24px] p-4"
            style={{ border: `1px solid ${shellBorder}`, background: shellBg }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: textMuted }}>
                  {isGerman ? 'Aktuelle Ansicht' : 'Current View'}
                </div>
                <div className="mt-2 text-lg font-black" style={{ color: textPrimary }}>
                  {isGerman ? 'Host Studio' : 'Host Studio'}
                </div>
                <p className="mt-1 text-xs leading-5" style={{ color: textSecondary }}>
                  {isGerman ? 'Moderatorsteuerung fuer diesen Meetingraum.' : 'Moderator controls for this meeting room.'}
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                style={{ background: isLight ? 'rgba(37,99,235,0.12)' : 'rgba(96,165,250,0.16)', color: isLight ? '#1d4ed8' : '#93c5fd' }}
              >
                {isGerman ? 'Host' : 'Host'}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={withMeetingId('/meet')}
                className="rounded-2xl px-3 py-2 text-xs font-bold"
                style={{ border: `1px solid ${shellBorder}`, background: badgeBg, color: textPrimary }}
              >
                {isGerman ? 'Meetings-Hub' : 'Meetings Hub'}
              </Link>
              <Link
                href={`/meetings/live?meetingId=${encodeURIComponent(activeMeetingId)}`}
                className="rounded-2xl px-3 py-2 text-xs font-bold"
                style={{
                  border: isLight ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(96,165,250,0.28)',
                  background: isLight ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.16)',
                  color: isLight ? '#1d4ed8' : '#93c5fd',
                }}
              >
                {isGerman ? 'Live-Raum' : 'Live Room'}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: isGerman ? 'Teilnehmer live' : 'Participants live', value: String(liveParticipantCount).padStart(2, '0'), tone: 'rgb(0,229,186)' },
            { label: isGerman ? 'Warteschlange' : 'Waiting queue', value: String(waitingParticipants.length).padStart(2, '0'), tone: 'rgb(96,165,250)' },
            { label: isGerman ? 'Raumstatus' : 'Room status', value: roomLocked ? (isGerman ? 'Gesperrt' : 'Locked') : (isGerman ? 'Offen' : 'Open'), tone: roomLocked ? 'rgb(248,113,113)' : 'rgb(52,211,153)' },
            { label: isGerman ? 'Aufzeichnung' : 'Recording', value: recordingEnabled ? (isGerman ? 'An' : 'On') : (isGerman ? 'Aus' : 'Off'), tone: recordingEnabled ? 'rgb(248,113,113)' : 'rgb(148,163,184)' },
          ].map((metric, index) => (
            <motion.div key={metric.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-[28px] p-5 backdrop-blur-xl" style={{ border: `1px solid ${shellBorder}`, background: shellBg }}>
              <div className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: textMuted }}>{metric.label}</div>
              <div className="mt-3 text-2xl font-black" style={{ color: metric.tone }}>{metric.value}</div>
            </motion.div>
          ))}
        </div>

        <section className="mt-8 rounded-[28px] p-5 md:p-6" style={{ border: `1px solid ${shellBorder}`, background: shellBg }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-eco-green">{isGerman ? 'Live-Meeting-Kopfzeile' : 'Live Meeting Header'}</div>
              <h2 className="mt-2 text-2xl font-black" style={{ color: textPrimary }}>{meetingTitle}</h2>
              <p className="mt-2 text-sm" style={{ color: textSecondary }}>{isGerman ? 'Raum' : 'Room'} {meetingRoomCode} | {liveParticipantCount} {isGerman ? 'Teilnehmer' : 'participants'} | {roomLocked ? (isGerman ? 'Gesperrt' : 'Locked') : (isGerman ? 'Offen' : 'Open')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold" style={{ color: syncError ? '#dc2626' : textMuted }}>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: roomLocked ? 'rgb(248,113,113)' : 'rgb(0,229,186)' }}
                  />
                  {roomLocked ? (isGerman ? 'Warteraum gesperrt' : 'Waiting room locked') : (isGerman ? 'Warteraum offen' : 'Waiting room open')}
                </span>
                <span aria-hidden="true" style={{ color: textMuted }}>|</span>
                <span>{syncStatusText}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => { void copyRoomCode(); }} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold" style={{ border: `1px solid ${shellBorder}`, background: badgeBg, color: textPrimary }}>
                <CodeIcon />
                {isGerman ? 'Raumcode kopieren' : 'Copy room code'}
              </button>
              <button type="button" onClick={() => { void copyAttendeeInvite(); }} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold" style={{ border: `1px solid ${shellBorder}`, background: badgeBg, color: textPrimary }}>
                <InviteIcon />
                {isGerman ? 'Einladen' : 'Invite'}
              </button>
              <Link href={`/meetings/live?meetingId=${encodeURIComponent(activeMeetingId)}`} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold" style={{ border: '1px solid rgba(59,130,246,0.28)', background: isLight ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.16)', color: isLight ? '#1d4ed8' : '#93c5fd' }}>
                <LiveRoomIcon />
                {isGerman ? 'Live-Raum betreten' : 'Enter Live Room'}
              </Link>
              <button type="button" onClick={() => { void handleSyncNow(); }} disabled={isSyncing} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold" style={{ border: `1px solid ${shellBorder}`, background: badgeBg, color: textPrimary, opacity: isSyncing ? 0.62 : 1 }}>
                <SyncIcon />
                {isSyncing ? (isGerman ? 'Sync...' : 'Syncing...') : (isGerman ? 'Sync' : 'Sync now')}
              </button>
              <button type="button" onClick={handleShare} className="rounded-2xl px-4 py-2 text-xs font-bold" style={{ border: `1px solid ${shellBorder}`, background: badgeBg, color: textPrimary }}>{shareCopied ? (isGerman ? 'Kopiert' : 'Copied') : (isGerman ? 'Teilen' : 'Share')}</button>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section
            ref={stageSectionRef}
            className={`${isStageExpanded ? 'fixed inset-0 z-50 h-screen overflow-y-auto rounded-none p-4 md:p-6' : 'rounded-[32px] p-6'} shadow-[0_30px_80px_rgba(0,0,0,0.12)]`}
            style={{ border: `1px solid ${stageBorder}`, background: stageBg, opacity: meetingEnded ? 0.62 : 1 }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.26em]" style={{ color: isLight ? 'rgba(30,64,175,0.72)' : 'rgba(191,219,254,0.7)' }}>{isGerman ? 'Host-Buehnenvorschau' : 'Host Stage Preview'}</div>
                <h2 className="mt-2 text-2xl font-black" style={{ color: textPrimary }}>{isGerman ? 'Live-Meeting-Raum' : 'Live Meeting Room'}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black text-eco-green" style={{ border: '1px solid rgba(0,229,186,0.25)', background: 'rgba(0,229,186,0.10)' }}>
                  <span className="h-2 w-2 rounded-full bg-eco-green" />
                  {liveParticipantCount} {isGerman ? 'live' : 'live'}
                </div>
                <button
                  type="button"
                  onClick={() => { void toggleStageFullscreen(); }}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black"
                  style={{ border: `1px solid ${shellBorder}`, background: badgeBg, color: textPrimary }}
                  title={isStageExpanded ? (isGerman ? 'Vollbild verlassen' : 'Exit full screen') : (isGerman ? 'Vollbild oeffnen' : 'Open full screen')}
                >
                  <FullscreenIcon />
                  {isStageExpanded ? (isGerman ? 'Vollbild verlassen' : 'Exit full screen') : (isGerman ? 'Vollbild' : 'Full screen')}
                </button>
              </div>
            </div>

            <div className="relative mt-5 rounded-[26px]" style={{ background: isLight ? 'rgba(15,23,42,0.10)' : '#000', border: `1px solid ${shellBorder}` }}>
              <div className="grid grid-cols-2 gap-[3px] p-[3px] md:grid-cols-4" style={{ background: isLight ? 'rgba(15,23,42,0.18)' : '#000' }}>
                {participantUi.map((participant) => {
                  const isHostTile = participant.id === hostParticipantId;
                  const mediaControls = [
                    { key: 'camera' as const, label: isGerman ? 'Kam' : 'Cam', active: participant.media.camera, tone: 'rgba(96,165,250,0.30)', dot: 'rgb(96,165,250)' },
                    { key: 'microphone' as const, label: isGerman ? 'Mik' : 'Mic', active: participant.media.microphone, tone: 'rgba(0,229,186,0.28)', dot: 'rgb(0,229,186)' },
                    { key: 'screenShare' as const, label: isGerman ? 'Teilen' : 'Share', active: participant.media.screenShare, tone: 'rgba(251,191,36,0.30)', dot: 'rgb(251,191,36)' },
                  ];

                  return (
                    <div key={participant.id} className="relative flex min-h-[140px] items-center justify-center rounded-xl text-2xl font-black tracking-[0.08em] text-white" style={{ background: participant.bg }}>
                      <span>{participant.initials}</span>
                      <div className="absolute left-2 bottom-9 rounded-md bg-black/50 px-2 py-1 text-[9px] font-semibold text-white">{participant.displayName}</div>
                      <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-1">
                        {isHostTile ? (
                          <div
                            className="inline-flex h-6 items-center gap-2 rounded-full bg-black/55 px-2 text-white"
                            title={isGerman ? 'Host-Medien werden unten gesteuert' : 'Host media is controlled below'}
                          >
                            <span className="text-[9px] font-black uppercase tracking-[0.12em]">Host</span>
                            <span className="inline-flex items-center gap-1.5">
                              {mediaControls.map((control) => (
                                <span
                                  aria-label={`${control.label}: ${control.active ? 'on' : 'off'}`}
                                  className="h-2 w-2 rounded-full"
                                  key={control.key}
                                  role="img"
                                  style={{ background: control.active ? control.dot : 'rgba(255,255,255,0.34)' }}
                                  title={`${control.label}: ${control.active ? 'on' : 'off'}`}
                                />
                              ))}
                            </span>
                          </div>
                        ) : (
                          mediaControls.map((control) => (
                            <button
                              key={control.key}
                              onClick={() => {
                                void toggleParticipantMedia(
                                  participant.id,
                                  control.key,
                                  participant.media[control.key],
                                  participant.displayName,
                                );
                              }}
                              className="flex h-6 min-w-10 items-center justify-center rounded-full px-2 text-[9px] font-black text-white"
                              style={{ background: control.active ? control.tone : 'rgba(255,60,82,0.32)' }}
                            >
                              {control.label}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-4"
                style={{ background: isLight ? 'linear-gradient(transparent, rgba(15,23,42,0.08))' : 'linear-gradient(transparent, rgba(0,0,0,0.9))' }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: textMuted }}>
                    {isGerman ? 'Host' : 'Host'}
                  </span>
                  <button onClick={() => { void toggleHostMedia('microphone'); }} className="min-h-11 rounded-2xl px-4 text-xs font-black" style={{ background: hostMedia.microphone ? 'rgba(0,229,186,0.18)' : badgeBg, color: hostMedia.microphone ? 'rgb(0,118,96)' : textPrimary, border: hostMedia.microphone ? '1px solid rgba(0,229,186,0.3)' : `1px solid ${shellBorder}` }}>{hostMedia.microphone ? (isGerman ? 'Mic an' : 'Mic on') : (isGerman ? 'Stumm' : 'Muted')}</button>
                  <button onClick={() => { void toggleHostMedia('camera'); }} className="min-h-11 rounded-2xl px-4 text-xs font-black" style={{ background: hostMedia.camera ? 'rgba(96,165,250,0.18)' : badgeBg, color: hostMedia.camera ? (isLight ? '#1d4ed8' : '#93c5fd') : textPrimary, border: hostMedia.camera ? '1px solid rgba(96,165,250,0.3)' : `1px solid ${shellBorder}` }}>{hostMedia.camera ? (isGerman ? 'Cam an' : 'Cam on') : (isGerman ? 'Cam aus' : 'Cam off')}</button>
                  <button onClick={() => { void toggleHostMedia('screenShare'); }} className="min-h-11 rounded-2xl px-4 text-xs font-black" style={{ background: hostMedia.screenShare ? 'rgba(251,191,36,0.20)' : badgeBg, color: hostMedia.screenShare ? (isLight ? '#92400e' : '#fcd34d') : textPrimary, border: hostMedia.screenShare ? '1px solid rgba(251,191,36,0.30)' : `1px solid ${shellBorder}` }}>{hostMedia.screenShare ? (isGerman ? 'Teilt' : 'Sharing') : (isGerman ? 'Teilen' : 'Share')}</button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <button
                      aria-expanded={openStageMenu === 'room'}
                      onClick={() => setOpenStageMenu((menu) => (menu === 'room' ? null : 'room'))}
                      className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-xs font-black"
                      style={{ border: `1px solid ${shellBorder}`, background: badgeBg, color: textPrimary }}
                      type="button"
                    >
                      {isGerman ? 'Raumsteuerung' : 'Room Controls'}
                      <ChevronDownIcon />
                    </button>
                    {openStageMenu === 'room' ? (
                      <div
                        className="absolute bottom-[calc(100%+0.75rem)] right-0 z-40 w-72 rounded-[22px] p-2 shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
                        style={{ border: `1px solid ${shellBorder}`, background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(15,23,42,0.98)' }}
                      >
                        <div className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: textMuted }}>
                          {isGerman ? 'Wirkt fuer Teilnehmer' : 'Affects attendees'}
                        </div>
                        <MenuActionButton isLight={isLight} label={isGerman ? 'Kameras aus' : 'Cameras off'} onClick={() => { void turnAllParticipantCamerasOff(); }} tone="neutral" />
                        <MenuActionButton isLight={isLight} label={isGerman ? 'Alle stumm' : 'Mute all'} onClick={() => { void muteAllParticipants(); }} tone="neutral" />
                        <MenuActionButton isLight={isLight} label={roomLocked ? (isGerman ? 'Raum entsperren' : 'Unlock room') : (isGerman ? 'Raum sperren' : 'Lock room')} onClick={() => { void toggleRoomLock(); }} tone={roomLocked ? 'danger' : 'success'} />
                      </div>
                    ) : null}
                  </div>

                  <div className="relative">
                    <button
                      aria-expanded={openStageMenu === 'preview'}
                      onClick={() => setOpenStageMenu((menu) => (menu === 'preview' ? null : 'preview'))}
                      className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-xs font-black"
                      style={{ border: `1px solid ${isLight ? 'rgba(245,158,11,0.24)' : 'rgba(251,191,36,0.22)'}`, background: isLight ? 'rgba(255,251,235,0.86)' : 'rgba(120,53,15,0.22)', color: isLight ? '#92400e' : '#fcd34d' }}
                      type="button"
                    >
                      {isGerman ? 'Meeting-Tools' : 'Meeting Tools'}
                      <ChevronDownIcon />
                    </button>
                    {openStageMenu === 'preview' ? (
                      <div
                        className="absolute bottom-[calc(100%+0.75rem)] right-0 z-40 w-72 rounded-[22px] p-2 shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
                        style={{ border: `1px solid ${isLight ? 'rgba(245,158,11,0.24)' : 'rgba(251,191,36,0.22)'}`, background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(15,23,42,0.98)' }}
                      >
                        <div className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: isLight ? '#92400e' : '#fcd34d' }}>
                          {isGerman ? 'Backend-synchronisiert' : 'Synced to room'}
                        </div>
                        <MenuActionButton isLight={isLight} label={recordingEnabled ? (isGerman ? 'Aufzeichnung stoppen' : 'Stop recording') : (isGerman ? 'Aufzeichnung starten' : 'Start recording')} onClick={togglePreviewRecording} tone={recordingEnabled ? 'danger' : 'neutral'} />
                        <MenuActionButton isLight={isLight} label={transcriptEnabled ? (isGerman ? 'Transkript stoppen' : 'Stop transcript') : (isGerman ? 'Transkript starten' : 'Start transcript')} onClick={togglePreviewTranscript} tone="neutral" />
                        <MenuActionButton isLight={isLight} label={isGerman ? 'Meeting beenden' : 'End meeting'} onClick={endMeetingPreview} tone="danger" />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

          </section>

          <div className="grid gap-6">
            <section className="rounded-[32px] p-6 backdrop-blur-xl" style={{ border: `1px solid ${shellBorder}`, background: shellBg }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: textMuted }}>{isGerman ? 'Live-Warteschlange' : 'Live Waiting Queue'}</div>
                  <h2 className="mt-2 text-xl font-black" style={{ color: textPrimary }}>{isGerman ? 'Backend-moderierte Warteschlange' : 'Backend moderated queue'}</h2>
                  <p className="mt-1 text-xs" style={{ color: textSecondary }}>
                    {isGerman ? 'Raum ist aktuell ' : 'Room is currently '}<strong>{roomLocked ? (isGerman ? 'gesperrt' : 'locked') : (isGerman ? 'offen' : 'open')}</strong> | {waitingParticipants.length} {isGerman ? 'wartend' : 'waiting'}
                  </p>
                </div>
                <button onClick={() => { void toggleRoomLock(); }} className="rounded-2xl px-4 py-2 text-xs font-bold" style={{ border: `1px solid ${roomLocked ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.3)'}`, background: roomLocked ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.10)', color: roomLocked ? (isLight ? '#991b1b' : '#fecaca') : (isLight ? '#065f46' : '#6ee7b7') }}>{roomLocked ? (isGerman ? 'Entsperren' : 'Unlock') : (isGerman ? 'Sperren' : 'Lock')}</button>
              </div>
              <div className="mt-5 space-y-3">
                {waitingParticipants.length ? waitingParticipants.map((participant) => (
                  <div key={participant.id} className="rounded-2xl p-4" style={{ border: `1px solid ${shellBorder}`, background: darkInset }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold" style={{ color: textPrimary }}>{participant.displayName}</div>
                        <div className="mt-1 text-xs" style={{ color: textMuted }}>{participant.role}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { void admitQueuedParticipant(participant.id, participant.displayName); }}
                          className="rounded-xl px-3 py-2 text-xs font-bold"
                          style={{
                            background: isLight ? 'rgba(59,130,246,0.12)' : 'rgba(96,165,250,0.16)',
                            color: isLight ? '#1d4ed8' : '#93c5fd',
                            border: isLight ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(96,165,250,0.28)',
                          }}
                        >
                          {isGerman ? 'Zulassen' : 'Admit'}
                        </button>
                        <button
                          onClick={() => { void removeQueuedParticipant(participant.id, participant.displayName); }}
                          className="rounded-xl px-3 py-2 text-xs font-bold"
                          style={{
                            background: isLight ? 'rgba(239,68,68,0.1)' : 'rgba(127,29,29,0.3)',
                            color: isLight ? '#991b1b' : '#fecaca',
                            border: '1px solid rgba(239,68,68,0.32)',
                          }}
                        >
                          {isGerman ? 'Entfernen' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl p-4 text-sm font-semibold" style={{ border: `1px solid ${shellBorder}`, background: darkInset, color: textSecondary }}>
                    {isGerman ? 'Aktuell warten keine Backend-Teilnehmer.' : 'No backend waiting participants right now.'}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[32px] p-6 backdrop-blur-xl" style={{ border: `1px solid ${shellBorder}`, background: shellBg }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: textMuted }}>{isGerman ? 'Teilnehmer-Netzwerk' : 'Participant Network'}</div>
                  <h2 className="mt-2 text-xl font-black" style={{ color: textPrimary }}>{isGerman ? 'Verbindungsstatus' : 'Connection Status'}</h2>
                </div>
                <button onClick={() => { void syncRoomNow(); }} className="rounded-2xl px-4 py-2 text-xs font-bold" style={{ border: `1px solid ${shellBorder}`, background: badgeBg, color: textPrimary }}>{isGerman ? 'Aktualisieren' : 'Refresh'}</button>
              </div>
              <div className="mt-5 space-y-3">
                {joineeNetworkParticipants.length ? joineeNetworkParticipants.map((participant) => {
                  const network = participant.network ?? null;
                  const tone = networkTone(network?.level);
                  return (
                    <div key={participant.id} className="rounded-2xl p-4" style={{ border: `1px solid ${shellBorder}`, background: darkInset }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold" style={{ color: textPrimary }}>{participant.displayName}</div>
                          <div className="mt-1 text-xs" style={{ color: textMuted }}>{participant.role}</div>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ background: network ? `${tone}22` : badgeBg, color: network ? tone : textMuted, border: `1px solid ${network ? `${tone}44` : shellBorder}` }}>
                          <span className="h-2 w-2 rounded-full" style={{ background: network ? tone : textMuted }} />
                          {network ? networkLevelLabel(network.level, isGerman) : (isGerman ? 'Wartet' : 'Waiting')}
                        </div>
                      </div>

                      {network ? (
                        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                          <NetworkDatum label={isGerman ? 'Typ' : 'Type'} value={network.effectiveType?.toUpperCase() ?? '-'} textMuted={textMuted} textPrimary={textPrimary} />
                          <NetworkDatum label={isGerman ? 'Download' : 'Downlink'} value={formatNetworkDownlink(network)} textMuted={textMuted} textPrimary={textPrimary} />
                          <NetworkDatum label={isGerman ? 'Latenz' : 'Latency'} value={formatNetworkRtt(network)} textMuted={textMuted} textPrimary={textPrimary} />
                          <NetworkDatum label={isGerman ? 'Standort' : 'Location'} value={network.locationLabel ?? '-'} textMuted={textMuted} textPrimary={textPrimary} />
                          <NetworkDatum label={isGerman ? 'Status' : 'Status'} value={network.isOnline ? (isGerman ? 'Online' : 'Online') : (isGerman ? 'Offline' : 'Offline')} textMuted={textMuted} textPrimary={textPrimary} />
                          <NetworkDatum label={isGerman ? 'Zuletzt' : 'Updated'} value={formatNetworkUpdated(network, locale)} textMuted={textMuted} textPrimary={textPrimary} />
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl px-3 py-3 text-xs font-semibold" style={{ border: `1px dashed ${shellBorder}`, color: textSecondary }}>
                          {isGerman ? 'Noch keine Netzwerkdaten von diesem Teilnehmer.' : 'No network details reported by this joinee yet.'}
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl p-4 text-sm font-semibold" style={{ border: `1px solid ${shellBorder}`, background: darkInset, color: textSecondary }}>
                    {isGerman ? 'Noch keine Teilnehmer im Raum.' : 'No joinees in the room yet.'}
                  </div>
                )}
              </div>
            </section>

            <BreakoutHostPanel
              isLight={isLight}
              meetingId={activeMeetingId}
              onNotice={setFlashMessage}
              onUnauthorized={() => setSessionExpired(true)}
              participants={breakoutParticipantSeeds}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function MeetingsHostFallback() {
  const { isGerman } = useAppTranslations();
  const { theme } = useThemeStore();
  const isLight = theme === 'light';
  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: isLight ? '#eef4f8' : '#07111f' }}>
      <p className="text-sm font-semibold" style={{ color: isLight ? '#475569' : '#cbd5e1' }}>{isGerman ? 'Meeting-Verwaltung wird geladen...' : 'Loading meeting controls...'}</p>
    </main>
  );
}

function HostAuthRequired({ isGerman, isLight, meetingId }: { isGerman: boolean; isLight: boolean; meetingId: string }) {
  const pageBg = isLight ? 'linear-gradient(135deg, #eef4f8 0%, #e8eff7 55%, #f6fbff 100%)' : '#07111f';
  const shellBg = isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.045)';
  const shellBorder = isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.10)';
  const textPrimary = isLight ? '#0f172a' : '#ffffff';
  const textSecondary = isLight ? '#475569' : '#cbd5e1';
  const nextUrl = `/meetings/host?meetingId=${encodeURIComponent(meetingId)}`;

  return (
    <main className="min-h-screen px-6 pb-10 pt-16 md:py-10" style={{ background: pageBg, color: textPrimary }}>
      <section
        className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl items-start justify-center md:min-h-[calc(100vh-5rem)] md:items-center"
      >
        <div
          className="w-full rounded-[28px] border p-6 shadow-[0_28px_80px_rgba(15,23,42,0.16)] md:p-8"
          style={{ background: shellBg, borderColor: shellBorder }}
        >
          <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: 'rgb(0,229,186)' }}>
            {isGerman ? 'Host Studio' : 'Host Studio'}
          </p>
          <h1 className="mt-3 text-3xl font-black leading-tight" style={{ color: textPrimary }}>
            {isGerman ? 'Anmeldung erforderlich' : 'Authentication required'}
          </h1>
          <p className="mt-3 text-base leading-7" style={{ color: textSecondary }}>
            {isGerman
              ? 'Melde dich an, um Host-Steuerung, Warteschlange, Teilnehmermedien und Breakout-Raeume zu verwalten.'
              : 'Sign in to manage host controls, the waiting queue, participant media, and breakout rooms.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="brand-gradient-button rounded-2xl px-5 py-3 text-sm font-black"
              href={`/login?next=${encodeURIComponent(nextUrl)}`}
            >
              {isGerman ? 'Anmelden' : 'Sign in'}
            </Link>
            <Link
              className="rounded-2xl border px-5 py-3 text-sm font-bold"
              href="/meet"
              style={{ borderColor: shellBorder, color: textPrimary }}
            >
              {isGerman ? 'Zurueck zu Meet' : 'Back to Meet'}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function networkLevelLabel(level: MeetingParticipantNetworkDetails['level'], isGerman: boolean) {
  if (level === 'excellent') return isGerman ? 'Ausgezeichnet' : 'Excellent';
  if (level === 'good') return isGerman ? 'Gut' : 'Good';
  if (level === 'fair') return isGerman ? 'Mittel' : 'Fair';
  if (level === 'poor') return isGerman ? 'Schwach' : 'Poor';
  return isGerman ? 'Offline' : 'Offline';
}

function networkTone(level?: MeetingParticipantNetworkDetails['level']) {
  if (level === 'excellent') return '#10b981';
  if (level === 'good') return '#22c55e';
  if (level === 'fair') return '#f59e0b';
  if (level === 'poor') return '#ef4444';
  if (level === 'offline') return '#dc2626';
  return '#94a3b8';
}

function formatNetworkDownlink(network: MeetingParticipantNetworkDetails) {
  return typeof network.downlinkMbps === 'number' ? `${network.downlinkMbps.toFixed(1)} Mbps` : '-';
}

function formatNetworkRtt(network: MeetingParticipantNetworkDetails) {
  return typeof network.rttMs === 'number' ? `${Math.round(network.rttMs)} ms` : '-';
}

function formatNetworkUpdated(network: MeetingParticipantNetworkDetails, locale: string) {
  const updatedAt = network.updatedAt instanceof Date ? network.updatedAt : new Date(network.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) return '-';
  return updatedAt.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function NetworkDatum(props: { label: string; textMuted: string; textPrimary: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <div className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: props.textMuted }}>{props.label}</div>
      <div className="mt-1 truncate text-xs font-bold" style={{ color: props.textPrimary }} title={props.value}>{props.value}</div>
    </div>
  );
}

function MenuActionButton(props: { isLight: boolean; label: string; onClick: () => void; tone: 'danger' | 'neutral' | 'success' }) {
  const toneStyles = props.tone === 'danger'
    ? {
        background: props.isLight ? 'rgba(254,226,226,0.82)' : 'rgba(127,29,29,0.38)',
        border: '1px solid rgba(239,68,68,0.32)',
        color: props.isLight ? '#991b1b' : '#fecaca',
      }
    : props.tone === 'success'
      ? {
          background: props.isLight ? 'rgba(220,252,231,0.82)' : 'rgba(6,78,59,0.38)',
          border: '1px solid rgba(16,185,129,0.30)',
          color: props.isLight ? '#065f46' : '#6ee7b7',
        }
      : {
          background: props.isLight ? 'rgba(248,250,252,0.88)' : 'rgba(255,255,255,0.06)',
          border: props.isLight ? '1px solid rgba(15,23,42,0.10)' : '1px solid rgba(255,255,255,0.10)',
          color: props.isLight ? '#0f172a' : '#ffffff',
        };

  return (
    <button
      className="mt-1 flex min-h-11 w-full items-center rounded-2xl px-3 text-left text-xs font-black transition-transform active:scale-[0.98]"
      onClick={props.onClick}
      style={toneStyles}
      type="button"
    >
      <span>{props.label}</span>
    </button>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 18-6-6 6-6M15 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InviteIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M16 11h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LiveRoomIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m10 9 5 3-5 3V9Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8" strokeLinecap="round" />
      <path d="M7 18H5v2M17 6h2V4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
