'use client';

import * as React from 'react';
import {
  ConnectionState,
  Participant,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import type { ApiResponse } from '@/types/api';
import type {
  MeetingSfuTokenResponse,
  SfuParticipantMediaState,
  SfuParticipantState,
} from '@/types/domain/sfu';

type UseMeetingSfuRoomOptions = {
  autoConnect?: boolean;
  breakoutRoomId?: string;
  breakoutSessionId?: string;
  displayName?: string;
  meetingId: string;
};

type RoomTelemetryPayload =
  | {
      action: 'joinAttempt';
      provider: 'none' | 'livekit';
      roomType: 'main' | 'breakout';
    }
  | {
      action: 'joinResult';
      provider: 'none' | 'livekit';
      roomType: 'main' | 'breakout';
      success: boolean;
    }
  | {
      action: 'packetLoss';
      packetLossRatio: number;
      provider: 'none' | 'livekit';
      roomType: 'main' | 'breakout';
      rttMs?: number | null;
      sampleCount?: number;
    };

function createClientId() {
  return `web-${Math.random().toString(36).slice(2, 12)}`;
}

function resolveRoomType(breakoutSessionId?: string, breakoutRoomId?: string) {
  return breakoutSessionId?.trim() && breakoutRoomId?.trim() ? 'breakout' : 'main';
}

function resolveParticipantMediaState(participant: Participant): SfuParticipantMediaState {
  const camera = participant.getTrackPublication(Track.Source.Camera);
  const microphone = participant.getTrackPublication(Track.Source.Microphone);
  const screenShare = participant.getTrackPublication(Track.Source.ScreenShare);

  return {
    camera: Boolean(camera && !camera.isMuted),
    microphone: Boolean(microphone && !microphone.isMuted),
    screenShare: Boolean(screenShare && !screenShare.isMuted),
  };
}

function toSfuParticipantState(participant: Participant, isLocal: boolean): SfuParticipantState {
  return {
    id: participant.identity,
    displayName: participant.name?.trim() || participant.identity,
    isLocal,
    media: resolveParticipantMediaState(participant),
    role: isLocal ? 'host' : 'attendee',
  };
}

function collectRoomParticipants(room: Room): SfuParticipantState[] {
  const local = room.localParticipant ? [toSfuParticipantState(room.localParticipant, true)] : [];
  const remote = Array.from(room.remoteParticipants.values()).map((participant) => toSfuParticipantState(participant, false));
  return [...local, ...remote];
}

async function fetchSfuToken(
  meetingId: string,
  clientId: string,
  breakoutSessionId?: string,
  breakoutRoomId?: string,
  displayName?: string,
): Promise<MeetingSfuTokenResponse> {
  const params = new URLSearchParams({ clientId });
  if (breakoutSessionId?.trim() && breakoutRoomId?.trim()) {
    params.set('breakoutSessionId', breakoutSessionId.trim());
    params.set('breakoutRoomId', breakoutRoomId.trim());
  }
  if (displayName?.trim()) {
    params.set('displayName', displayName.trim());
  }

  const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/sfu/token?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });

  const body = await response.json() as ApiResponse<MeetingSfuTokenResponse>;
  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error ?? 'Unable to fetch SFU token');
  }
  return body.data;
}

async function postRoomTelemetry(
  meetingId: string,
  payload: RoomTelemetryPayload,
) {
  try {
    await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch {
    // Telemetry should never block media connection flows.
  }
}

async function collectPacketLossSample(room: Room) {
  const samples: Array<{ lost: number; total: number; rttMs?: number | null }> = [];

  const collectFromTrack = async (track: unknown) => {
    if (!track || typeof track !== 'object') {
      return;
    }

    const senderStatsFn = 'getSenderStats' in track && typeof track.getSenderStats === 'function'
      ? track.getSenderStats.bind(track) as () => Promise<Array<{
        packetsLost?: number;
        packetsSent?: number;
        roundTripTime?: number;
      }>>
      : null;
    const receiverStatsFn = 'getReceiverStats' in track && typeof track.getReceiverStats === 'function'
      ? track.getReceiverStats.bind(track) as () => Promise<{
        packetsLost?: number;
        packetsReceived?: number;
      } | undefined>
      : null;

    if (senderStatsFn) {
      const senderStats = await senderStatsFn().catch(() => []);
      for (const stat of senderStats) {
        const lost = Math.max(0, stat.packetsLost ?? 0);
        const sent = Math.max(0, stat.packetsSent ?? 0);
        const total = sent + lost;
        if (total > 0) {
          samples.push({
            lost,
            total,
            rttMs: typeof stat.roundTripTime === 'number' ? stat.roundTripTime * 1000 : null,
          });
        }
      }
      return;
    }

    if (receiverStatsFn) {
      const receiverStats = await receiverStatsFn().catch(() => undefined);
      if (!receiverStats) {
        return;
      }
      const lost = Math.max(0, receiverStats.packetsLost ?? 0);
      const received = Math.max(0, receiverStats.packetsReceived ?? 0);
      const total = received + lost;
      if (total > 0) {
        samples.push({ lost, total });
      }
    }
  };

  const trackSources = [
    ...Array.from(room.localParticipant.trackPublications.values()),
    ...Array.from(room.remoteParticipants.values()).flatMap((participant) => Array.from(participant.trackPublications.values())),
  ];

  await Promise.all(trackSources.map((publication) => collectFromTrack(publication.track)));

  if (!samples.length) {
    return null;
  }

  const lost = samples.reduce((sum, sample) => sum + sample.lost, 0);
  const total = samples.reduce((sum, sample) => sum + sample.total, 0);
  const rttSamples = samples
    .map((sample) => sample.rttMs)
    .filter((sample): sample is number => typeof sample === 'number' && Number.isFinite(sample));

  if (total <= 0) {
    return null;
  }

  return {
    packetLossRatio: lost / total,
    sampleCount: total,
    rttMs: rttSamples.length
      ? (rttSamples.reduce((sum, sample) => sum + sample, 0) / rttSamples.length)
      : null,
  };
}

export function useMeetingSfuRoom(options: UseMeetingSfuRoomOptions) {
  const {
    autoConnect = true,
    breakoutRoomId,
    breakoutSessionId,
    displayName,
    meetingId,
  } = options;
  const clientIdRef = React.useRef(createClientId());
  const roomRef = React.useRef<Room | null>(null);
  const disconnectRequestedRef = React.useRef(false);
  const roomType = React.useMemo(
    () => resolveRoomType(breakoutSessionId, breakoutRoomId),
    [breakoutRoomId, breakoutSessionId],
  );

  const [tokenState, setTokenState] = React.useState<MeetingSfuTokenResponse | null>(null);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isConnected, setIsConnected] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [participants, setParticipants] = React.useState<SfuParticipantState[]>([]);
  const [localMedia, setLocalMedia] = React.useState<SfuParticipantMediaState>({
    camera: false,
    microphone: false,
    screenShare: false,
  });

  const syncFromRoom = React.useCallback((room: Room) => {
    const nextParticipants = collectRoomParticipants(room);
    setParticipants(nextParticipants);
    const local = nextParticipants.find((participant) => participant.isLocal);
    setLocalMedia(local?.media ?? {
      camera: false,
      microphone: false,
      screenShare: false,
    });
    setIsConnected(room.state === ConnectionState.Connected);
  }, []);

  const disconnect = React.useCallback(() => {
    disconnectRequestedRef.current = true;
    const activeRoom = roomRef.current;
    if (activeRoom) {
      activeRoom.disconnect();
    }
    roomRef.current = null;
    setIsConnected(false);
    setParticipants([]);
  }, []);

  const connect = React.useCallback(async () => {
    if (!meetingId.trim()) {
      setError('Meeting id is required to connect SFU room.');
      return false;
    }

    disconnectRequestedRef.current = false;
    setIsConnecting(true);
    setError(null);

    try {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }

      const tokenPayload = await fetchSfuToken(
        meetingId,
        clientIdRef.current,
        breakoutSessionId,
        breakoutRoomId,
        displayName,
      );
      setTokenState(tokenPayload);

      if (!tokenPayload.enabled || !tokenPayload.wsUrl || !tokenPayload.token) {
        setIsConnected(false);
        return false;
      }

      void postRoomTelemetry(meetingId, {
        action: 'joinAttempt',
        provider: tokenPayload.provider,
        roomType,
      });

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      const handleRoomUpdate = () => {
        if (!roomRef.current || roomRef.current !== room) return;
        syncFromRoom(room);
      };

      room
        .on(RoomEvent.Connected, handleRoomUpdate)
        .on(RoomEvent.Disconnected, handleRoomUpdate)
        .on(RoomEvent.Reconnecting, handleRoomUpdate)
        .on(RoomEvent.Reconnected, handleRoomUpdate)
        .on(RoomEvent.ParticipantConnected, handleRoomUpdate)
        .on(RoomEvent.ParticipantDisconnected, handleRoomUpdate)
        .on(RoomEvent.TrackPublished, handleRoomUpdate)
        .on(RoomEvent.TrackUnpublished, handleRoomUpdate)
        .on(RoomEvent.TrackSubscribed, handleRoomUpdate)
        .on(RoomEvent.TrackUnsubscribed, handleRoomUpdate)
        .on(RoomEvent.TrackMuted, handleRoomUpdate)
        .on(RoomEvent.TrackUnmuted, handleRoomUpdate)
        .on(RoomEvent.LocalTrackPublished, handleRoomUpdate)
        .on(RoomEvent.LocalTrackUnpublished, handleRoomUpdate);

      await room.connect(tokenPayload.wsUrl, tokenPayload.token, {
        autoSubscribe: true,
      });

      if (disconnectRequestedRef.current) {
        room.disconnect();
        return false;
      }

      syncFromRoom(room);
      void postRoomTelemetry(meetingId, {
        action: 'joinResult',
        provider: tokenPayload.provider,
        roomType,
        success: true,
      });
      return true;
    } catch (connectError) {
      const message = connectError instanceof Error ? connectError.message : 'Unable to connect SFU room.';
      setError(message);
      setIsConnected(false);
      void postRoomTelemetry(meetingId, {
        action: 'joinResult',
        provider: tokenState?.provider ?? 'livekit',
        roomType,
        success: false,
      });
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [breakoutRoomId, breakoutSessionId, displayName, meetingId, roomType, syncFromRoom, tokenState?.provider]);

  React.useEffect(() => {
    if (!autoConnect) return undefined;
    void connect();

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  React.useEffect(() => {
    if (!isConnected || !tokenState?.enabled || tokenState.provider !== 'livekit' || !roomRef.current) {
      return undefined;
    }

    let cancelled = false;
    const activeRoom = roomRef.current;

    const reportPacketLoss = async () => {
      const sample = await collectPacketLossSample(activeRoom);
      if (!sample || cancelled) {
        return;
      }
      void postRoomTelemetry(meetingId, {
        action: 'packetLoss',
        provider: tokenState.provider,
        roomType,
        packetLossRatio: sample.packetLossRatio,
        sampleCount: sample.sampleCount,
        rttMs: sample.rttMs,
      });
    };

    void reportPacketLoss();
    const interval = window.setInterval(() => {
      void reportPacketLoss();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isConnected, meetingId, roomType, tokenState]);

  const setMicrophoneEnabled = React.useCallback(async (value: boolean) => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return false;
    try {
      await room.localParticipant.setMicrophoneEnabled(value);
      syncFromRoom(room);
      return true;
    } catch {
      return false;
    }
  }, [syncFromRoom]);

  const setCameraEnabled = React.useCallback(async (value: boolean) => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return false;
    try {
      await room.localParticipant.setCameraEnabled(value);
      syncFromRoom(room);
      return true;
    } catch {
      return false;
    }
  }, [syncFromRoom]);

  const setScreenShareEnabled = React.useCallback(async (value: boolean) => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return false;
    try {
      await room.localParticipant.setScreenShareEnabled(value);
      syncFromRoom(room);
      return true;
    } catch {
      return false;
    }
  }, [syncFromRoom]);

  return {
    connect,
    disconnect,
    error,
    isConnected,
    isConnecting,
    isEnabled: Boolean(tokenState?.enabled),
    localMedia,
    localParticipantId: tokenState?.participant.id ?? null,
    participants,
    provider: tokenState?.provider ?? 'none',
    reason: tokenState?.reason ?? null,
    room: roomRef.current,
    setCameraEnabled,
    setMicrophoneEnabled,
    setScreenShareEnabled,
  };
}
