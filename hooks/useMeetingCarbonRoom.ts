'use client';

import * as React from 'react';
import {
  calcCameraOffSaving,
  calcMeetingSnapshot,
  type MeetingCarbonSnapshot,
  type MeetingMediaState,
  type MeetingParticipantNetworkDetails,
  type MeetingParticipantSeed,
  type MeetingParticipantState,
} from '../lib/meetings/carbonCalc';
import type { ApiResponse } from '@/types/api';
import type { MeetingRoomPayload } from '../lib/meetings/serverRoomStore';
import { useNetworkQuality } from './useNetworkQuality';

type UseMeetingCarbonRoomOptions = {
  autoJoinParticipant?: MeetingParticipantSeed;
  breakoutRoomId?: string;
  breakoutRoomName?: string;
  breakoutSessionId?: string;
  enabled?: boolean;
  initialParticipants?: MeetingParticipantSeed[];
  pollIntervalMs?: number;
  roomId: string;
};

const EMPTY_PARTICIPANTS: MeetingParticipantSeed[] = [];

type HydratedRoomPayload = {
  breakoutRoomId: string | null;
  breakoutSessionId: string | null;
  cameraOffSaving: ReturnType<typeof calcCameraOffSaving>;
  meetingId: string;
  participants: MeetingParticipantState[];
  roomKey: string;
  roomLabel: string;
  roomLocked: boolean;
  roomType: 'main' | 'breakout';
  recordingEnabled: boolean;
  snapshot: MeetingCarbonSnapshot;
  startedAt: Date;
  syncedAt: Date;
  transcriptEnabled: boolean;
  waitingParticipants: MeetingParticipantSeed[];
};

type MeetingRoomFeature = 'recordingEnabled' | 'transcriptEnabled';

type SyncRoomOptions = {
  silent?: boolean;
};

type ParticipantNetworkTelemetry = Omit<MeetingParticipantNetworkDetails, 'updatedAt'>;

class MeetingRoomRequestError extends Error {
  status: number;
  unauthorized: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.unauthorized = status === 401;
  }
}

function hydratePayload(payload: MeetingRoomPayload): HydratedRoomPayload {
  const participants = payload.participants.map((participant) => ({
    ...participant,
    joinedAt: new Date(participant.joinedAt),
    lastStateChange: new Date(participant.lastStateChange),
    network: participant.network
      ? {
          ...participant.network,
          updatedAt: participant.network.updatedAt ? new Date(participant.network.updatedAt) : new Date(),
        }
      : null,
  }));

  return {
    ...payload,
    participants,
    waitingParticipants: (payload.waitingParticipants ?? []).map((participant) => ({
      ...participant,
      media: { ...participant.media },
      network: participant.network
        ? {
            ...participant.network,
            updatedAt: participant.network.updatedAt ? new Date(participant.network.updatedAt) : new Date(),
          }
        : null,
    })),
    roomLocked: payload.roomLocked ?? false,
    recordingEnabled: payload.recordingEnabled ?? false,
    startedAt: new Date(payload.startedAt),
    syncedAt: new Date(payload.syncedAt),
    transcriptEnabled: payload.transcriptEnabled ?? false,
  };
}

function buildRequestUrl(
  roomId: string,
  breakoutSessionId?: string,
  breakoutRoomId?: string,
  breakoutRoomName?: string,
) {
  const params = new URLSearchParams();
  if (breakoutSessionId?.trim() && breakoutRoomId?.trim()) {
    params.set('breakoutSessionId', breakoutSessionId.trim());
    params.set('breakoutRoomId', breakoutRoomId.trim());
    if (breakoutRoomName?.trim()) {
      params.set('breakoutRoomName', breakoutRoomName.trim());
    }
  }

  const queryString = params.toString();
  const query = queryString ? `?${queryString}` : '';
  return `/api/meetings/${roomId}/carbon${query}`;
}

function getBrowserLocationLabel() {
  if (typeof window === 'undefined') {
    return {
      locale: null,
      locationLabel: null,
      timezone: null,
    };
  }

  const locale = navigator.language || null;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  const locationLabel = timezone
    ? timezone.replace(/_/g, ' ')
    : locale;

  return {
    locale,
    locationLabel,
    timezone,
  };
}

function buildParticipantNetworkTelemetry(
  quality: ReturnType<typeof useNetworkQuality>,
): ParticipantNetworkTelemetry {
  const location = getBrowserLocationLabel();

  return {
    downlinkMbps: quality.downlinkMbps,
    effectiveType: quality.effectiveType,
    isOnline: quality.isOnline,
    level: quality.level,
    locale: location.locale,
    locationLabel: location.locationLabel,
    rttMs: quality.rttMs,
    timezone: location.timezone,
  };
}

async function requestMeetingRoom(
  roomId: string,
  breakoutSessionId?: string,
  breakoutRoomId?: string,
  breakoutRoomName?: string,
  init?: RequestInit,
): Promise<HydratedRoomPayload> {
  const response = await fetch(buildRequestUrl(roomId, breakoutSessionId, breakoutRoomId, breakoutRoomName), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  const body = await response.json() as ApiResponse<MeetingRoomPayload>;
  if (!response.ok || !body.success || !body.data) {
    throw new MeetingRoomRequestError(body.error ?? 'Unable to sync meeting room', response.status);
  }

  return hydratePayload(body.data);
}

export function useMeetingCarbonRoom(options: UseMeetingCarbonRoomOptions) {
  const {
    autoJoinParticipant,
    breakoutRoomId,
    breakoutRoomName,
    breakoutSessionId,
    enabled = true,
    initialParticipants = EMPTY_PARTICIPANTS,
    pollIntervalMs = 1000,
    roomId,
  } = options;
  const [roomState, setRoomState] = React.useState<HydratedRoomPayload | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(enabled);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [unauthorized, setUnauthorized] = React.useState(false);
  const networkQuality = useNetworkQuality();
  const hasLoadedRef = React.useRef(false);
  const networkSignatureRef = React.useRef('');

  const syncRoom = React.useCallback(async (syncOptions?: SyncRoomOptions) => {
    if (!enabled) {
      setIsSyncing(false);
      return null;
    }

    const silent = syncOptions?.silent ?? false;
    const showBusyState = !silent || !hasLoadedRef.current;
    if (showBusyState) {
      setIsSyncing(true);
    }
    try {
      const nextRoom = await requestMeetingRoom(
        roomId,
        breakoutSessionId,
        breakoutRoomId,
        breakoutRoomName,
      );
      setRoomState(nextRoom);
      hasLoadedRef.current = true;
      setSyncError(null);
      setUnauthorized(false);
      return nextRoom;
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unable to sync meeting room');
      setUnauthorized(error instanceof MeetingRoomRequestError && error.unauthorized);
      return null;
    } finally {
      if (showBusyState) {
        setIsSyncing(false);
      }
    }
  }, [breakoutRoomId, breakoutRoomName, breakoutSessionId, enabled, roomId]);

  React.useEffect(() => {
    if (!enabled) {
      setRoomState(null);
      setSyncError(null);
      setUnauthorized(false);
      setIsSyncing(false);
      hasLoadedRef.current = false;
      networkSignatureRef.current = '';
      return undefined;
    }

    let cancelled = false;

    const initialise = async () => {
      setIsSyncing(true);
      try {
        const initialRoom = await requestMeetingRoom(
          roomId,
          breakoutSessionId,
          breakoutRoomId,
          breakoutRoomName,
          {
            method: 'POST',
            body: JSON.stringify({
              action: 'init',
              participants: initialParticipants,
            }),
          },
        );

        if (cancelled) return;

        let nextRoom = initialRoom;
        if (autoJoinParticipant && !initialRoom.participants.some((participant) => participant.id === autoJoinParticipant.id)) {
          nextRoom = await requestMeetingRoom(
            roomId,
            breakoutSessionId,
            breakoutRoomId,
            breakoutRoomName,
            {
              method: 'POST',
              body: JSON.stringify({
                action: 'join',
                participant: autoJoinParticipant,
              }),
            },
          );
          if (cancelled) return;
        }

        setRoomState(nextRoom);
        hasLoadedRef.current = true;
        setSyncError(null);
        setUnauthorized(false);
      } catch (error) {
        if (!cancelled) {
          setSyncError(error instanceof Error ? error.message : 'Unable to initialize meeting room');
          setUnauthorized(error instanceof MeetingRoomRequestError && error.unauthorized);
        }
      } finally {
        if (!cancelled) {
          setIsSyncing(false);
        }
      }
    };

    void initialise();

    return () => {
      cancelled = true;
    };
  }, [autoJoinParticipant, breakoutRoomId, breakoutRoomName, breakoutSessionId, enabled, initialParticipants, roomId]);

  React.useEffect(() => {
    if (!roomState) return;
    const timer = window.setInterval(() => {
      if (isSyncing) return;
      void syncRoom({ silent: true });
    }, pollIntervalMs);

    return () => window.clearInterval(timer);
  }, [isSyncing, pollIntervalMs, roomState, syncRoom]);

  React.useEffect(() => {
    if (!roomState || !autoJoinParticipant?.id) return undefined;

    const network = buildParticipantNetworkTelemetry(networkQuality);
    const signature = JSON.stringify(network);
    if (networkSignatureRef.current === signature) {
      return undefined;
    }
    networkSignatureRef.current = signature;

    let cancelled = false;
    const reportNetwork = async () => {
      try {
        const nextRoom = await requestMeetingRoom(roomId, breakoutSessionId, breakoutRoomId, breakoutRoomName, {
          method: 'POST',
          body: JSON.stringify({
            action: 'updateNetwork',
            participantId: autoJoinParticipant.id,
            network,
          }),
        });
        if (!cancelled) {
          setRoomState(nextRoom);
        }
      } catch {
        // Network telemetry is advisory and should not block room controls.
      }
    };

    void reportNetwork();
    return () => {
      cancelled = true;
    };
  }, [
    autoJoinParticipant?.id,
    breakoutRoomId,
    breakoutRoomName,
    breakoutSessionId,
    networkQuality,
    roomId,
    roomState,
  ]);

  const updateMediaState = React.useCallback(async (participantId: string, field: keyof MeetingMediaState, value: boolean) => {
    setIsSyncing(true);
    try {
      const nextRoom = await requestMeetingRoom(roomId, breakoutSessionId, breakoutRoomId, breakoutRoomName, {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateMedia',
          participantId,
          field,
          value,
        }),
      });
      setRoomState(nextRoom);
      setSyncError(null);
      setUnauthorized(false);
      return nextRoom;
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unable to update meeting participant');
      setUnauthorized(error instanceof MeetingRoomRequestError && error.unauthorized);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [breakoutRoomId, breakoutRoomName, breakoutSessionId, roomId]);

  const setRoomLock = React.useCallback(async (value: boolean) => {
    setIsSyncing(true);
    try {
      const nextRoom = await requestMeetingRoom(roomId, breakoutSessionId, breakoutRoomId, breakoutRoomName, {
        method: 'POST',
        body: JSON.stringify({
          action: 'lockRoom',
          value,
        }),
      });
      setRoomState(nextRoom);
      setSyncError(null);
      setUnauthorized(false);
      return nextRoom;
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unable to update room lock');
      setUnauthorized(error instanceof MeetingRoomRequestError && error.unauthorized);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [breakoutRoomId, breakoutRoomName, breakoutSessionId, roomId]);

  const setRoomFeature = React.useCallback(async (feature: MeetingRoomFeature, value: boolean) => {
    setIsSyncing(true);
    try {
      const nextRoom = await requestMeetingRoom(roomId, breakoutSessionId, breakoutRoomId, breakoutRoomName, {
        method: 'POST',
        body: JSON.stringify({
          action: 'setFeature',
          feature,
          value,
        }),
      });
      setRoomState(nextRoom);
      setSyncError(null);
      setUnauthorized(false);
      return nextRoom;
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unable to update room feature');
      setUnauthorized(error instanceof MeetingRoomRequestError && error.unauthorized);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [breakoutRoomId, breakoutRoomName, breakoutSessionId, roomId]);

  const admitWaitingParticipant = React.useCallback(async (participantId: string) => {
    setIsSyncing(true);
    try {
      const nextRoom = await requestMeetingRoom(roomId, breakoutSessionId, breakoutRoomId, breakoutRoomName, {
        method: 'POST',
        body: JSON.stringify({
          action: 'admitWaiting',
          participantId,
        }),
      });
      setRoomState(nextRoom);
      setSyncError(null);
      setUnauthorized(false);
      return nextRoom;
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unable to admit waiting participant');
      setUnauthorized(error instanceof MeetingRoomRequestError && error.unauthorized);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [breakoutRoomId, breakoutRoomName, breakoutSessionId, roomId]);

  const removeParticipant = React.useCallback(async (participantId: string) => {
    setIsSyncing(true);
    try {
      const nextRoom = await requestMeetingRoom(roomId, breakoutSessionId, breakoutRoomId, breakoutRoomName, {
        method: 'POST',
        body: JSON.stringify({
          action: 'removeParticipant',
          participantId,
        }),
      });
      setRoomState(nextRoom);
      setSyncError(null);
      setUnauthorized(false);
      return nextRoom;
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unable to remove participant');
      setUnauthorized(error instanceof MeetingRoomRequestError && error.unauthorized);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [breakoutRoomId, breakoutRoomName, breakoutSessionId, roomId]);

  const updateAllMediaState = React.useCallback(async (field: keyof MeetingMediaState, value: boolean) => {
    setIsSyncing(true);
    try {
      const nextRoom = await requestMeetingRoom(roomId, breakoutSessionId, breakoutRoomId, breakoutRoomName, {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateAllMedia',
          field,
          value,
        }),
      });
      setRoomState(nextRoom);
      setSyncError(null);
      setUnauthorized(false);
      return nextRoom;
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unable to update meeting room');
      setUnauthorized(error instanceof MeetingRoomRequestError && error.unauthorized);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [breakoutRoomId, breakoutRoomName, breakoutSessionId, roomId]);

  const participantJoined = React.useCallback(async (participant: MeetingParticipantSeed) => {
    setIsSyncing(true);
    try {
      const nextRoom = await requestMeetingRoom(roomId, breakoutSessionId, breakoutRoomId, breakoutRoomName, {
        method: 'POST',
        body: JSON.stringify({
          action: 'join',
          participant,
        }),
      });
      setRoomState(nextRoom);
      setSyncError(null);
      setUnauthorized(false);
      return nextRoom;
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unable to join participant');
      setUnauthorized(error instanceof MeetingRoomRequestError && error.unauthorized);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [breakoutRoomId, breakoutRoomName, breakoutSessionId, roomId]);

  const syncParticipantsFromSfu = React.useCallback(async (
    nextParticipants: MeetingParticipantSeed[],
    ownedParticipantIds?: string[],
  ) => {
    const showBusyState = !hasLoadedRef.current;
    if (showBusyState) {
      setIsSyncing(true);
    }
    try {
      const nextRoom = await requestMeetingRoom(roomId, breakoutSessionId, breakoutRoomId, breakoutRoomName, {
        method: 'POST',
        body: JSON.stringify({
          action: 'syncParticipants',
          participants: nextParticipants,
          ownedParticipantIds,
        }),
      });
      setRoomState(nextRoom);
      setSyncError(null);
      setUnauthorized(false);
      return nextRoom;
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unable to sync SFU participants');
      setUnauthorized(error instanceof MeetingRoomRequestError && error.unauthorized);
      return null;
    } finally {
      if (showBusyState) {
        setIsSyncing(false);
      }
    }
  }, [breakoutRoomId, breakoutRoomName, breakoutSessionId, roomId]);

  const participants = roomState?.participants ?? [];
  const recordingEnabled = roomState?.recordingEnabled ?? false;
  const waitingParticipants = roomState?.waitingParticipants ?? [];
  const roomLocked = roomState?.roomLocked ?? false;
  const snapshot = roomState?.snapshot ?? calcMeetingSnapshot([], new Date());
  const transcriptEnabled = roomState?.transcriptEnabled ?? false;
  const cameraOffSaving = roomState?.cameraOffSaving ?? calcCameraOffSaving([]);

  return {
    admitWaitingParticipant,
    cameraOffSaving,
    isSyncing,
    participantJoined,
    participants,
    removeParticipant,
    roomId: roomState?.roomKey ?? roomId,
    roomLabel: roomState?.roomLabel ?? (breakoutRoomName || 'Main Room'),
    roomLocked,
    roomType: roomState?.roomType ?? (breakoutRoomId && breakoutSessionId ? 'breakout' : 'main'),
    recordingEnabled,
    setRoomFeature,
    setRoomLock,
    syncParticipantsFromSfu,
    snapshot,
    syncError,
    syncRoomNow: syncRoom,
    syncedAt: roomState?.syncedAt ?? null,
    transcriptEnabled,
    unauthorized,
    updateAllMediaState,
    updateMediaState,
    waitingParticipants,
  };
}
