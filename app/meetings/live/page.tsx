'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMeetingCarbonRoom } from '@/hooks/useMeetingCarbonRoom';
import { useMeetingSfuRoom } from '@/hooks/useMeetingSfuRoom';
import { useHydrated } from '@/hooks/useHydrated';
import { fetchJsonWithRetry } from '@/lib/api/fetchJsonWithRetry';
import { formatCarbonGrams, formatRate } from '@/lib/meetings/carbonCalc';
import { formatBreakoutAnnouncementType } from '@/lib/meetings/breakoutUi';
import { useThemeStore } from '@/lib/stores/themeStore';
import { useAppTranslations } from '@/lib/utils/translations';
import NetworkQualityBadge from '@/components/meetings/NetworkQualityBadge';
import SfuMeetingStage from '@/components/meetings/SfuMeetingStage';
import type { BreakoutParticipantSeed, BreakoutSessionResponse } from '@/types/domain/breakout';
import type { MeetingMediaState, MeetingParticipantNetworkDetails } from '@/lib/meetings/carbonCalc';
import type { NetworkRiskResult } from '@/types/domain/networkRisk';
import type { Meeting } from '@/types/domain/workspace';

export const dynamic = 'force-dynamic';

const DEMO_MEETING_ID = 'm1';
const ROOM_LEAD_ROLE = 'Room lead';
const HOST_NAME_BY_ID: Record<string, string> = {
  u1: 'Dr. Sarah Chen',
  u2: 'Marcus Webb',
  u3: 'Amara Diallo',
  u4: 'Prof. Erik Larsen',
  u5: 'Zero Carbon User',
  u6: 'Leo Martins',
};

type LiveParticipant = {
  id: string;
  displayName: string;
  role: string;
  media: MeetingMediaState;
  network?: Partial<MeetingParticipantNetworkDetails> | null;
};

type NetworkTone = {
  bg: string;
  border: string;
  color: string;
  dot: string;
  label: string;
};

function formatClock(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function meetingLocalJoinPath(meetingId: string) {
  return `/meetings/join?meetingId=${encodeURIComponent(meetingId)}`;
}

function isMeetingNotFoundMessage(message?: string | null) {
  return message?.trim().toLowerCase().includes('meeting not found') ?? false;
}

function toStableParticipantId(participantId: string) {
  const [baseId] = participantId.split(':');
  return baseId?.trim() || participantId;
}

function isModeratorRole(role?: string | null) {
  const normalized = role?.trim().toLowerCase() ?? '';
  if (!normalized) return false;
  return (
    normalized.includes('host')
    || normalized.includes('cohost')
    || normalized.includes('moderator')
    || normalized.includes('admin')
    || normalized.includes('owner')
  );
}

function isRoomLeadRole(role?: string | null) {
  return role?.trim().toLowerCase() === ROOM_LEAD_ROLE.toLowerCase();
}

function networkLevelLabel(level: MeetingParticipantNetworkDetails['level'] | 'unknown', isGerman: boolean) {
  if (level === 'excellent') return isGerman ? 'Ausgezeichnet' : 'Excellent';
  if (level === 'good') return isGerman ? 'Gut' : 'Good';
  if (level === 'fair') return isGerman ? 'Mittel' : 'Fair';
  if (level === 'poor') return isGerman ? 'Schwach' : 'Poor';
  if (level === 'offline') return isGerman ? 'Offline' : 'Offline';
  return isGerman ? 'Unbekannt' : 'Unknown';
}

function getNetworkTone(
  level: MeetingParticipantNetworkDetails['level'] | 'unknown',
  isGerman: boolean,
  isLight: boolean,
): NetworkTone {
  const tones: Record<MeetingParticipantNetworkDetails['level'] | 'unknown', Omit<NetworkTone, 'label'>> = {
    excellent: {
      bg: isLight ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.20)',
      border: 'rgba(16,185,129,0.46)',
      color: isLight ? '#047857' : '#6ee7b7',
      dot: '#10b981',
    },
    good: {
      bg: isLight ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.20)',
      border: 'rgba(14,165,233,0.46)',
      color: isLight ? '#0369a1' : '#7dd3fc',
      dot: '#0ea5e9',
    },
    fair: {
      bg: isLight ? 'rgba(245,158,11,0.13)' : 'rgba(245,158,11,0.22)',
      border: 'rgba(245,158,11,0.48)',
      color: isLight ? '#92400e' : '#fcd34d',
      dot: '#f59e0b',
    },
    poor: {
      bg: isLight ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.22)',
      border: 'rgba(239,68,68,0.50)',
      color: isLight ? '#991b1b' : '#fecaca',
      dot: '#ef4444',
    },
    offline: {
      bg: isLight ? 'rgba(100,116,139,0.14)' : 'rgba(100,116,139,0.24)',
      border: 'rgba(100,116,139,0.46)',
      color: isLight ? '#475569' : '#cbd5e1',
      dot: '#64748b',
    },
    unknown: {
      bg: isLight ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.18)',
      border: 'rgba(148,163,184,0.36)',
      color: isLight ? '#64748b' : '#cbd5e1',
      dot: '#94a3b8',
    },
  };
  return {
    ...tones[level],
    label: networkLevelLabel(level, isGerman),
  };
}

function getParticipantNetworkLevel(participant?: Pick<LiveParticipant, 'network'> | null) {
  const level = participant?.network?.level;
  if (level === 'excellent' || level === 'good' || level === 'fair' || level === 'poor' || level === 'offline') {
    return level;
  }
  return 'unknown';
}

function formatParticipantNetworkDetails(participant: Pick<LiveParticipant, 'network'>, fallbackLabel: string) {
  const details = [
    participant.network?.effectiveType?.toUpperCase(),
    typeof participant.network?.downlinkMbps === 'number' ? `${participant.network.downlinkMbps.toFixed(1)} Mbps` : null,
    typeof participant.network?.rttMs === 'number' ? `${Math.round(participant.network.rttMs)} ms` : null,
  ].filter(Boolean);
  return details.length ? details.join(' | ') : fallbackLabel;
}

function buildLiveMeetingHref(meetingId: string, breakoutSessionId?: string, breakoutRoomId?: string) {
  const params = new URLSearchParams({ meetingId });
  if (breakoutSessionId?.trim() && breakoutRoomId?.trim()) {
    params.set('breakoutSessionId', breakoutSessionId.trim());
    params.set('breakoutRoomId', breakoutRoomId.trim());
  }
  return `/meetings/live?${params.toString()}`;
}

export default function MeetingsLivePage() {
  return (
    <React.Suspense fallback={<MeetingsLiveFallback />}>
      <MeetingsLivePageContent />
    </React.Suspense>
  );
}

function MeetingsLivePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isGerman } = useAppTranslations();
  const { data: session, status: sessionStatus } = useSession();
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';
  const activeMeetingId = searchParams.get('meetingId')?.trim() || DEMO_MEETING_ID;
  const activeBreakoutRoomId = searchParams.get('breakoutRoomId')?.trim() || '';
  const activeBreakoutSessionId = searchParams.get('breakoutSessionId')?.trim() || '';
  const [meeting, setMeeting] = React.useState<Meeting | null>(null);
  const [meetingResolved, setMeetingResolved] = React.useState(false);
  const [breakoutSession, setBreakoutSession] = React.useState<BreakoutSessionResponse['session']>(null);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [copyMessage, setCopyMessage] = React.useState('');
  const [actionMessage, setActionMessage] = React.useState('');
  const [clockLabel, setClockLabel] = React.useState(() => formatClock(new Date()));
  const [captionsOn, setCaptionsOn] = React.useState(false);
  const [handRaised, setHandRaised] = React.useState(false);
  const [breakoutHelpBusy, setBreakoutHelpBusy] = React.useState(false);
  const [breakoutQuickBusy, setBreakoutQuickBusy] = React.useState(false);
  const [breakoutSetupOpen, setBreakoutSetupOpen] = React.useState(false);
  const [breakoutSelectedParticipantIds, setBreakoutSelectedParticipantIds] = React.useState<string[]>([]);
  const [breakoutRoomByParticipantId, setBreakoutRoomByParticipantId] = React.useState<Record<string, '1' | '2'>>({});
  const [breakoutLeadByRoom, setBreakoutLeadByRoom] = React.useState<Record<string, string>>({});
  const [breakoutDurationMinutes, setBreakoutDurationMinutes] = React.useState('10');
  const [utilityExpanded, setUtilityExpanded] = React.useState(false);
  const [optionsOpen, setOptionsOpen] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [sessionExpired, setSessionExpired] = React.useState(false);
  const [selfJoinReady, setSelfJoinReady] = React.useState(false);
  const [selfJoinError, setSelfJoinError] = React.useState('');
  const [networkRisk, setNetworkRisk] = React.useState<NetworkRiskResult | null>(null);
  const [networkRiskChecking, setNetworkRiskChecking] = React.useState(false);
  const locale = isGerman ? 'de-DE' : 'en-US';
  const actionTimerRef = React.useRef<number | null>(null);
  const breakoutRedirectRef = React.useRef<string | null>(null);
  const liveShellRef = React.useRef<HTMLElement | null>(null);
  const localPreviewVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const [localCameraStream, setLocalCameraStream] = React.useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = React.useState<MediaStream | null>(null);
  const currentParticipantId = session?.user?.id ?? '';
  const currentParticipantName = session?.user?.name?.trim() || 'Zero Carbon User';
  const selfParticipant = React.useMemo(() => ({
    id: currentParticipantId,
    displayName: currentParticipantName,
    role: 'Attendee',
    media: { camera: false, microphone: true, screenShare: false },
  }), [currentParticipantId, currentParticipantName]);
  const activeBreakoutRoomLabel = activeBreakoutRoomId ? `Breakout ${activeBreakoutRoomId.slice(-4).toUpperCase()}` : undefined;
  const sfu = useMeetingSfuRoom({
    autoConnect: selfJoinReady,
    breakoutRoomId: activeBreakoutRoomId || undefined,
    breakoutSessionId: activeBreakoutSessionId || undefined,
    meetingId: activeMeetingId,
    displayName: selfParticipant.displayName,
  });

  const {
    isSyncing,
    roomLocked,
    roomLabel,
    waitingParticipants,
    participants,
    snapshot,
    syncError,
    syncRoomNow,
    unauthorized,
    admitWaitingParticipant,
    removeParticipant,
    setRoomLock,
    syncParticipantsFromSfu,
    updateMediaState,
  } = useMeetingCarbonRoom({
    breakoutRoomId: activeBreakoutRoomId || undefined,
    breakoutRoomName: activeBreakoutRoomLabel,
    breakoutSessionId: activeBreakoutSessionId || undefined,
    enabled: selfJoinReady,
    roomId: activeMeetingId,
    autoJoinParticipant: selfJoinReady && currentParticipantId ? selfParticipant : undefined,
  });
  const lastSfuSyncSignatureRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (sessionStatus === 'loading') {
      return undefined;
    }

    if (!session?.user?.id) {
      setSessionExpired(true);
      setSelfJoinReady(false);
      return undefined;
    }

    let cancelled = false;
    setSelfJoinReady(false);
    setSelfJoinError('');
    setNetworkRisk(null);

    const ensureSelfParticipant = async () => {
      setNetworkRiskChecking(true);
      const riskResult = await fetchJsonWithRetry<NetworkRiskResult>(
        `/api/network/risk?meetingId=${encodeURIComponent(activeMeetingId)}`,
        { cache: 'no-store' },
        { retries: 0 },
      );
      if (cancelled) return;
      setNetworkRiskChecking(false);
      if (riskResult.ok && riskResult.data) {
        setNetworkRisk(riskResult.data);
        if (riskResult.data.blocked) {
          setSelfJoinError(isGerman
            ? 'VPN oder Proxy erkannt. Bitte trenne die VPN-/Proxy-Verbindung und versuche erneut.'
            : 'VPN or proxy detected. Please disconnect VPN/proxy and try again.');
          setSelfJoinReady(false);
          return;
        }
      } else {
        setNetworkRisk({
          blocked: false,
          checkedAt: new Date().toISOString(),
          enforcement: 'warn',
          ipAddress: null,
          provider: 'none',
          reason: riskResult.error ?? 'Unable to verify VPN/proxy status.',
          signals: {
            hosting: false,
            proxy: false,
            relay: false,
            tor: false,
            vpn: false,
          },
          status: 'unverified',
        });
      }

      const result = await fetchJsonWithRetry<{ meeting: Meeting }>(`/api/meetings/${encodeURIComponent(activeMeetingId)}/participants`, {
        method: 'POST',
        body: JSON.stringify({
          role: 'attendee',
          userId: session.user.id,
        }),
      }, { retries: 0 });

      if (cancelled) return;
      if (result.unauthorized) {
        setSessionExpired(true);
        setSelfJoinReady(false);
        return;
      }
      if (!result.ok) {
        setSelfJoinError(result.error ?? (isGerman ? 'Beitritt zum Meeting nicht moeglich.' : 'Unable to join this meeting.'));
        return;
      }
      setSessionExpired(false);
      setSelfJoinReady(true);
    };

    void ensureSelfParticipant().finally(() => {
      if (!cancelled) {
        setNetworkRiskChecking(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeMeetingId, isGerman, session?.user?.id, sessionStatus]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setClockLabel(formatClock(new Date()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === liveShellRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  React.useEffect(() => () => {
    if (actionTimerRef.current) {
      window.clearTimeout(actionTimerRef.current);
    }
  }, []);

  React.useEffect(() => {
    if (sessionStatus !== 'authenticated' || !session?.user?.id) {
      setMeeting(null);
      setMeetingResolved(true);
      return undefined;
    }

    let cancelled = false;
    setMeetingResolved(false);
    const loadMeeting = async () => {
      try {
        const response = await fetchJsonWithRetry<{ meeting: Meeting }>(`/api/meetings/${encodeURIComponent(activeMeetingId)}`, { cache: 'no-store' });
        if (response.unauthorized) {
          if (!cancelled) {
            setSessionExpired(true);
            setMeetingResolved(true);
          }
          return;
        }
        if (!cancelled && response.ok && response.data?.meeting) {
          setMeeting(response.data.meeting);
          setMeetingResolved(true);
          return;
        }
      } catch {
        // Keep fallback labels if metadata fetch fails.
      }
      if (!cancelled) {
        setMeeting(null);
        setMeetingResolved(true);
      }
    };
    void loadMeeting();
    return () => {
      cancelled = true;
    };
  }, [activeMeetingId, router, session?.user?.id, sessionStatus]);

  React.useEffect(() => {
    if (unauthorized) {
      setSessionExpired(true);
    }
  }, [unauthorized]);

  React.useEffect(() => {
    if (sessionStatus !== 'authenticated' || !session?.user?.id || !currentParticipantId || !selfJoinReady) {
      return undefined;
    }

    let cancelled = false;
    const loadBreakoutState = async () => {
      const result = await fetchJsonWithRetry<BreakoutSessionResponse>(
        `/api/meetings/${encodeURIComponent(activeMeetingId)}/breakouts/current?participantId=${encodeURIComponent(currentParticipantId)}`,
        { cache: 'no-store' },
      );
      if (cancelled) {
        return;
      }
      if (result.unauthorized) {
        setSessionExpired(true);
        return;
      }
      if (!result.ok) {
        setBreakoutSession(null);
        return;
      }
      setBreakoutSession(result.data?.session ?? null);
    };

    void loadBreakoutState();
    const timer = window.setInterval(() => {
      void loadBreakoutState();
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeMeetingId, currentParticipantId, selfJoinReady, session?.user?.id, sessionStatus]);

  const sfuConnected = sfu.isEnabled && sfu.isConnected;
  const localParticipantId = sfu.localParticipantId ?? (currentParticipantId || 'attendee-self');
  const participantNetworkById = new Map(participants.map((participant) => [toStableParticipantId(participant.id), participant.network ?? null]));
  const liveParticipants: LiveParticipant[] = sfuConnected
    ? sfu.participants.map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      role: participant.isLocal ? 'You' : participant.role,
      media: participant.media,
      network: participantNetworkById.get(toStableParticipantId(participant.id)) ?? null,
    }))
    : participants;
  const attendee = liveParticipants.find((participant) => participant.id === localParticipantId)
    ?? liveParticipants.find((participant) => toStableParticipantId(participant.id) === currentParticipantId)
    ?? liveParticipants.find((participant) => participant.id === currentParticipantId);
  const micOn = sfuConnected ? sfu.localMedia.microphone : (attendee?.media.microphone ?? true);
  const camOn = sfuConnected ? sfu.localMedia.camera : Boolean(localCameraStream) || (attendee?.media.camera ?? false);
  const shareOn = sfuConnected ? sfu.localMedia.screenShare : Boolean(localScreenStream) || (attendee?.media.screenShare ?? false);
  const activeLocalPreviewStream = localScreenStream ?? localCameraStream;
  const participantCount = Math.max(liveParticipants.length, 1);
  const remoteParticipants = liveParticipants.filter((participant) => participant.id !== localParticipantId);
  const title = meeting?.title ?? 'Climate Policy Q&A';
  const roomCode = meeting?.roomCode ?? `ECO-${activeMeetingId.toUpperCase()}`;
  const hostName = meeting ? (HOST_NAME_BY_ID[meeting.hostUserId] ?? 'Host Team') : 'Host Team';
  const isModeratorUser = isModeratorRole(session?.user?.role) || Boolean(meeting?.hostUserId && meeting.hostUserId === currentParticipantId);
  const assignedBreakoutRoomId = breakoutSession?.myAssignment?.roomId ?? '';
  const assignedBreakoutRoom = assignedBreakoutRoomId
    ? breakoutSession?.rooms.find((room) => room.id === assignedBreakoutRoomId) ?? null
    : null;
  const activeBreakoutRoom = activeBreakoutRoomId
    ? breakoutSession?.rooms.find((room) => room.id === activeBreakoutRoomId) ?? null
    : null;
  const activeBreakoutHelpRequest = breakoutSession?.myHelpRequest ?? null;
  const activeBreakoutSupportRequest = activeBreakoutHelpRequest?.kind === 'help' ? activeBreakoutHelpRequest : null;
  const activeBreakoutMergeRequest = activeBreakoutHelpRequest?.kind === 'merge' ? activeBreakoutHelpRequest : null;
  const isActiveRoomLead = isRoomLeadRole(breakoutSession?.myAssignment?.participantRole);
  const breakoutNotice = breakoutSession?.latestAnnouncement ?? breakoutSession?.latestBroadcast ?? null;
  const openBreakoutRooms = breakoutSession?.rooms.filter((room) => room.status !== 'merged') ?? [];
  const breakoutIsSplit = Boolean(
    breakoutSession
    && (breakoutSession.status === 'active' || breakoutSession.status === 'countdown')
    && openBreakoutRooms.length,
  );
  const breakoutHelpRequestCount = breakoutSession?.helpRequests.filter((request) => request.kind === 'help').length ?? 0;
  const breakoutMergeRequests = breakoutSession?.helpRequests.filter((request) => request.kind === 'merge') ?? [];
  const breakoutMergeRequestCount = breakoutMergeRequests.length;
  const assignableBreakoutParticipants = React.useMemo<BreakoutParticipantSeed[]>(() => {
    const seen = new Set<string>();
    return liveParticipants
      .map((participant) => ({
        id: toStableParticipantId(participant.id),
        displayName: participant.displayName,
        role: participant.role,
      }))
      .filter((participant) => {
        if (!participant.id || participant.id === currentParticipantId) {
          return false;
        }
        if (isModeratorRole(participant.role) || seen.has(participant.id)) {
          return false;
        }
        seen.add(participant.id);
        return true;
      });
  }, [currentParticipantId, liveParticipants]);
  const canQuickSplitBreakout = isModeratorUser && participantCount > 2 && assignableBreakoutParticipants.length >= 2;
  const breakoutSetupParticipants = assignableBreakoutParticipants.filter((participant) => breakoutSelectedParticipantIds.includes(participant.id));
  const inviteLink = React.useMemo(() => {
    const localPath = meetingLocalJoinPath(activeMeetingId);
    if (typeof window === 'undefined') {
      return localPath;
    }
    return `${window.location.origin}${localPath}`;
  }, [activeMeetingId]);
  const shellText = isLight ? '#0f172a' : '#f8fafc';
  const pageBg = isLight ? 'linear-gradient(180deg,#e8eff5 0%,#f3f7fb 52%,#edf4f8 100%)' : '#090b10';
  const shellBg = isLight ? 'rgba(255,255,255,0.9)' : '#10141c';
  const shellBorder = isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.10)';
  const stageBorder = isLight ? 'rgba(71,85,105,0.18)' : 'rgba(148,163,184,0.20)';
  const stageBg = isLight
    ? 'linear-gradient(135deg,#eef6f2 0%,#e2e8f0 48%,#dbeafe 100%)'
    : 'linear-gradient(135deg,#0b1220 0%,#111827 54%,#0f2f2a 100%)';
  const statusText = isLight ? '#334155' : 'rgba(255,255,255,0.7)';
  const overlayPanelBg = isLight ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.40)';
  const overlayPanelBorder = isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.2)';
  const livePath = buildLiveMeetingHref(
    activeMeetingId,
    activeBreakoutSessionId || undefined,
    activeBreakoutRoomId || undefined,
  );
  const signInHref = `/login?next=${encodeURIComponent(livePath)}`;
  const hasAuthenticatedUser = sessionStatus === 'authenticated' && Boolean(session?.user?.id);
  const showAuthGate = sessionStatus !== 'loading' && (!hasAuthenticatedUser || sessionExpired);
  const showPreparingGate = !showAuthGate && !selfJoinReady;
  const showMissingMeetingGate = !showAuthGate && (
    isMeetingNotFoundMessage(selfJoinError)
    || isMeetingNotFoundMessage(syncError)
    || (meetingResolved && !meeting && selfJoinReady)
  );
  const joinedAsLabel = session?.user?.email ?? session?.user?.name ?? currentParticipantName;
  const mediaStatusLabel = sfuConnected
    ? (isGerman ? 'Medien live' : 'Media live')
    : sfu.isEnabled
      ? (sfu.isConnecting ? (isGerman ? 'Medien verbinden' : 'Connecting media') : (isGerman ? 'Medien bereit' : 'Media ready'))
      : (isGerman ? 'Geraetesteuerung' : 'Device controls');
  const isOnlyParticipant = participantCount <= 1;
  const participantLabel = participantCount === 1
    ? (isGerman ? '1 Teilnehmer' : '1 participant')
    : (isGerman ? `${participantCount} Teilnehmer` : `${participantCount} participants`);
  const mediaControlsDisabled = !selfJoinReady;

  React.useEffect(() => {
    const element = localPreviewVideoRef.current;
    if (!element) return;
    element.srcObject = activeLocalPreviewStream;
  }, [activeLocalPreviewStream]);

  React.useEffect(() => () => {
    localCameraStream?.getTracks().forEach((track) => track.stop());
    localScreenStream?.getTracks().forEach((track) => track.stop());
  }, [localCameraStream, localScreenStream]);

  React.useEffect(() => {
    if (!sfuConnected || !sfu.participants.length) {
      lastSfuSyncSignatureRef.current = null;
      return;
    }

    const nextParticipants = sfu.participants.map((participant) => ({
      id: toStableParticipantId(participant.id),
      displayName: participant.displayName,
      role: participant.isLocal ? 'host' : participant.role,
      media: participant.media,
    }));
    const signature = JSON.stringify({
      localParticipantId: sfu.localParticipantId,
      participants: nextParticipants,
    });
    if (lastSfuSyncSignatureRef.current === signature) {
      return;
    }

    lastSfuSyncSignatureRef.current = signature;
    void syncParticipantsFromSfu(
      nextParticipants,
      sfu.localParticipantId ? [toStableParticipantId(sfu.localParticipantId)] : [],
    );
  }, [sfu.localParticipantId, sfu.participants, sfuConnected, syncParticipantsFromSfu]);

  React.useEffect(() => {
    if (!sfu.isEnabled || sfu.isConnecting || sfuConnected) {
      return;
    }
    if (!lastSfuSyncSignatureRef.current) {
      return;
    }
    lastSfuSyncSignatureRef.current = null;
    void syncParticipantsFromSfu([]);
  }, [sfu.isConnecting, sfu.isEnabled, sfuConnected, syncParticipantsFromSfu]);

  React.useEffect(() => () => {
    if (!sfu.isEnabled) {
      return;
    }
    void syncParticipantsFromSfu([]);
  }, [sfu.isEnabled, syncParticipantsFromSfu]);

  React.useEffect(() => {
    if (sessionStatus !== 'authenticated' || !session?.user?.id || !selfJoinReady || !currentParticipantId || !meetingResolved) {
      return;
    }

    const mainHref = buildLiveMeetingHref(activeMeetingId);
    const currentHref = buildLiveMeetingHref(
      activeMeetingId,
      activeBreakoutSessionId || undefined,
      activeBreakoutRoomId || undefined,
    );
    const assignedHref = breakoutSession && assignedBreakoutRoomId
      ? buildLiveMeetingHref(activeMeetingId, breakoutSession.sessionId, assignedBreakoutRoomId)
      : null;

    let targetHref: string | null = null;

    if (activeBreakoutRoomId || activeBreakoutSessionId) {
      if (!breakoutSession || breakoutSession.status === 'ended') {
        targetHref = mainHref;
      } else if (isModeratorUser) {
        if (
          breakoutSession.sessionId !== activeBreakoutSessionId
          || !activeBreakoutRoom
          || activeBreakoutRoom.status === 'merged'
        ) {
          targetHref = mainHref;
        }
      } else if (breakoutSession.status !== 'active') {
        targetHref = mainHref;
      } else if (assignedHref && assignedBreakoutRoom?.status !== 'merged') {
        if (
          breakoutSession.sessionId !== activeBreakoutSessionId
          || activeBreakoutRoomId !== assignedBreakoutRoomId
        ) {
          targetHref = assignedHref;
        }
      } else {
        targetHref = mainHref;
      }
    } else if (!isModeratorUser && breakoutSession?.status === 'active' && assignedHref && assignedBreakoutRoom?.status !== 'merged') {
      targetHref = assignedHref;
    }

    if (!targetHref || targetHref === currentHref) {
      breakoutRedirectRef.current = null;
      return;
    }
    if (breakoutRedirectRef.current === targetHref) {
      return;
    }

    breakoutRedirectRef.current = targetHref;
    router.replace(targetHref);
  }, [
    activeBreakoutRoom,
    activeBreakoutRoomId,
    activeBreakoutSessionId,
    activeMeetingId,
    assignedBreakoutRoom,
    assignedBreakoutRoomId,
    breakoutSession,
    currentParticipantId,
    isModeratorUser,
    meetingResolved,
    router,
    selfJoinReady,
    session?.user?.id,
    sessionStatus,
  ]);

  const toggleField = async (field: 'microphone' | 'camera' | 'screenShare', current: boolean) => {
    if (!selfJoinReady || !currentParticipantId) {
      showAction(isGerman ? 'Meeting-Beitritt wird vorbereitet...' : 'Meeting join is still preparing...');
      return;
    }

    try {
      if (sfuConnected) {
        const nextValue = !current;
        const updated = field === 'microphone'
          ? await sfu.setMicrophoneEnabled(nextValue)
          : field === 'camera'
            ? await sfu.setCameraEnabled(nextValue)
            : await sfu.setScreenShareEnabled(nextValue);
        if (!updated) {
          showAction('Unable to update live media right now.');
          return;
        }
      } else {
        if (field === 'camera') {
          const nextValue = !current;
          if (nextValue) {
            if (!navigator.mediaDevices?.getUserMedia) {
              showAction(isGerman ? 'Kamera ist in diesem Browser nicht verfuegbar.' : 'Camera is not available in this browser.');
              return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            localCameraStream?.getTracks().forEach((track) => track.stop());
            setLocalCameraStream(stream);
          } else {
            localCameraStream?.getTracks().forEach((track) => track.stop());
            setLocalCameraStream(null);
          }
        }
        if (field === 'screenShare') {
          const nextValue = !current;
          if (nextValue) {
            if (!navigator.mediaDevices?.getDisplayMedia) {
              showAction(isGerman ? 'Bildschirmfreigabe ist in diesem Browser nicht verfuegbar.' : 'Screen sharing is not available in this browser.');
              return;
            }
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            localScreenStream?.getTracks().forEach((track) => track.stop());
            stream.getVideoTracks().forEach((track) => {
              track.onended = () => {
                setLocalScreenStream(null);
                void updateMediaState(currentParticipantId, 'screenShare', false);
              };
            });
            setLocalScreenStream(stream);
          } else {
            localScreenStream?.getTracks().forEach((track) => track.stop());
            setLocalScreenStream(null);
          }
        }
        await updateMediaState(currentParticipantId, field, !current);
      }
      const fieldLabel = field === 'microphone'
        ? (isGerman ? 'Mikrofon' : 'Microphone')
        : field === 'camera'
          ? (isGerman ? 'Kamera' : 'Camera')
          : (isGerman ? 'Bildschirmfreigabe' : 'Screen share');
      const nextStateLabel = !current ? (isGerman ? 'ein' : 'on') : (isGerman ? 'aus' : 'off');
      showAction(`${fieldLabel} turned ${nextStateLabel}.`);
    } catch {
      showAction(field === 'camera'
        ? (isGerman ? 'Kamera konnte nicht gestartet werden. Pruefe die Browser-Berechtigung.' : 'Unable to start camera. Check browser permission.')
        : field === 'screenShare'
          ? (isGerman ? 'Bildschirmfreigabe konnte nicht gestartet werden.' : 'Unable to start screen sharing.')
          : (isGerman ? 'Mediensteuerung konnte nicht aktualisiert werden.' : 'Unable to update media control right now.'));
    }
  };

  const showAction = (message: string) => {
    setActionMessage(message);
    if (actionTimerRef.current) {
      window.clearTimeout(actionTimerRef.current);
    }
    actionTimerRef.current = window.setTimeout(() => {
      setActionMessage('');
    }, 2200);
  };

  const copyInviteLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
        setCopyMessage(isGerman ? 'Meeting-Link kopiert' : 'Meeting link copied');
        showAction(isGerman ? 'Einladungslink in die Zwischenablage kopiert.' : 'Invite link copied to clipboard.');
      } else {
        setCopyMessage(isGerman ? 'Zwischenablage nicht verfuegbar' : 'Clipboard not supported');
        showAction(isGerman ? 'Die Zwischenablage ist in diesem Browser nicht verfuegbar.' : 'Clipboard is not available in this browser.');
      }
    } catch {
      setCopyMessage(isGerman ? 'Link konnte nicht kopiert werden' : 'Unable to copy link');
      showAction(isGerman ? 'Einladungslink konnte nicht kopiert werden.' : 'Unable to copy invite link.');
    }
    window.setTimeout(() => setCopyMessage(''), 1800);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
        return;
      }

      const shell = liveShellRef.current;
      if (!shell || !document.fullscreenEnabled || !shell.requestFullscreen) {
        showAction(isGerman ? 'Vollbild ist in diesem Browser nicht verfuegbar.' : 'Full screen is not available in this browser.');
        return;
      }

      await shell.requestFullscreen();
      setIsFullscreen(true);
    } catch {
      showAction(isGerman ? 'Vollbild konnte nicht gestartet werden.' : 'Unable to start full screen.');
    }
  };

  const handleToggleRoomLock = async () => {
    const nextLockState = !roomLocked;
    const updatedRoom = await setRoomLock(nextLockState);
    if (!updatedRoom) {
      showAction('Host permissions required to change room lock.');
      return;
    }
    showAction(nextLockState ? (isGerman ? 'Meeting-Raum gesperrt.' : 'Meeting room locked.') : (isGerman ? 'Meeting-Raum entsperrt.' : 'Meeting room unlocked.'));
  };

  const handleAdmitWaiting = async (participantId: string, displayName: string) => {
    const updatedRoom = await admitWaitingParticipant(participantId);
    if (!updatedRoom) {
      showAction(`Unable to admit ${displayName}.`);
      return;
    }
    showAction(`${displayName} admitted to live room.`);
  };

  const handleRemoveParticipant = async (participantId: string, displayName: string) => {
    const updatedRoom = await removeParticipant(participantId);
    if (!updatedRoom) {
      showAction(`Unable to remove ${displayName}.`);
      return;
    }
    showAction(`${displayName} removed from room.`);
  };

  const openBreakoutSetup = () => {
    if (!canQuickSplitBreakout) {
      showAction(isGerman ? 'Zum Aufteilen braucht der Host mindestens zwei weitere Teilnehmer.' : 'Host needs at least two other participants to split rooms.');
      return;
    }

    const roomByParticipant: Record<string, '1' | '2'> = {};
    const leadByRoom: Record<string, string> = {};
    const selectedIds = assignableBreakoutParticipants.map((participant) => participant.id);
    assignableBreakoutParticipants.forEach((participant, index) => {
      const roomKey: '1' | '2' = index % 2 === 0 ? '1' : '2';
      roomByParticipant[participant.id] = roomKey;
      if (!leadByRoom[roomKey]) {
        leadByRoom[roomKey] = participant.id;
      }
    });

    setBreakoutSelectedParticipantIds(selectedIds);
    setBreakoutRoomByParticipantId(roomByParticipant);
    setBreakoutLeadByRoom(leadByRoom);
    setBreakoutDurationMinutes('10');
    setBreakoutSetupOpen(true);
  };

  const toggleBreakoutSetupParticipant = (participantId: string) => {
    setBreakoutSelectedParticipantIds((current) => {
      const selected = current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId];
      setBreakoutLeadByRoom((leads) => {
        const next = { ...leads };
        for (const roomKey of ['1', '2']) {
          if (next[roomKey] === participantId && !selected.includes(participantId)) {
            const replacement = assignableBreakoutParticipants.find((participant) => (
              participant.id !== participantId
              && selected.includes(participant.id)
              && (breakoutRoomByParticipantId[participant.id] ?? '1') === roomKey
            ));
            if (replacement) {
              next[roomKey] = replacement.id;
            } else {
              delete next[roomKey];
            }
          }
        }
        return next;
      });
      return selected;
    });
  };

  const setBreakoutSetupRoom = (participantId: string, roomKey: '1' | '2') => {
    setBreakoutRoomByParticipantId((current) => ({ ...current, [participantId]: roomKey }));
    setBreakoutLeadByRoom((current) => {
      const next = { ...current };
      const previousRoom = breakoutRoomByParticipantId[participantId];
      if (previousRoom && next[previousRoom] === participantId) {
        delete next[previousRoom];
      }
      if (!next[roomKey]) {
        next[roomKey] = participantId;
      }
      return next;
    });
  };

  const setBreakoutSetupLead = (participantId: string, roomKey: '1' | '2') => {
    if (!breakoutSelectedParticipantIds.includes(participantId)) {
      setBreakoutSelectedParticipantIds((current) => [...current, participantId]);
    }
    setBreakoutRoomByParticipantId((current) => ({ ...current, [participantId]: roomKey }));
    setBreakoutLeadByRoom((current) => ({ ...current, [roomKey]: participantId }));
  };

  const handleBreakoutHelpToggle = async () => {
    if (!breakoutSession || !activeBreakoutRoomId || isModeratorUser) {
      return;
    }

    setBreakoutHelpBusy(true);
    const result = await fetchJsonWithRetry<BreakoutSessionResponse>(
      `/api/meetings/${encodeURIComponent(activeMeetingId)}/breakouts/sessions/${encodeURIComponent(breakoutSession.sessionId)}/actions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          activeBreakoutSupportRequest
            ? {
                action: 'clearHelpRequest',
                participantId: currentParticipantId,
              }
            : {
                action: 'requestHelp',
                participantId: currentParticipantId,
                participantName: currentParticipantName,
              },
        ),
      },
    );
    setBreakoutHelpBusy(false);
    if (result.unauthorized) {
      setSessionExpired(true);
      return;
    }
    if (!result.ok) {
      showAction(result.error ?? 'Unable to update breakout help request.');
      return;
    }
    setBreakoutSession(result.data?.session ?? null);
    showAction(activeBreakoutSupportRequest ? (isGerman ? 'Host-Hilfeanfrage entfernt.' : 'Host help request cleared.') : (isGerman ? 'Host-Hilfe angefragt.' : 'Host help requested.'));
  };

  const handleBreakoutMergeRequest = async () => {
    if (!breakoutSession || !activeBreakoutRoomId || isModeratorUser || !isActiveRoomLead) {
      return;
    }

    setBreakoutHelpBusy(true);
    const result = await fetchJsonWithRetry<BreakoutSessionResponse>(
      `/api/meetings/${encodeURIComponent(activeMeetingId)}/breakouts/sessions/${encodeURIComponent(breakoutSession.sessionId)}/actions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: activeBreakoutMergeRequest ? 'clearHelpRequest' : 'requestMerge',
          participantId: currentParticipantId,
          participantName: currentParticipantName,
        }),
      },
    );
    setBreakoutHelpBusy(false);
    if (result.unauthorized) {
      setSessionExpired(true);
      return;
    }
    if (!result.ok) {
      showAction(result.error ?? (isGerman ? 'Merge-Anfrage konnte nicht gesendet werden.' : 'Unable to send merge request.'));
      return;
    }
    setBreakoutSession(result.data?.session ?? null);
    showAction(activeBreakoutMergeRequest
      ? (isGerman ? 'Merge-Anfrage entfernt.' : 'Merge request cleared.')
      : (isGerman ? 'Merge-Anfrage an den Host gesendet.' : 'Merge request sent to the host.'));
  };

  const handleMergeRequestedRoom = async (roomId: string, roomName: string) => {
    if (!breakoutSession || !isModeratorUser) {
      return;
    }

    setBreakoutQuickBusy(true);
    const result = await fetchJsonWithRetry<BreakoutSessionResponse>(
      `/api/meetings/${encodeURIComponent(activeMeetingId)}/breakouts/sessions/${encodeURIComponent(breakoutSession.sessionId)}/actions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mergeRoom',
          roomId,
          countdownSeconds: 15,
        }),
      },
    );
    setBreakoutQuickBusy(false);
    if (result.unauthorized) {
      setSessionExpired(true);
      return;
    }
    if (!result.ok) {
      showAction(result.error ?? (isGerman ? 'Angefragter Raum konnte nicht zusammengefuehrt werden.' : 'Unable to merge requested room.'));
      return;
    }
    setBreakoutSession(result.data?.session ?? null);
    showAction(isGerman ? `${roomName} wird in 15 Sekunden zusammengefuehrt.` : `${roomName} will merge in 15 seconds.`);
  };

  const handleStartBreakoutFromSetup = async () => {
    if (!isModeratorUser || breakoutQuickBusy) {
      return;
    }

    const selectedParticipants = breakoutSetupParticipants;
    const selectedRoomKeys = new Set(selectedParticipants.map((participant) => breakoutRoomByParticipantId[participant.id] ?? '1'));
    const parsedDurationMinutes = Number.parseInt(breakoutDurationMinutes, 10);
    if (selectedParticipants.length < 2) {
      showAction(isGerman ? 'Waehle mindestens zwei Teilnehmer aus.' : 'Select at least two participants.');
      return;
    }
    if (selectedRoomKeys.size < 2) {
      showAction(isGerman ? 'Lege Teilnehmer in beide Raeume.' : 'Place participants in both rooms.');
      return;
    }
    if (!Number.isFinite(parsedDurationMinutes) || parsedDurationMinutes < 1 || parsedDurationMinutes > 120) {
      showAction(isGerman ? 'Waehle eine Dauer zwischen 1 und 120 Minuten.' : 'Choose a duration from 1 to 120 minutes.');
      return;
    }

    const normalizedLeads: Record<string, string> = { ...breakoutLeadByRoom };
    for (const roomKey of ['1', '2'] as const) {
      const roomParticipants = selectedParticipants.filter((participant) => (breakoutRoomByParticipantId[participant.id] ?? '1') === roomKey);
      if (!roomParticipants.length) {
        continue;
      }
      if (!normalizedLeads[roomKey] || !roomParticipants.some((participant) => participant.id === normalizedLeads[roomKey])) {
        normalizedLeads[roomKey] = roomParticipants[0].id;
      }
    }

    setBreakoutQuickBusy(true);
    try {
      const createResult = await fetchJsonWithRetry<BreakoutSessionResponse>(
        `/api/meetings/${encodeURIComponent(activeMeetingId)}/breakouts/sessions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCount: 2 }),
        },
      );
      if (createResult.unauthorized) {
        setSessionExpired(true);
        return;
      }
      if (!createResult.ok || !createResult.data?.session) {
        showAction(createResult.error ?? (isGerman ? 'Breakout-Raeume konnten nicht erstellt werden.' : 'Unable to create breakout rooms.'));
        return;
      }

      const createdSession = createResult.data.session;
      const [firstRoom, secondRoom] = createdSession.rooms;
      if (!firstRoom || !secondRoom) {
        showAction(isGerman ? 'Breakout-Raeume konnten nicht vorbereitet werden.' : 'Unable to prepare breakout rooms.');
        return;
      }
      setBreakoutSession(createdSession);

      const participantsForStart = selectedParticipants.map((participant) => {
        const roomKey = breakoutRoomByParticipantId[participant.id] ?? '1';
        const isLead = normalizedLeads[roomKey] === participant.id;
        return {
          ...participant,
          role: isLead ? ROOM_LEAD_ROLE : participant.role,
        };
      });
      const assignments = participantsForStart.map((participant) => {
        const roomKey = breakoutRoomByParticipantId[participant.id] ?? '1';
        const targetRoom = roomKey === '1' ? firstRoom : secondRoom;
        return {
          participantId: participant.id,
          participantName: participant.displayName,
          participantRole: participant.role,
          roomId: targetRoom.id,
        };
      });

      const assignResult = await fetchJsonWithRetry<BreakoutSessionResponse>(
        `/api/meetings/${encodeURIComponent(activeMeetingId)}/breakouts/sessions/${encodeURIComponent(createdSession.sessionId)}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'manualAssign',
            assignments,
          }),
        },
      );
      if (assignResult.unauthorized) {
        setSessionExpired(true);
        return;
      }
      if (!assignResult.ok) {
        showAction(assignResult.error ?? (isGerman ? 'Teilnehmer konnten nicht zugewiesen werden.' : 'Unable to assign participants.'));
        return;
      }
      setBreakoutSession(assignResult.data?.session ?? createdSession);

      const startResult = await fetchJsonWithRetry<BreakoutSessionResponse>(
        `/api/meetings/${encodeURIComponent(activeMeetingId)}/breakouts/sessions/${encodeURIComponent(createdSession.sessionId)}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start',
            countdownSeconds: 0,
            participants: participantsForStart,
          }),
        },
      );
      if (startResult.unauthorized) {
        setSessionExpired(true);
        return;
      }
      if (!startResult.ok) {
        showAction(startResult.error ?? (isGerman ? 'Breakout konnte nicht gestartet werden.' : 'Unable to start breakout.'));
        return;
      }
      setBreakoutSession(startResult.data?.session ?? null);

      const mergeResult = await fetchJsonWithRetry<BreakoutSessionResponse>(
        `/api/meetings/${encodeURIComponent(activeMeetingId)}/breakouts/sessions/${encodeURIComponent(createdSession.sessionId)}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mergeAll',
            countdownSeconds: parsedDurationMinutes * 60,
          }),
        },
      );
      if (mergeResult.unauthorized) {
        setSessionExpired(true);
        return;
      }
      if (!mergeResult.ok) {
        showAction(mergeResult.error ?? (isGerman ? 'Automatische Rueckkehr konnte nicht geplant werden.' : 'Unable to schedule automatic return.'));
        return;
      }

      setBreakoutSession(mergeResult.data?.session ?? startResult.data?.session ?? null);
      setBreakoutSetupOpen(false);
      showAction(isGerman
        ? `Breakout gestartet. Automatische Rueckkehr in ${parsedDurationMinutes} Minuten.`
        : `Breakout started. Automatic return in ${parsedDurationMinutes} minutes.`);
    } finally {
      setBreakoutQuickBusy(false);
    }
  };

  const handleQuickBreakoutToggle = async () => {
    if (!isModeratorUser || breakoutQuickBusy) {
      return;
    }

    setBreakoutQuickBusy(true);
    try {
      if (breakoutIsSplit && breakoutSession) {
        const result = await fetchJsonWithRetry<BreakoutSessionResponse>(
          `/api/meetings/${encodeURIComponent(activeMeetingId)}/breakouts/sessions/${encodeURIComponent(breakoutSession.sessionId)}/actions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'mergeAll',
              countdownSeconds: 15,
            }),
          },
        );
        if (result.unauthorized) {
          setSessionExpired(true);
          return;
        }
        if (!result.ok) {
          showAction(result.error ?? (isGerman ? 'Breakout-Raeume konnten nicht zusammengefuehrt werden.' : 'Unable to merge breakout rooms.'));
          return;
        }
        setBreakoutSession(result.data?.session ?? null);
        showAction(isGerman ? 'Alle Breakout-Raeume werden in 15 Sekunden zusammengefuehrt.' : 'All breakout rooms will merge in 15 seconds.');
        return;
      }

      openBreakoutSetup();
    } finally {
      setBreakoutQuickBusy(false);
    }
  };

  if (showAuthGate) {
    return (
      <LiveStateGate
        eyebrow={isGerman ? 'Live Meeting' : 'Live meeting'}
        isLight={isLight}
        message={isGerman ? 'Melde dich an, um diesem Meeting beizutreten. Danach fuegen wir dich automatisch als Teilnehmer hinzu.' : 'Sign in to join this meeting. After that, we will add you as a participant automatically.'}
        title={isGerman ? 'Anmeldung erforderlich' : 'Sign in required'}
      >
        <Link
          href={signInHref}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#1a73e8] px-6 text-sm font-bold text-white transition hover:bg-[#175ec0]"
        >
          {isGerman ? 'Anmelden und beitreten' : 'Sign in and join'}
        </Link>
        <Link
          href={`/meet?meetingId=${encodeURIComponent(activeMeetingId)}`}
          className="inline-flex min-h-12 items-center justify-center rounded-full border px-6 text-sm font-bold"
          style={{
            borderColor: isLight ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.18)',
            color: isLight ? '#0f172a' : '#f8fafc',
          }}
        >
          {isGerman ? 'Zurueck' : 'Back'}
        </Link>
      </LiveStateGate>
    );
  }

  if (showMissingMeetingGate) {
    return (
      <LiveStateGate
        eyebrow={activeMeetingId.toLowerCase()}
        isLight={isLight}
        message={isGerman
          ? 'Dieser Link zeigt auf ein Meeting, das auf diesem lokalen Server nicht mehr vorhanden ist. Kehre zum Meet Workspace zurueck und starte ein neues Meeting.'
          : 'This link points to a meeting that is no longer available on this local server. Return to Meet and start a fresh meeting.'}
        title={isGerman ? 'Meeting nicht gefunden' : 'Meeting not found'}
      >
        <Link
          href="/meet"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#1a73e8] px-6 text-sm font-bold text-white transition hover:bg-[#175ec0]"
        >
          {isGerman ? 'Zurueck zu Meet' : 'Back to Meet'}
        </Link>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-12 items-center justify-center rounded-full border px-6 text-sm font-bold"
          style={{
            borderColor: isLight ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.18)',
            color: isLight ? '#0f172a' : '#f8fafc',
          }}
        >
          {isGerman ? 'Erneut versuchen' : 'Retry'}
        </button>
      </LiveStateGate>
    );
  }

  if (selfJoinError) {
    return (
      <LiveStateGate
        eyebrow={roomCode.toLowerCase()}
        isLight={isLight}
        message={selfJoinError}
        title={isGerman ? 'Beitritt nicht moeglich' : 'Unable to join'}
      >
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#1a73e8] px-6 text-sm font-bold text-white transition hover:bg-[#175ec0]"
        >
          {isGerman ? 'Erneut versuchen' : 'Retry'}
        </button>
        <Link
          href={`/meet?meetingId=${encodeURIComponent(activeMeetingId)}`}
          className="inline-flex min-h-12 items-center justify-center rounded-full border px-6 text-sm font-bold"
          style={{
            borderColor: isLight ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.18)',
            color: isLight ? '#0f172a' : '#f8fafc',
          }}
        >
          {isGerman ? 'Zurueck' : 'Back'}
        </Link>
      </LiveStateGate>
    );
  }

  if (showPreparingGate) {
    return (
      <LiveStateGate
        eyebrow={roomCode.toLowerCase()}
        isLight={isLight}
        loading
        message={networkRiskChecking
          ? (isGerman ? 'Wir pruefen, ob deine Verbindung ueber VPN oder Proxy laeuft.' : 'Checking whether your connection is using VPN or proxy.')
          : (isGerman ? 'Wir pruefen deine Sitzung und bereiten den Meeting-Raum vor.' : 'We are checking your session and preparing the meeting room.')}
        title={networkRiskChecking ? (isGerman ? 'Netzwerk wird geprueft' : 'Checking network') : (isGerman ? 'Meeting wird vorbereitet' : 'Preparing meeting')}
      >
        <Link
          href={`/meet?meetingId=${encodeURIComponent(activeMeetingId)}`}
          className="inline-flex min-h-12 items-center justify-center rounded-full border px-6 text-sm font-bold"
          style={{
            borderColor: isLight ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.18)',
            color: isLight ? '#0f172a' : '#f8fafc',
          }}
        >
          {isGerman ? 'Zurueck' : 'Back'}
        </Link>
      </LiveStateGate>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: pageBg, color: shellText }}>
      {breakoutSetupOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
          <section
            className="max-h-[92vh] w-full max-w-[980px] overflow-hidden rounded-[26px] border shadow-[0_30px_90px_rgba(0,0,0,0.38)]"
            style={{
              borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.14)',
              background: isLight ? '#f8fafc' : '#0f172a',
              color: isLight ? '#0f172a' : '#f8fafc',
            }}
          >
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.12)' }}>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: isLight ? '#2563eb' : '#93c5fd' }}>
                  {isGerman ? 'Breakout Setup' : 'Breakout Setup'}
                </p>
                <h2 className="mt-1 text-2xl font-black">{isGerman ? 'Raeume aufteilen' : 'Split Rooms'}</h2>
                <p className="mt-1 text-sm" style={{ color: isLight ? '#475569' : '#cbd5e1' }}>
                  {isGerman
                    ? 'Waehle Teilnehmer, Raumzuweisung, Room Leads und automatische Rueckkehr.'
                    : 'Choose participants, room placement, room leads, and automatic return time.'}
                </p>
              </div>
              <button
                type="button"
                aria-label={isGerman ? 'Breakout Setup schliessen' : 'Close breakout setup'}
                onClick={() => setBreakoutSetupOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border"
                style={{
                  borderColor: isLight ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.16)',
                  background: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(15,23,42,0.8)',
                }}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="max-h-[calc(92vh-156px)] overflow-y-auto px-5 py-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
                <div className="rounded-2xl border p-4" style={{ borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)', background: isLight ? '#ffffff' : 'rgba(15,23,42,0.7)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black">{isGerman ? 'Teilnehmer hinzufuegen' : 'Add Participants'}</p>
                    <span className="text-xs font-semibold" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                      {breakoutSetupParticipants.length} {isGerman ? 'ausgewaehlt' : 'selected'}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {assignableBreakoutParticipants.map((participant) => {
                      const selected = breakoutSelectedParticipantIds.includes(participant.id);
                      const roomKey = breakoutRoomByParticipantId[participant.id] ?? '1';
                      const isLead = breakoutLeadByRoom[roomKey] === participant.id;
                      const networkParticipant = liveParticipants.find((entry) => toStableParticipantId(entry.id) === participant.id);
                      const networkTone = getNetworkTone(getParticipantNetworkLevel(networkParticipant), isGerman, isLight);
                      return (
                        <div
                          key={participant.id}
                          className="rounded-2xl border px-3 py-3"
                          style={{
                            borderColor: selected ? networkTone.border : (isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.1)'),
                            background: selected ? (isLight ? 'rgba(26,115,232,0.08)' : 'rgba(30,64,175,0.24)') : (isLight ? 'rgba(248,250,252,0.86)' : 'rgba(2,6,23,0.34)'),
                            boxShadow: selected ? `inset 4px 0 0 ${networkTone.dot}` : undefined,
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <label className="flex min-w-0 items-start gap-3">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={selected}
                                onChange={() => toggleBreakoutSetupParticipant(participant.id)}
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-black">{participant.displayName}</span>
                                <span className="block text-xs" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                                  {isLead ? ROOM_LEAD_ROLE : participant.role}
                                </span>
                              </span>
                            </label>
                            {isLead ? (
                              <span className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ background: isLight ? '#dcfce7' : 'rgba(22,101,52,0.35)', color: isLight ? '#166534' : '#86efac' }}>
                                {isGerman ? 'Lead' : 'Lead'}
                              </span>
                            ) : null}
                          </div>
                          <div
                            className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold"
                            style={{ borderColor: networkTone.border, background: networkTone.bg, color: networkTone.color }}
                            title={formatParticipantNetworkDetails(networkParticipant ?? { network: null }, networkTone.label)}
                          >
                            <span className="h-2 w-2 rounded-full" style={{ background: networkTone.dot }} />
                            <span className="truncate">
                              {isGerman ? 'Netzwerk' : 'Network'}: {networkTone.label}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {(['1', '2'] as const).map((targetRoom) => (
                              <button
                                key={targetRoom}
                                type="button"
                                disabled={!selected}
                                onClick={() => setBreakoutSetupRoom(participant.id, targetRoom)}
                                className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50"
                                style={{
                                  borderColor: roomKey === targetRoom && selected ? 'rgba(26,115,232,0.45)' : (isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)'),
                                  background: roomKey === targetRoom && selected ? (isLight ? '#dbeafe' : 'rgba(30,64,175,0.36)') : 'transparent',
                                  color: roomKey === targetRoom && selected ? (isLight ? '#1d4ed8' : '#bfdbfe') : (isLight ? '#334155' : '#cbd5e1'),
                                }}
                              >
                                {isGerman ? `Raum ${targetRoom}` : `Room ${targetRoom}`}
                              </button>
                            ))}
                          </div>
                          {selected ? (
                            <button
                              type="button"
                              onClick={() => setBreakoutSetupLead(participant.id, roomKey)}
                              className="mt-2 w-full rounded-xl border px-3 py-2 text-xs font-bold"
                              style={{
                                borderColor: isLead ? 'rgba(16,185,129,0.38)' : (isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)'),
                                background: isLead ? (isLight ? 'rgba(16,185,129,0.12)' : 'rgba(5,150,105,0.2)') : 'transparent',
                                color: isLead ? (isLight ? '#047857' : '#6ee7b7') : (isLight ? '#334155' : '#cbd5e1'),
                              }}
                            >
                              {isLead ? (isGerman ? 'Room Lead' : 'Room Lead') : (isGerman ? 'Als Room Lead setzen' : 'Set as Room Lead')}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <aside className="rounded-2xl border p-4" style={{ borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)', background: isLight ? '#ffffff' : 'rgba(15,23,42,0.7)' }}>
                  <p className="text-sm font-black">{isGerman ? 'Dauer und Kontrolle' : 'Duration and Control'}</p>
                  <label className="mt-4 block text-xs font-black uppercase tracking-[0.16em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                    {isGerman ? 'Rueckkehr nach Minuten' : 'Return after minutes'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={breakoutDurationMinutes}
                    onChange={(event) => setBreakoutDurationMinutes(event.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border px-4 text-sm font-bold outline-none"
                    style={{
                      borderColor: isLight ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.16)',
                      background: isLight ? '#f8fafc' : '#020617',
                      color: isLight ? '#0f172a' : '#f8fafc',
                    }}
                  />
                  <div className="mt-4 space-y-3 text-xs" style={{ color: isLight ? '#475569' : '#cbd5e1' }}>
                    {(['1', '2'] as const).map((roomKey) => {
                      const roomParticipants = breakoutSetupParticipants.filter((participant) => (breakoutRoomByParticipantId[participant.id] ?? '1') === roomKey);
                      const lead = roomParticipants.find((participant) => participant.id === breakoutLeadByRoom[roomKey]);
                      return (
                        <div key={roomKey} className="rounded-2xl border p-3" style={{ borderColor: isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.1)', background: isLight ? 'rgba(248,250,252,0.86)' : 'rgba(2,6,23,0.32)' }}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black" style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>{isGerman ? `Raum ${roomKey}` : `Room ${roomKey}`}</span>
                            <span>{roomParticipants.length} {isGerman ? 'Personen' : 'people'}</span>
                          </div>
                          <p className="mt-2 font-semibold">
                            {isGerman ? 'Room Lead: ' : 'Room lead: '}
                            <span style={{ color: lead ? (isLight ? '#047857' : '#6ee7b7') : (isLight ? '#b45309' : '#fcd34d') }}>
                              {lead?.displayName ?? (isGerman ? 'nicht gesetzt' : 'not set')}
                            </span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </aside>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4" style={{ borderColor: isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.12)' }}>
              <p className="max-w-[620px] text-xs" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                {isGerman
                  ? 'Nur Room Leads koennen eine fruehe Merge-Anfrage stellen. Alle Raeume kehren nach der gesetzten Dauer automatisch zurueck.'
                  : 'Only room leads can request an early merge. All rooms automatically return after the selected duration.'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBreakoutSetupOpen(false)}
                  className="rounded-2xl border px-4 py-3 text-sm font-bold"
                  style={{
                    borderColor: isLight ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.16)',
                    color: isLight ? '#334155' : '#cbd5e1',
                  }}
                >
                  {isGerman ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => { void handleStartBreakoutFromSetup(); }}
                  disabled={breakoutQuickBusy}
                  className="rounded-2xl bg-[#1a73e8] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  {breakoutQuickBusy ? (isGerman ? 'Startet...' : 'Starting...') : (isGerman ? 'Raeume starten' : 'Start Rooms')}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
      <div className="mx-auto flex h-[calc(100dvh-1rem)] max-w-[1500px] px-4 py-2 md:h-[calc(100dvh-1.5rem)] md:px-6 md:py-3">
        <section
          ref={liveShellRef}
          className="relative flex-1 overflow-hidden rounded-[26px] border shadow-[0_30px_80px_rgba(0,0,0,0.20)]"
          style={{ borderColor: shellBorder, background: shellBg }}
        >
          {(syncError || isSyncing) ? (
            <div
              className="absolute inset-x-5 top-4 z-20 flex items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-xs"
              style={{
                borderColor: isLight ? 'rgba(220,38,38,0.24)' : 'rgba(248,113,113,0.32)',
                background: isLight ? 'rgba(254,242,242,0.9)' : 'rgba(127,29,29,0.42)',
                color: isLight ? '#7f1d1d' : '#fecaca',
              }}
            >
              <span>{syncError || (isGerman ? 'Live-Steuerung wird synchronisiert...' : 'Syncing live controls...')}</span>
              <button
                type="button"
                onClick={() => { void syncRoomNow(); }}
                className="rounded-full border px-3 py-1 font-semibold"
                style={{
                  borderColor: isLight ? 'rgba(220,38,38,0.30)' : 'rgba(248,113,113,0.42)',
                  background: isLight ? 'rgba(255,255,255,0.84)' : 'rgba(255,255,255,0.10)',
                }}
              >
                {isGerman ? 'Erneut versuchen' : 'Retry'}
              </button>
            </div>
          ) : null}

          <div
            className="absolute inset-x-5 top-[76px] bottom-[210px] rounded-[30px] border"
            style={{ borderColor: stageBorder, background: stageBg }}
          />

          {inviteOpen && selfJoinReady ? (
            <aside
              className="absolute left-5 top-24 z-40 w-[300px] max-w-[calc(100%-2.5rem)] rounded-2xl p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] md:left-8"
              style={{
                background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.94)',
                color: isLight ? '#1f2937' : '#f8fafc',
                border: `1px solid ${isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.14)'}`,
              }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{isGerman ? 'Dein Meeting ist bereit' : "Your meeting's ready"}</h2>
                <button
                  type="button"
                  aria-label={isGerman ? 'Einladungskarte schliessen' : 'Close invite card'}
                  onClick={() => setInviteOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full transition"
                  style={{
                    color: isLight ? '#374151' : '#e2e8f0',
                    background: 'transparent',
                  }}
                >
                  <CloseIcon />
                </button>
              </div>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1a73e8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#175ec0]"
                  onClick={() => void copyInviteLink()}
                >
                  <AddUserIcon />
                {isGerman ? 'Einladung kopieren' : 'Copy invite'}
                </button>
                <p className="mt-3 text-sm leading-6" style={{ color: isLight ? '#374151' : '#cbd5e1' }}>
                {isGerman ? 'Teile diesen Link mit Personen, die in dieses lokale Meeting kommen sollen.' : 'Share this link with people you want to join this local meeting.'}
              </p>
              <div
                className="mt-3 flex items-center justify-between rounded-lg px-3 py-2.5"
                style={{ background: isLight ? '#f2f3f5' : 'rgba(255,255,255,0.07)' }}
              >
                <span className="truncate pr-3 text-xs font-semibold" style={{ color: isLight ? '#303030' : '#f8fafc' }}>{inviteLink}</span>
                <button
                  type="button"
                  aria-label={isGerman ? 'Einladungslink kopieren' : 'Copy invite link'}
                  onClick={copyInviteLink}
                  className="rounded-md p-2 transition"
                  style={{ color: isLight ? '#202124' : '#e2e8f0' }}
                >
                  <CopyIcon />
                </button>
              </div>
              <div className="mt-3 flex items-start gap-3" style={{ color: isLight ? '#4b5563' : '#cbd5e1' }}>
                <div
                  className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: isLight ? '#e8f0fe' : 'rgba(96,165,250,0.16)', color: isLight ? '#1a73e8' : '#93c5fd' }}
                >
                  <ShieldIcon />
                </div>
                <p className="text-xs leading-5">
                  {isGerman ? 'Personen, die diesen Meeting-Link nutzen, brauchen deine Freigabe, bevor sie beitreten koennen.' : 'People who use this meeting link must get your permission before they can join.'}
                </p>
              </div>
              <p className="mt-3 truncate text-xs" style={{ color: isLight ? '#4b5563' : '#94a3b8' }}>{isGerman ? 'Beigetreten als' : 'Joined as'} {joinedAsLabel}</p>
              {copyMessage ? <p className="mt-3 text-sm font-semibold" style={{ color: isLight ? '#1a73e8' : '#93c5fd' }}>{copyMessage}</p> : null}
            </aside>
          ) : null}

          <div className="relative z-10 h-full min-h-0">
            <div className="absolute left-5 right-5 top-5 z-30 flex flex-col items-end gap-2 md:left-7 md:right-7">
              <div className="flex flex-wrap justify-end gap-2">
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                  style={{
                    borderColor: isLight ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.16)',
                    background: isLight ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.72)',
                    color: isLight ? '#0f172a' : '#f8fafc',
                  }}
                  title={participantLabel}
                >
                  <PeopleIcon />
                  {participantLabel}
                </span>
                <NetworkQualityBadge compact isLight={isLight} showDetails={false} />
                {networkRisk?.status === 'unverified' ? (
                  <span
                    className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold"
                    style={{
                      borderColor: 'rgba(245,158,11,0.42)',
                      background: isLight ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.72)',
                      color: isLight ? '#92400e' : '#fcd34d',
                    }}
                    title={networkRisk.reason}
                  >
                    {isGerman ? 'VPN-Pruefung offen' : 'VPN check unverified'}
                  </span>
                ) : null}
                {activeBreakoutRoomId ? (
                  <span
                    className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold"
                    style={{
                      borderColor: 'rgba(59,130,246,0.4)',
                      background: isLight ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.72)',
                      color: isLight ? '#1d4ed8' : '#93c5fd',
                    }}
                  >
                    {activeBreakoutRoom?.status === 'closing'
                      ? (isGerman ? `${activeBreakoutRoom.name} | Merge ${activeBreakoutRoom.secondsUntilMerge}s` : `${activeBreakoutRoom.name} | merge ${activeBreakoutRoom.secondsUntilMerge}s`)
                      : activeBreakoutRoom?.name ?? `Breakout ${activeBreakoutRoomId}`}
                  </span>
                ) : null}
                {isModeratorUser && breakoutIsSplit ? (
                  <span
                    className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold"
                    style={{
                      borderColor: 'rgba(59,130,246,0.4)',
                      background: isLight ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.72)',
                      color: isLight ? '#1d4ed8' : '#93c5fd',
                    }}
                  >
                    {isGerman
                      ? `${openBreakoutRooms.length} Raeume aktiv`
                      : `${openBreakoutRooms.length} rooms active`}
                  </span>
                ) : null}
                {isModeratorUser && breakoutHelpRequestCount > 0 ? (
                  <span
                    className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold"
                    style={{
                      borderColor: 'rgba(245,158,11,0.42)',
                      background: isLight ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.72)',
                      color: isLight ? '#92400e' : '#fcd34d',
                    }}
                  >
                    {isGerman
                      ? `${breakoutHelpRequestCount} Hilfeanfrage${breakoutHelpRequestCount === 1 ? '' : 'n'}`
                      : `${breakoutHelpRequestCount} help request${breakoutHelpRequestCount === 1 ? '' : 's'}`}
                  </span>
                ) : null}
                {isModeratorUser && breakoutMergeRequestCount > 0 ? (
                  <span
                    className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold"
                    style={{
                      borderColor: 'rgba(59,130,246,0.42)',
                      background: isLight ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.72)',
                      color: isLight ? '#1d4ed8' : '#93c5fd',
                    }}
                  >
                    {isGerman
                      ? `${breakoutMergeRequestCount} Merge-Anfrage${breakoutMergeRequestCount === 1 ? '' : 'n'}`
                      : `${breakoutMergeRequestCount} merge request${breakoutMergeRequestCount === 1 ? '' : 's'}`}
                  </span>
                ) : null}
                <span
                  className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold"
                  style={{
                    borderColor: sfuConnected ? 'rgba(16,185,129,0.38)' : 'rgba(148,163,184,0.34)',
                    background: isLight ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.72)',
                    color: sfuConnected ? '#10b981' : (isLight ? '#475569' : '#cbd5e1'),
                  }}
                  title={sfuConnected
                    ? (isGerman ? 'Live-Medien sind verbunden.' : 'Live media is connected.')
                    : (isGerman ? 'Kamera, Mikrofon und Teilen werden auf diesem Geraet gesteuert.' : 'Camera, microphone, and sharing are controlled on this device.')}
                >
                  {mediaStatusLabel}
                </span>
                {isModeratorUser ? (
                  <button
                    aria-pressed={!roomLocked}
                    className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:scale-[1.02]"
                    onClick={() => { void handleToggleRoomLock(); }}
                    style={{
                      borderColor: roomLocked ? 'rgba(239,68,68,0.45)' : 'rgba(16,185,129,0.38)',
                      background: isLight ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.72)',
                      color: roomLocked ? '#ef4444' : '#10b981',
                    }}
                    title={roomLocked
                      ? (isGerman ? 'Raum fuer Teilnehmer oeffnen' : 'Open room for attendees')
                      : (isGerman ? 'Raum fuer neue Teilnehmer schliessen' : 'Close room for new attendees')}
                    type="button"
                  >
                    {roomLocked ? (isGerman ? 'Raum oeffnen' : 'Open room') : (isGerman ? 'Raum schliessen' : 'Close room')}
                  </button>
                ) : null}
              </div>
              {breakoutSession && (activeBreakoutRoom || breakoutNotice) ? (
                <div
                  className="max-w-[360px] rounded-[24px] border px-4 py-3 backdrop-blur"
                  style={{ borderColor: overlayPanelBorder, background: overlayPanelBg }}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: statusText }}>
                    {breakoutSession?.latestAnnouncement
                      ? formatBreakoutAnnouncementType(breakoutSession.latestAnnouncement.type, isGerman ? 'de' : 'en')
                      : activeBreakoutRoom
                        ? (isGerman ? 'Breakout-Status' : 'Breakout Status')
                        : (isGerman ? 'Breakout-Hinweis' : 'Breakout Notice')}
                  </p>
                  {activeBreakoutRoom ? (
                    <p className="mt-2 text-sm font-bold" style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>
                      {activeBreakoutRoom.status === 'closing'
                        ? (isGerman ? `Rueckkehr zum Hauptraum in ${activeBreakoutRoom.secondsUntilMerge}s` : `Returning to the main room in ${activeBreakoutRoom.secondsUntilMerge}s`)
                        : activeBreakoutRoom.status === 'merged'
                          ? (isGerman ? 'Raum wurde in den Hauptraum zurueckgefuehrt' : 'Room merged back to the main room')
                      : (isGerman ? `${activeBreakoutRoom.name} ist live` : `${activeBreakoutRoom.name} is live`)}
                    </p>
                  ) : null}
                  {breakoutNotice ? (
                    <p className="mt-2 text-xs leading-5" style={{ color: statusText }}>
                      {breakoutNotice.message}
                    </p>
                  ) : null}
                  {activeBreakoutHelpRequest ? (
                    <p className="mt-2 text-[11px] font-semibold" style={{ color: isLight ? '#92400e' : '#fcd34d' }}>
                      {activeBreakoutHelpRequest.kind === 'merge'
                        ? (isGerman ? 'Merge-Anfrage gesendet um ' : 'Merge requested at ')
                        : (isGerman ? 'Host-Hilfe angefragt um ' : 'Host help requested at ')}
                      {new Date(activeBreakoutHelpRequest.requestedAt).toLocaleTimeString(locale)}.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="absolute inset-x-5 top-[76px] bottom-[210px] overflow-hidden rounded-[30px] md:inset-x-7">
              {sfuConnected ? (
                <SfuMeetingStage
                  hostName={hostName}
                  isLight={isLight}
                  localParticipantId={localParticipantId}
                  participants={sfu.participants}
                  room={sfu.room}
                  title={title}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    {activeLocalPreviewStream ? (
                      <video
                        ref={localPreviewVideoRef}
                        autoPlay
                        className="h-[min(52vh,420px)] w-[min(72vw,760px)] rounded-[32px] border border-white/25 object-cover shadow-[0_22px_70px_rgba(15,23,42,0.28)]"
                        muted
                        playsInline
                      />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-[36px] border border-white/20 bg-[radial-gradient(circle_at_30%_20%,#34d399,#0ea5e9_65%,#0f172a)] text-4xl font-semibold text-white shadow-[0_18px_48px_rgba(0,0,0,0.42)]">
                        Z
                      </div>
                    )}
                    <div
                      className="rounded-full px-4 py-1.5 text-sm font-semibold backdrop-blur"
                      style={{
                        background: overlayPanelBg,
                        border: `1px solid ${overlayPanelBorder}`,
                        color: isLight ? '#0f172a' : 'rgba(255,255,255,0.95)',
                      }}
                    >
                      {title} <span style={{ color: isLight ? '#64748b' : 'rgba(255,255,255,0.55)' }}>|</span> {hostName}
                    </div>
                    {isOnlyParticipant ? (
                      <div
                        className="rounded-full px-4 py-1.5 text-xs font-bold backdrop-blur"
                        style={{
                          background: overlayPanelBg,
                          border: `1px solid ${overlayPanelBorder}`,
                          color: isLight ? '#334155' : 'rgba(255,255,255,0.78)',
                        }}
                      >
                        {isGerman ? 'Nur du bist im Meeting' : 'You are the only one here'}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="absolute bottom-5 left-0 right-0 z-30 px-5 md:px-7">
              <div
                className="rounded-[28px] border p-3 shadow-[0_18px_45px_rgba(15,23,42,0.12)]"
                style={{
                  borderColor: isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.12)',
                  background: isLight ? 'rgba(248,250,252,0.94)' : 'rgba(15,23,42,0.82)',
                }}
              >
              <div className="grid gap-3 xl:grid-cols-[minmax(320px,1fr)_minmax(0,auto)_minmax(120px,1fr)] xl:items-center">
                <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm font-semibold md:text-base" style={{ color: isLight ? '#0f172a' : 'rgba(255,255,255,0.95)' }}>
                  <span>{clockLabel}</span>
                  <span className="h-5 w-px" style={{ background: isLight ? 'rgba(15,23,42,0.22)' : 'rgba(255,255,255,0.22)' }} />
                  <span className="min-w-[220px] max-w-full font-medium leading-6" style={{ color: isLight ? '#475569' : 'rgba(255,255,255,0.72)' }}>
                    {isGerman ? 'Meeting-Code' : 'Meeting code'}{' '}
                    <span className="font-semibold tabular-nums" style={{ color: isLight ? '#0f172a' : '#f8fafc', overflowWrap: 'anywhere' }}>
                      {roomCode.toUpperCase()}
                    </span>
                  </span>
                </div>

                <div className="min-w-0">
                <div className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-3 px-1">
                  <MeetingControlButton
                    isLight={isLight}
                    label={utilityExpanded ? (isGerman ? 'Schnellsteuerung einklappen' : 'Collapse quick controls') : (isGerman ? 'Schnellsteuerung ausklappen' : 'Expand quick controls')}
                    caption={isGerman ? 'Tools' : 'Tools'}
                    active={utilityExpanded}
                    onClick={() => {
                      setUtilityExpanded((prev) => {
                        const next = !prev;
                        showAction(next ? (isGerman ? 'Schnellsteuerung ausgeklappt.' : 'Quick controls expanded.') : (isGerman ? 'Schnellsteuerung eingeklappt.' : 'Quick controls collapsed.'));
                        return next;
                      });
                    }}
                  >
                    <UpArrowIcon />
                  </MeetingControlButton>
                  <MeetingControlButton
                    isLight={isLight}
                    label={isFullscreen ? (isGerman ? 'Vollbild verlassen' : 'Exit full screen') : (isGerman ? 'Vollbild' : 'Full screen')}
                    caption={isGerman ? 'Vollbild' : 'Full'}
                    active={isFullscreen}
                    onClick={() => { void toggleFullscreen(); }}
                  >
                    <FullscreenIcon />
                  </MeetingControlButton>
                  <MeetingControlButton
                    isLight={isLight}
                    label={micOn ? (isGerman ? 'Mikro stummschalten' : 'Mute mic') : (isGerman ? 'Mikro einschalten' : 'Unmute mic')}
                    caption={isGerman ? 'Mikro' : 'Mic'}
                    active={micOn}
                    disabled={mediaControlsDisabled}
                    onClick={() => void toggleField('microphone', micOn)}
                  >
                    <MicIcon />
                  </MeetingControlButton>
                  <MeetingControlButton
                    isLight={isLight}
                    label={camOn ? (isGerman ? 'Kamera ausschalten' : 'Turn camera off') : (isGerman ? 'Kamera einschalten' : 'Turn camera on')}
                    caption={isGerman ? 'Kamera' : 'Camera'}
                    active={camOn}
                    disabled={mediaControlsDisabled}
                    onClick={() => void toggleField('camera', camOn)}
                  >
                    <CamIcon />
                  </MeetingControlButton>
                  <MeetingControlButton
                    isLight={isLight}
                    label={shareOn ? (isGerman ? 'Teilen stoppen' : 'Stop sharing') : (isGerman ? 'Bildschirm teilen' : 'Share screen')}
                    caption={isGerman ? 'Teilen' : 'Share'}
                    active={shareOn}
                    disabled={mediaControlsDisabled}
                    onClick={() => void toggleField('screenShare', shareOn)}
                  >
                    <ScreenIcon />
                  </MeetingControlButton>
                  <MeetingControlButton
                    isLight={isLight}
                    label={captionsOn ? (isGerman ? 'Untertitel deaktivieren' : 'Disable captions') : (isGerman ? 'Untertitel aktivieren' : 'Enable captions')}
                    caption={isGerman ? 'Untertitel' : 'Captions'}
                    active={captionsOn}
                    onClick={() => {
                      setCaptionsOn((prev) => {
                        const next = !prev;
                        showAction(next ? (isGerman ? 'Live-Untertitel aktiviert.' : 'Live captions enabled.') : (isGerman ? 'Live-Untertitel deaktiviert.' : 'Live captions disabled.'));
                        return next;
                      });
                    }}
                  >
                    <CaptionIcon />
                  </MeetingControlButton>
                  <MeetingControlButton
                    isLight={isLight}
                    label={activeBreakoutRoomId && !isModeratorUser
                      ? (activeBreakoutSupportRequest ? (isGerman ? 'Host-Hilfeanfrage abbrechen' : 'Cancel host help request') : (isGerman ? 'Host-Hilfe anfragen' : 'Request host help'))
                      : (handRaised ? (isGerman ? 'Hand senken' : 'Lower hand') : (isGerman ? 'Hand heben' : 'Raise hand'))}
                    caption={activeBreakoutRoomId && !isModeratorUser ? (isGerman ? 'Hilfe' : 'Help') : (isGerman ? 'Hand' : 'Hand')}
                    active={activeBreakoutRoomId && !isModeratorUser ? Boolean(activeBreakoutSupportRequest) : handRaised}
                    onClick={() => {
                      if (activeBreakoutRoomId && !isModeratorUser) {
                        if (breakoutHelpBusy) {
                          return;
                        }
                        void handleBreakoutHelpToggle();
                        return;
                      }
                      setHandRaised((prev) => {
                        const next = !prev;
                        showAction(next ? (isGerman ? 'Hand gehoben.' : 'Hand raised.') : (isGerman ? 'Hand gesenkt.' : 'Hand lowered.'));
                        return next;
                      });
                    }}
                  >
                    <HandIcon />
                  </MeetingControlButton>
                  {activeBreakoutRoomId && !isModeratorUser && isActiveRoomLead ? (
                    <MeetingControlButton
                      isLight={isLight}
                      label={activeBreakoutMergeRequest
                        ? (isGerman ? 'Merge-Anfrage zurueckziehen' : 'Cancel merge request')
                        : (isGerman ? 'Host um Merge bitten' : 'Request room merge')}
                      caption={activeBreakoutMergeRequest ? (isGerman ? 'Angefragt' : 'Asked') : (isGerman ? 'Merge' : 'Merge')}
                      active={Boolean(activeBreakoutMergeRequest)}
                      onClick={() => {
                        if (breakoutHelpBusy) {
                          return;
                        }
                        void handleBreakoutMergeRequest();
                      }}
                    >
                      <MergeIcon />
                    </MeetingControlButton>
                  ) : null}
                  {isModeratorUser ? (
                    <MeetingControlButton
                      isLight={isLight}
                      label={breakoutIsSplit
                        ? (isGerman ? 'Breakout-Raeume zusammenfuehren' : 'Merge breakout rooms')
                        : canQuickSplitBreakout
                          ? (isGerman ? 'Teilnehmer in zwei Raeume aufteilen' : 'Split participants into two rooms')
                          : (isGerman ? 'Zum Aufteilen werden mindestens zwei weitere Teilnehmer benoetigt' : 'Split needs at least two other attendees')}
                      caption={breakoutQuickBusy
                        ? (isGerman ? 'Warten' : 'Wait')
                        : breakoutIsSplit
                          ? (isGerman ? 'Merge' : 'Merge')
                          : (isGerman ? 'Split' : 'Split')}
                      active={breakoutIsSplit || breakoutQuickBusy}
                      disabled={!breakoutIsSplit && !canQuickSplitBreakout}
                      onClick={() => void handleQuickBreakoutToggle()}
                    >
                      {breakoutIsSplit ? <MergeIcon /> : <SplitIcon />}
                    </MeetingControlButton>
                  ) : null}
                  <MeetingControlButton
                    isLight={isLight}
                    label={optionsOpen ? (isGerman ? 'Optionen schliessen' : 'Close options') : (isGerman ? 'Mehr Optionen' : 'More options')}
                    caption={isGerman ? 'Mehr' : 'More'}
                    active={optionsOpen}
                    onClick={() => {
                      setOptionsOpen((prev) => {
                        const next = !prev;
                        showAction(next ? (isGerman ? 'Meeting-Optionen geoeffnet.' : 'Meeting options opened.') : (isGerman ? 'Meeting-Optionen geschlossen.' : 'Meeting options closed.'));
                        return next;
                      });
                    }}
                  >
                    <DotsIcon />
                  </MeetingControlButton>
                </div>
                </div>

                <div className="flex items-center justify-start gap-3 xl:justify-end" style={{ color: isLight ? '#0f172a' : 'rgba(255,255,255,0.9)' }}>
                  <Link
                    href={`/meet?meetingId=${encodeURIComponent(activeMeetingId)}`}
                    className="inline-flex h-12 min-w-24 items-center justify-center rounded-[18px] bg-[#ea4335] px-5 text-sm font-semibold text-white transition hover:bg-[#d93025]"
                  >
                    {isGerman ? 'Verlassen' : 'Leave'}
                  </Link>
                  <div className="hidden items-center gap-3 2xl:flex">
                  <UtilityPill isLight={isLight} label={isGerman ? 'Info' : 'Info'} onClick={() => {
                    setInviteOpen(true);
                    showAction(isGerman ? 'Meeting-Info geoeffnet.' : 'Meeting info card opened.');
                  }}
                  >
                    <InfoIcon />
                  </UtilityPill>
                  <UtilityPill isLight={isLight} label={isGerman ? 'Chat' : 'Chat'} onClick={() => {
                    router.push(`/chat?meetingId=${encodeURIComponent(activeMeetingId)}`);
                  }}
                  >
                    <ChatIcon />
                  </UtilityPill>
                  <UtilityPill isLight={isLight} label={isGerman ? 'Apps' : 'Apps'} onClick={() => {
                    router.push('/settings');
                  }}
                  >
                    <GridIcon />
                  </UtilityPill>
                  {isModeratorUser ? (
                    <UtilityPill isLight={isLight} label={roomLocked ? (isGerman ? 'Raum entsperren' : 'Unlock room') : (isGerman ? 'Raum sperren' : 'Lock room')} onClick={() => { void handleToggleRoomLock(); }}>
                      <LockIcon />
                    </UtilityPill>
                  ) : null}
                  </div>
                </div>
              </div>

              {(utilityExpanded || optionsOpen) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {utilityExpanded ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setInviteOpen(true)}
                        className="rounded-full border px-4 py-2 text-xs font-semibold"
                        style={{
                          borderColor: isLight ? 'rgba(15,23,42,0.2)' : 'rgba(255,255,255,0.2)',
                          color: isLight ? '#0f172a' : '#f8fafc',
                          background: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(15,23,42,0.62)',
                        }}
                      >
                        {isGerman ? 'Einladungskarte oeffnen' : 'Open Invite Card'}
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/chat?meetingId=${encodeURIComponent(activeMeetingId)}`)}
                        className="rounded-full border px-4 py-2 text-xs font-semibold"
                        style={{
                          borderColor: 'rgba(59,130,246,0.4)',
                          color: isLight ? '#1e3a8a' : '#93c5fd',
                          background: isLight ? 'rgba(59,130,246,0.12)' : 'rgba(30,64,175,0.2)',
                        }}
                      >
                        {isGerman ? 'Chat oeffnen' : 'Open Chat'}
                      </button>
                    </>
                  ) : null}

                  {optionsOpen ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void copyInviteLink()}
                        className="rounded-full border px-4 py-2 text-xs font-semibold"
                        style={{
                          borderColor: 'rgba(16,185,129,0.4)',
                          color: isLight ? '#065f46' : '#6ee7b7',
                          background: isLight ? 'rgba(16,185,129,0.12)' : 'rgba(5,150,105,0.2)',
                        }}
                      >
                        {isGerman ? 'Einladungslink kopieren' : 'Copy Invite Link'}
                      </button>
                      {isModeratorUser ? (
                        <>
                          <button
                            type="button"
                            onClick={() => { void handleToggleRoomLock(); }}
                            className="rounded-full border px-4 py-2 text-xs font-semibold"
                            style={{
                              borderColor: 'rgba(244,114,182,0.4)',
                              color: isLight ? '#831843' : '#f9a8d4',
                              background: isLight ? 'rgba(244,114,182,0.12)' : 'rgba(190,24,93,0.2)',
                            }}
                          >
                            {roomLocked ? (isGerman ? 'Raum entsperren' : 'Unlock Room') : (isGerman ? 'Raum sperren' : 'Lock Room')}
                          </button>
                          <div
                            className="rounded-full border px-4 py-2 text-xs font-semibold"
                            style={{
                              borderColor: isLight ? 'rgba(15,23,42,0.2)' : 'rgba(255,255,255,0.2)',
                              color: isLight ? '#334155' : '#cbd5e1',
                              background: isLight ? 'rgba(255,255,255,0.84)' : 'rgba(15,23,42,0.62)',
                            }}
                          >
                            {isGerman ? 'Warteraum' : 'Waiting room'}: {waitingParticipants.length}
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}

              {isModeratorUser && optionsOpen && waitingParticipants.length ? (
                <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: isLight ? 'rgba(15,23,42,0.15)' : 'rgba(255,255,255,0.15)', background: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.58)' }}>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: isLight ? '#475569' : '#94a3b8' }}>
                    {isGerman ? 'Wartende Teilnehmer' : 'Waiting Participants'}
                  </p>
                  <div className="mt-2 space-y-2">
                    {waitingParticipants.slice(0, 4).map((participant) => (
                      <div key={participant.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2" style={{ borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)' }}>
                        <div>
                          <p className="text-xs font-bold" style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>{participant.displayName}</p>
                          <p className="text-[11px]" style={{ color: statusText }}>{participant.role}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { void handleAdmitWaiting(participant.id, participant.displayName); }}
                            className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                            style={{
                              borderColor: 'rgba(16,185,129,0.35)',
                              color: isLight ? '#065f46' : '#6ee7b7',
                              background: isLight ? 'rgba(16,185,129,0.10)' : 'rgba(5,150,105,0.2)',
                            }}
                          >
                            {isGerman ? 'Zulassen' : 'Admit'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { void handleRemoveParticipant(participant.id, participant.displayName); }}
                            className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                            style={{
                              borderColor: 'rgba(239,68,68,0.35)',
                              color: isLight ? '#991b1b' : '#fecaca',
                              background: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(127,29,29,0.28)',
                            }}
                          >
                            {isGerman ? 'Entfernen' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {isModeratorUser && optionsOpen && breakoutMergeRequests.length ? (
                <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: isLight ? 'rgba(15,23,42,0.15)' : 'rgba(255,255,255,0.15)', background: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.58)' }}>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: isLight ? '#475569' : '#94a3b8' }}>
                    {isGerman ? 'Merge-Anfragen' : 'Merge Requests'}
                  </p>
                  <div className="mt-2 space-y-2">
                    {breakoutMergeRequests.slice(0, 4).map((request) => (
                      <div key={`${request.participantId}-${request.requestedAt}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2" style={{ borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)' }}>
                        <div>
                          <p className="text-xs font-bold" style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>{request.participantName}</p>
                          <p className="text-[11px]" style={{ color: statusText }}>{request.roomName} | {new Date(request.requestedAt).toLocaleTimeString(locale)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={buildLiveMeetingHref(activeMeetingId, breakoutSession?.sessionId, request.roomId)}
                            className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                            style={{
                              borderColor: 'rgba(59,130,246,0.35)',
                              color: isLight ? '#1d4ed8' : '#93c5fd',
                              background: isLight ? 'rgba(59,130,246,0.10)' : 'rgba(30,64,175,0.2)',
                            }}
                          >
                            {isGerman ? 'Raum betreten' : 'Join Room'}
                          </Link>
                          <button
                            type="button"
                            onClick={() => { void handleMergeRequestedRoom(request.roomId, request.roomName); }}
                            className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                            style={{
                              borderColor: 'rgba(16,185,129,0.35)',
                              color: isLight ? '#065f46' : '#6ee7b7',
                              background: isLight ? 'rgba(16,185,129,0.10)' : 'rgba(5,150,105,0.2)',
                            }}
                          >
                            {isGerman ? 'Merge planen' : 'Merge Room'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {optionsOpen && remoteParticipants.length ? (
                <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: isLight ? 'rgba(15,23,42,0.15)' : 'rgba(255,255,255,0.15)', background: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.58)' }}>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: isLight ? '#475569' : '#94a3b8' }}>
                    {isGerman ? 'Teilnehmer im Raum' : 'In-Room Participants'}
                  </p>
                  <div className="mt-2 space-y-2">
                    {remoteParticipants.slice(0, 4).map((participant) => (
                      <div
                        key={participant.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
                        style={{
                          borderColor: getNetworkTone(getParticipantNetworkLevel(participant), isGerman, isLight).border,
                          background: getNetworkTone(getParticipantNetworkLevel(participant), isGerman, isLight).bg,
                        }}
                      >
                        <div>
                          <p className="text-xs font-bold" style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>{participant.displayName}</p>
                          <p className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: statusText }}>
                            <span>{participant.role}</span>
                            <span className="inline-flex items-center gap-1 font-bold" style={{ color: getNetworkTone(getParticipantNetworkLevel(participant), isGerman, isLight).color }}>
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: getNetworkTone(getParticipantNetworkLevel(participant), isGerman, isLight).dot }} />
                              {getNetworkTone(getParticipantNetworkLevel(participant), isGerman, isLight).label}
                            </span>
                          </p>
                        </div>
                        {isModeratorUser ? (
                          <button
                            type="button"
                            onClick={() => { void handleRemoveParticipant(participant.id, participant.displayName); }}
                            className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                            style={{
                              borderColor: 'rgba(239,68,68,0.35)',
                              color: isLight ? '#991b1b' : '#fecaca',
                              background: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(127,29,29,0.28)',
                            }}
                          >
                            {isGerman ? 'Entfernen' : 'Remove'}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-3 min-h-5 text-xs" style={{ color: statusText }}>
                {actionMessage
                  ? actionMessage
                  : sfu.error
                  ? `${isGerman ? 'Medienproblem' : 'Media issue'}: ${sfu.error}`
                  : sfu.isEnabled && !sfu.isConnected
                    ? (sfu.isConnecting ? (isGerman ? 'Audio und Video werden verbunden...' : 'Audio and video are connecting...') : (isGerman ? 'Medienvorschau aktiv. Live-Verbindung wartet.' : 'Media preview is active. Live connection is waiting.'))
                  : activeBreakoutHelpRequest
                    ? activeBreakoutHelpRequest.kind === 'merge'
                      ? (isGerman ? `Merge-Anfrage fuer ${activeBreakoutRoom?.name ?? 'deinen Breakout-Raum'} gesendet.` : `Merge request sent for ${activeBreakoutRoom?.name ?? 'your breakout room'}.`)
                      : (isGerman ? `Host-Hilfe angefragt fuer ${activeBreakoutRoom?.name ?? 'deinen Breakout-Raum'}.` : `Host help requested for ${activeBreakoutRoom?.name ?? 'your breakout room'}.`)
                  : activeBreakoutRoom?.status === 'closing'
                    ? (isGerman ? `${activeBreakoutRoom.name} kehrt in ${activeBreakoutRoom.secondsUntilMerge}s in den Hauptraum zurueck.` : `${activeBreakoutRoom.name} returning to the main room in ${activeBreakoutRoom.secondsUntilMerge}s.`)
                  : breakoutSession?.latestAnnouncement
                    ? `${isGerman ? 'Breakout-Update' : 'Breakout update'}: ${breakoutSession.latestAnnouncement.message}`
                  : breakoutSession?.latestBroadcast
                    ? `${isGerman ? 'Host-Durchsage' : 'Host broadcast'}: ${breakoutSession.latestBroadcast.message}`
                  : syncError
                  ? `${isGerman ? 'Raum-Sync-Problem' : 'Room sync issue'}: ${syncError}`
                  : activeBreakoutRoomId
                    ? (isGerman ? `Im Breakout-Raum ${activeBreakoutRoomId}${activeBreakoutSessionId ? ` | Sitzung ${activeBreakoutSessionId}` : ''}` : `Inside breakout room ${activeBreakoutRoomId}${activeBreakoutSessionId ? ` | session ${activeBreakoutSessionId}` : ''}`)
                  : isSyncing
                    ? (isGerman ? 'Live-Steuerung wird synchronisiert...' : 'Syncing live controls...')
                    : (utilityExpanded || optionsOpen)
                      ? `${isGerman ? 'Live-Impact' : 'Live impact'} ${formatRate(snapshot.totalRateGPerMin)} | ${isGerman ? 'Sitzung gesamt' : 'Session total'} ${formatCarbonGrams(snapshot.totalCumulativeG)}`
                      : ''}
              </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function LiveStateGate({
  children,
  eyebrow,
  isLight,
  loading = false,
  message,
  title,
}: {
  children?: React.ReactNode;
  eyebrow: string;
  isLight: boolean;
  loading?: boolean;
  message: string;
  title: string;
}) {
  const pageBg = isLight
    ? 'linear-gradient(180deg,#eef6f8 0%,#f8fafc 54%,#eaf3f6 100%)'
    : 'radial-gradient(circle at 50% 0%,rgba(30,64,175,0.14),transparent 34%),#070b12';
  const cardBg = isLight ? 'rgba(255,255,255,0.94)' : 'rgba(15,23,42,0.94)';
  const borderColor = isLight ? 'rgba(15,23,42,0.10)' : 'rgba(148,163,184,0.18)';
  const textColor = isLight ? '#0f172a' : '#f8fafc';
  const mutedColor = isLight ? '#475569' : '#d7e2ee';
  const iconBg = isLight ? 'rgba(37,99,235,0.10)' : 'rgba(96,165,250,0.16)';
  const iconColor = isLight ? '#2563eb' : '#93c5fd';
  const cardShadow = isLight ? '0 28px 70px rgba(15,23,42,0.14)' : '0 28px 80px rgba(0,0,0,0.42)';

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10" style={{ background: pageBg, color: textColor }}>
      <section
        className="w-full max-w-[520px] rounded-[28px] border px-6 py-7 text-center md:px-8 md:py-9"
        style={{ background: cardBg, borderColor, boxShadow: cardShadow }}
      >
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: iconBg, color: iconColor }}
        >
          {loading ? (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          ) : (
            <LockIcon />
          )}
        </div>
        <p className="mt-6 text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: iconColor }}>
          {eyebrow}
        </p>
        <h1 className="mt-3 text-2xl font-black tracking-tight md:text-3xl" style={{ color: textColor }}>
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-[420px] text-sm leading-6 md:text-base" style={{ color: mutedColor }}>
          {message}
        </p>
        {children ? <div className="mt-7 flex flex-wrap items-center justify-center gap-3">{children}</div> : null}
      </section>
    </main>
  );
}

function MeetingsLiveFallback() {
  const { isGerman } = useAppTranslations();
  const { theme } = useThemeStore();
  const isLight = theme === 'light';
  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: isLight ? '#f3f6f9' : '#090b10' }}>
      <p className="text-sm font-semibold" style={{ color: isLight ? '#475569' : '#cbd5e1' }}>{isGerman ? 'Live-Meeting wird geladen...' : 'Loading live meeting...'}</p>
    </main>
  );
}

function MeetingControlButton({
  isLight,
  label,
  caption,
  children,
  active,
  disabled = false,
  onClick,
}: {
  isLight: boolean;
  label: string;
  caption: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const inactiveBg = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(31,41,55,0.88)';
  const disabledBg = isLight ? 'rgba(226,232,240,0.72)' : 'rgba(15,23,42,0.62)';
  const borderColor = isLight ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.15)';
  const color = disabled ? (isLight ? '#94a3b8' : '#64748b') : active ? '#ffffff' : (isLight ? '#0f172a' : '#ffffff');
  const captionColor = disabled ? (isLight ? '#94a3b8' : '#64748b') : (isLight ? '#334155' : 'rgba(255,255,255,0.78)');

  return (
    <div className="flex w-[62px] flex-col items-center gap-1">
      <button
        type="button"
        aria-label={label}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={onClick}
        className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] border transition enabled:hover:scale-[1.03] disabled:cursor-not-allowed"
        style={{
          background: disabled ? disabledBg : active ? '#1a73e8' : inactiveBg,
          borderColor,
          color,
          opacity: disabled ? 0.82 : 1,
        }}
        title={label}
      >
        {children}
      </button>
      <span className="max-w-full truncate text-[10px] font-bold leading-none" style={{ color: captionColor }}>
        {caption}
      </span>
    </div>
  );
}

function UtilityPill({
  isLight,
  label,
  children,
  onClick,
}: {
  isLight: boolean;
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] border transition hover:scale-[1.03]"
      style={{
        borderColor: isLight ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.15)',
        background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(31,41,55,0.75)',
      }}
      title={label}
    >
      {children}
    </button>
  );
}

function CloseIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function AddUserIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="7" r="3" />
      <path d="M20 8v6M17 11h6" strokeLinecap="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="4" width="11" height="16" rx="2" />
      <path d="M5 8H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 4 5v6c0 5.25 3.4 10.18 8 11.73 4.6-1.55 8-6.48 8-11.73V5l-8-3Zm0 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm2 10h-4v-1.2c0-1.1.9-2 2-2s2 .9 2 2V17Z" />
    </svg>
  );
}

function UpArrowIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 14 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CamIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4M10 10l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CaptionIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 12h2M7 15h2M12 12h5M12 15h5" strokeLinecap="round" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 11V5a1 1 0 1 1 2 0v6M11 11V4a1 1 0 1 1 2 0v7M15 12V6a1 1 0 1 1 2 0v8" strokeLinecap="round" />
      <path d="M7 11v3a5 5 0 0 0 10 0v-2a1 1 0 1 1 2 0v2a7 7 0 1 1-14 0v-3a1 1 0 1 1 2 0Z" strokeLinecap="round" />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v4" strokeLinecap="round" />
      <path d="M12 9 7 14M12 9l5 5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="14" width="8" height="6" rx="2" />
      <rect x="13" y="14" width="8" height="6" rx="2" />
    </svg>
  );
}

function MergeIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="8" height="6" rx="2" />
      <rect x="13" y="4" width="8" height="6" rx="2" />
      <path d="M7 10v3l5 4 5-4v-3M12 17v2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 1 1 18 0Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="4" height="4" rx="1" />
      <rect x="10" y="4" width="4" height="4" rx="1" />
      <rect x="16" y="4" width="4" height="4" rx="1" />
      <rect x="4" y="10" width="4" height="4" rx="1" />
      <rect x="10" y="10" width="4" height="4" rx="1" />
      <rect x="16" y="10" width="4" height="4" rx="1" />
      <rect x="4" y="16" width="4" height="4" rx="1" />
      <rect x="10" y="16" width="4" height="4" rx="1" />
      <rect x="16" y="16" width="4" height="4" rx="1" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}
