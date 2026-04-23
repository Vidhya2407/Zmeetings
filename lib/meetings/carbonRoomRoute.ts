import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { createActivityRepo } from '@/lib/activity/activityRepository';
import { resolveMeetingAuthorization } from '@/lib/meetings/authorization';
import { resolveMeetingCarbonRoomScope } from '@/lib/meetings/carbonRoomScope';
import {
  admitMeetingWaitingParticipant,
  getMeetingRoom,
  isParticipantOwnedByUser,
  joinMeetingParticipant,
  removeMeetingParticipant,
  setMeetingRoomFeature,
  setMeetingRoomLock,
  syncMeetingParticipantsFromSfu,
  updateMeetingParticipantNetwork,
  updateMeetingParticipantMedia,
  updateMeetingRoomMedia,
} from '@/lib/meetings/serverRoomStore';

const roomIdSchema = z.string().trim().min(1).max(120);
const breakoutRoomNameSchema = z.string().trim().min(1).max(160);
const mediaFieldSchema = z.enum(['camera', 'microphone', 'screenShare']);
const roomFeatureSchema = z.enum(['recordingEnabled', 'transcriptEnabled']);
const meetingMediaStateSchema = z.object({
  camera: z.boolean(),
  microphone: z.boolean(),
  screenShare: z.boolean(),
});
const networkQualityLevelSchema = z.enum(['excellent', 'good', 'fair', 'poor', 'offline']);
const participantNetworkSchema = z.object({
  downlinkMbps: z.number().min(0).max(10_000).nullable(),
  effectiveType: z.string().trim().max(24).nullable(),
  isOnline: z.boolean(),
  level: networkQualityLevelSchema,
  locale: z.string().trim().max(40).nullable(),
  locationLabel: z.string().trim().max(160).nullable(),
  rttMs: z.number().min(0).max(60_000).nullable(),
  timezone: z.string().trim().max(80).nullable(),
});
const participantSeedSchema = z.object({
  id: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(80),
  media: meetingMediaStateSchema,
  network: participantNetworkSchema.optional().nullable(),
});
const carbonRoomRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('init'),
    participants: z.array(participantSeedSchema).max(250).optional(),
  }),
  z.object({
    action: z.literal('join'),
    participant: participantSeedSchema,
  }),
  z.object({
    action: z.literal('updateMedia'),
    participantId: z.string().trim().min(1).max(120),
    field: mediaFieldSchema,
    value: z.boolean(),
  }),
  z.object({
    action: z.literal('updateNetwork'),
    participantId: z.string().trim().min(1).max(120),
    network: participantNetworkSchema,
  }),
  z.object({
    action: z.literal('updateAllMedia'),
    field: mediaFieldSchema,
    value: z.boolean(),
  }),
  z.object({
    action: z.literal('lockRoom'),
    value: z.boolean(),
  }),
  z.object({
    action: z.literal('setFeature'),
    feature: roomFeatureSchema,
    value: z.boolean(),
  }),
  z.object({
    action: z.literal('admitWaiting'),
    participantId: z.string().trim().min(1).max(120),
  }),
  z.object({
    action: z.literal('removeParticipant'),
    participantId: z.string().trim().min(1).max(120),
  }),
  z.object({
    action: z.literal('syncParticipants'),
    participants: z.array(participantSeedSchema).max(250),
    ownedParticipantIds: z.array(z.string().trim().min(1).max(120)).max(10).optional(),
  }),
]);

type CarbonRateLimitState = {
  count: number;
  windowStartMs: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __carbonMeetingRateLimitStore: Map<string, CarbonRateLimitState> | undefined;
}

function getCarbonRateLimitStore() {
  if (!globalThis.__carbonMeetingRateLimitStore) {
    globalThis.__carbonMeetingRateLimitStore = new Map<string, CarbonRateLimitState>();
  }
  return globalThis.__carbonMeetingRateLimitStore;
}

function isRateLimited(userId: string) {
  const store = getCarbonRateLimitStore();
  const now = Date.now();
  const entry = store.get(userId);
  const WINDOW_MS = 10_000;
  const MAX_REQUESTS_PER_WINDOW = 90;

  if (!entry || now - entry.windowStartMs >= WINDOW_MS) {
    store.set(userId, { count: 1, windowStartMs: now });
    return false;
  }

  entry.count += 1;
  store.set(userId, entry);
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

async function emitModerationActivity(roomId: string, meetingTitle: string, body: string, priority: 'meeting_now' | 'mention' | 'direct' | 'general' = 'general') {
  try {
    await createActivityRepo({
      kind: 'meeting_update',
      title: meetingTitle,
      body,
      priority,
      relatedMeetingId: roomId,
      relatedThreadId: null,
    });
  } catch {
    // Keep moderation actions non-blocking if activity sink fails.
  }
}

export function parseCarbonRoomId(rawId: string) {
  const parsed = roomIdSchema.safeParse(rawId);
  return parsed.success ? parsed.data : null;
}

function resolveCarbonRoomScopeFromRequest(request: Request, roomId: string) {
  const requestUrl = new URL(request.url);
  const breakoutSessionIdRaw = requestUrl.searchParams.get('breakoutSessionId');
  const breakoutRoomIdRaw = requestUrl.searchParams.get('breakoutRoomId');
  const breakoutRoomNameRaw = requestUrl.searchParams.get('breakoutRoomName');
  const breakoutSessionId = breakoutSessionIdRaw && roomIdSchema.safeParse(breakoutSessionIdRaw).success
    ? breakoutSessionIdRaw.trim()
    : null;
  const breakoutRoomId = breakoutRoomIdRaw && roomIdSchema.safeParse(breakoutRoomIdRaw).success
    ? breakoutRoomIdRaw.trim()
    : null;
  const breakoutRoomName = breakoutRoomNameRaw && breakoutRoomNameSchema.safeParse(breakoutRoomNameRaw).success
    ? breakoutRoomNameRaw.trim()
    : null;

  if (Boolean(breakoutSessionId) !== Boolean(breakoutRoomId)) {
    throw new Error('Both breakoutSessionId and breakoutRoomId are required for breakout carbon tracking.');
  }

  return resolveMeetingCarbonRoomScope({
    breakoutRoomId,
    breakoutRoomName,
    breakoutSessionId,
    meetingId: roomId,
  });
}

export async function getCarbonRoomResponse(request: Request, roomId: string) {
  try {
    const scope = resolveCarbonRoomScopeFromRequest(request, roomId);
    const payload = await getMeetingRoom(scope.roomKey, [], scope);
    return apiSuccess(payload);
  } catch (error) {
    if (error instanceof Error && error.message.includes('breakoutSessionId')) {
      return apiError(error.message, 400);
    }
    console.error('Meeting carbon GET error:', error);
    return apiError(error instanceof Error ? error.message : 'Unable to load meeting carbon room', 500);
  }
}

export async function postCarbonRoomResponse(request: Request, roomId: string) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  try {
    const scope = resolveCarbonRoomScopeFromRequest(request, roomId);
    const rawBody = await request.json().catch(() => null);
    const parsedBody = carbonRoomRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return apiError(parsedBody.error.issues[0]?.message ?? 'Invalid carbon room payload.', 400);
    }
    const body = parsedBody.data;
    const requesterUserId = sessionCheck.session.user.id;
    const requesterRole = sessionCheck.session.user.role;
    const access = await resolveMeetingAuthorization(roomId, requesterUserId, requesterRole);
    if (!access.meeting) {
      return apiError('Meeting not found.', 404);
    }
    if (!access.canViewMeeting) {
      return apiError('You do not have access to this meeting room.', 403);
    }
    if (isRateLimited(requesterUserId)) {
      return apiError('Too many meeting control requests. Please retry in a few seconds.', 429);
    }
    const canModerateRoom = access.canModerateMeeting;
    const meetingTitle = access.meeting.title;

    switch (body.action) {
      case 'init':
        return apiSuccess(await getMeetingRoom(scope.roomKey, body.participants ?? [], scope));
      case 'join':
        return apiSuccess(await joinMeetingParticipant(scope.roomKey, body.participant, requesterUserId, scope));
      case 'updateMedia':
        {
          const ownsTargetParticipant = await isParticipantOwnedByUser(scope.roomKey, body.participantId, requesterUserId);
          if (!canModerateRoom && !ownsTargetParticipant) {
            return apiError('Only hosts can control other participants.', 403);
          }
          const payload = await updateMeetingParticipantMedia(scope.roomKey, body.participantId, body.field, body.value, scope);
          if (canModerateRoom && !ownsTargetParticipant) {
            await emitModerationActivity(
              roomId,
              meetingTitle,
              `${requesterUserId} changed ${body.field} for participant ${body.participantId} (${body.value ? 'on' : 'off'}).`,
              'direct',
            );
          }
          return apiSuccess(payload);
        }
      case 'updateNetwork':
        {
          const ownsTargetParticipant = await isParticipantOwnedByUser(scope.roomKey, body.participantId, requesterUserId);
          if (!canModerateRoom && !ownsTargetParticipant) {
            return apiError('Only hosts can update network details for their own session.', 403);
          }
          return apiSuccess(await updateMeetingParticipantNetwork(scope.roomKey, body.participantId, body.network, scope));
        }
      case 'updateAllMedia':
        if (!canModerateRoom) {
          return apiError('Host permissions required for room-wide controls.', 403);
        }
        {
          const payload = await updateMeetingRoomMedia(scope.roomKey, body.field, body.value, scope);
          await emitModerationActivity(
            roomId,
            meetingTitle,
            `${requesterUserId} applied room-wide ${body.field}=${body.value ? 'on' : 'off'}.`,
            'meeting_now',
          );
          return apiSuccess(payload);
        }
      case 'lockRoom':
        if (!canModerateRoom) {
          return apiError('Host permissions required to lock or unlock the room.', 403);
        }
        {
          const payload = await setMeetingRoomLock(scope.roomKey, body.value);
          await emitModerationActivity(
            roomId,
            meetingTitle,
            `${requesterUserId} ${body.value ? 'locked' : 'unlocked'} the waiting room.`,
            'meeting_now',
          );
          return apiSuccess(payload);
        }
      case 'setFeature':
        if (!canModerateRoom) {
          return apiError('Host permissions required to update meeting room features.', 403);
        }
        {
          const payload = await setMeetingRoomFeature(scope.roomKey, body.feature, body.value);
          const featureLabel = body.feature === 'recordingEnabled' ? 'recording' : 'transcript';
          await emitModerationActivity(
            roomId,
            meetingTitle,
            `${requesterUserId} turned ${featureLabel} ${body.value ? 'on' : 'off'}.`,
            'meeting_now',
          );
          return apiSuccess(payload);
        }
      case 'admitWaiting':
        if (!canModerateRoom) {
          return apiError('Host permissions required to admit waiting participants.', 403);
        }
        {
          const payload = await admitMeetingWaitingParticipant(scope.roomKey, body.participantId);
          await emitModerationActivity(
            roomId,
            meetingTitle,
            `${requesterUserId} admitted participant ${body.participantId} from waiting room.`,
            'direct',
          );
          return apiSuccess(payload);
        }
      case 'removeParticipant':
        if (!canModerateRoom) {
          return apiError('Host permissions required to remove participants.', 403);
        }
        {
          const payload = await removeMeetingParticipant(scope.roomKey, body.participantId);
          await emitModerationActivity(
            roomId,
            meetingTitle,
            `${requesterUserId} removed participant ${body.participantId} from room.`,
            'direct',
          );
          return apiSuccess(payload);
        }
      case 'syncParticipants':
        return apiSuccess(await syncMeetingParticipantsFromSfu(
          scope.roomKey,
          body.participants,
          requesterUserId,
          body.ownedParticipantIds ?? [],
          scope,
        ));
      default:
        return apiError('Unsupported meeting carbon action', 400);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('breakoutSessionId')) {
      return apiError(error.message, 400);
    }
    if (error instanceof Error && error.message === 'Invalid participant network details.') {
      return apiError(error.message, 400);
    }
    if (
      error instanceof Error &&
      (
        error.message === 'Meeting participant not found.' ||
        error.message === 'Waiting participant not found.'
      )
    ) {
      return apiError(error.message, 404);
    }
    console.error('Meeting carbon POST error:', error);
    return apiError('Unable to update meeting carbon room', 500);
  }
}
