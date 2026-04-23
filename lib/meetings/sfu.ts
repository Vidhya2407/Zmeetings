import 'server-only';
import { AccessToken } from 'livekit-server-sdk';
import { appEnv } from '@/lib/config/env';

type CreateMeetingSfuTokenInput = {
  breakoutRoomId?: string | null;
  breakoutSessionId?: string | null;
  meetingId: string;
  participantId: string;
  participantName: string;
  roomAdmin?: boolean;
};

function sanitizeIdentity(value: string) {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9:_-]/g, '-').slice(0, 120);
  return cleaned || 'participant';
}

export function isLiveKitConfigured() {
  return Boolean(
    appEnv.sfuProvider === 'livekit'
    && appEnv.livekitUrl
    && appEnv.livekitApiKey
    && appEnv.livekitApiSecret,
  );
}

export function resolveMeetingSfuRoomName(meetingId: string) {
  return `zmeetings-${meetingId}`.slice(0, 120);
}

export function resolveBreakoutSfuRoomName(
  meetingId: string,
  breakoutSessionId: string,
  breakoutRoomId: string,
) {
  return `zmeetings-${meetingId}-breakout-${breakoutSessionId}-${breakoutRoomId}`.slice(0, 120);
}

export async function createMeetingSfuToken(input: CreateMeetingSfuTokenInput) {
  if (!isLiveKitConfigured()) {
    throw new Error('LiveKit is not configured.');
  }

  const token = new AccessToken(appEnv.livekitApiKey, appEnv.livekitApiSecret, {
    identity: sanitizeIdentity(input.participantId),
    name: input.participantName.trim().slice(0, 120) || 'Participant',
    ttl: '2h',
  });

  token.addGrant({
    room: input.breakoutSessionId && input.breakoutRoomId
      ? resolveBreakoutSfuRoomName(input.meetingId, input.breakoutSessionId, input.breakoutRoomId)
      : resolveMeetingSfuRoomName(input.meetingId),
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: Boolean(input.roomAdmin),
  });

  return token.toJwt();
}
