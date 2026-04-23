import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { resolveMeetingAuthorization } from '@/lib/meetings/authorization';
import { getCurrentBreakoutSessionService } from '@/lib/meetings/breakoutService';
import type { MeetingSfuTokenResponse } from '@/types/domain/sfu';
import {
  createMeetingSfuToken,
  isLiveKitConfigured,
  resolveBreakoutSfuRoomName,
  resolveMeetingSfuRoomName,
} from '@/lib/meetings/sfu';

type RouteContext = { params: Promise<{ meetingId: string }> };

const meetingIdSchema = z.string().trim().min(1).max(120);
const breakoutIdSchema = z.string().trim().min(1).max(120);
const clientIdSchema = z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/);

function normalizeParticipantName(value: string | null, fallback: string) {
  const candidate = value?.trim().slice(0, 120);
  if (!candidate) return fallback;
  return candidate;
}

function normalizeClientId(value: string | null) {
  const parsed = clientIdSchema.safeParse(value ?? '');
  return parsed.success ? parsed.data : null;
}

export async function GET(request: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const params = await context.params;
  const meetingIdResult = meetingIdSchema.safeParse(params.meetingId);
  if (!meetingIdResult.success) {
    return apiError('Invalid meetingId.', 400);
  }
  const meetingId = meetingIdResult.data;

  const access = await resolveMeetingAuthorization(
    meetingId,
    sessionCheck.session.user.id,
    sessionCheck.session.user.role,
  );
  if (!access.meeting) {
    return apiError('Meeting not found.', 404);
  }
  if (!access.canViewMeeting) {
    return apiError('You do not have access to this meeting.', 403);
  }

  const requestUrl = new URL(request.url);
  const clientId = normalizeClientId(requestUrl.searchParams.get('clientId'));
  const participantName = normalizeParticipantName(
    requestUrl.searchParams.get('displayName'),
    sessionCheck.session.user.name ?? sessionCheck.session.user.email ?? 'Participant',
  );
  const participantId = clientId
    ? `${sessionCheck.session.user.id}:${clientId}`
    : sessionCheck.session.user.id;
  const breakoutSessionId = breakoutIdSchema.safeParse(requestUrl.searchParams.get('breakoutSessionId') ?? '').success
    ? requestUrl.searchParams.get('breakoutSessionId')!.trim()
    : null;
  const breakoutRoomId = breakoutIdSchema.safeParse(requestUrl.searchParams.get('breakoutRoomId') ?? '').success
    ? requestUrl.searchParams.get('breakoutRoomId')!.trim()
    : null;

  let roomName = resolveMeetingSfuRoomName(meetingId);
  if (breakoutSessionId || breakoutRoomId) {
    if (!breakoutSessionId || !breakoutRoomId) {
      return apiError('Both breakoutSessionId and breakoutRoomId are required for breakout joins.', 400);
    }

    const breakoutState = await getCurrentBreakoutSessionService(meetingId, sessionCheck.session.user.id);
    const breakoutSession = breakoutState.value;
    if (!breakoutSession || breakoutSession.sessionId !== breakoutSessionId) {
      return apiError('Breakout session is no longer available.', 404);
    }
    if (breakoutSession.status !== 'countdown' && breakoutSession.status !== 'active') {
      return apiError('Breakout session is not joinable right now.', 400);
    }
    if (!breakoutSession.rooms.some((room) => room.id === breakoutRoomId)) {
      return apiError('Breakout room not found.', 404);
    }
    if (!access.canModerateMeeting && breakoutSession.myAssignment?.roomId !== breakoutRoomId) {
      return apiError('You are not assigned to this breakout room.', 403);
    }

    roomName = resolveBreakoutSfuRoomName(meetingId, breakoutSessionId, breakoutRoomId);
  }

  if (!isLiveKitConfigured()) {
    return apiSuccess<MeetingSfuTokenResponse>({
      enabled: false,
      provider: 'none',
      reason: 'SFU provider is not configured. Configure LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and SFU_PROVIDER=livekit.',
      roomName,
      token: null,
      wsUrl: null,
      participant: {
        id: participantId,
        name: participantName,
      },
    });
  }

  try {
    const token = await createMeetingSfuToken({
      breakoutRoomId,
      breakoutSessionId,
      meetingId,
      participantId,
      participantName,
      roomAdmin: access.canModerateMeeting,
    });

    return apiSuccess<MeetingSfuTokenResponse>({
      enabled: true,
      provider: 'livekit',
      reason: null,
      roomName,
      token,
      wsUrl: process.env.LIVEKIT_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL ?? null,
      participant: {
        id: participantId,
        name: participantName,
      },
    });
  } catch (error) {
    console.error('SFU token generation error:', error);
    return apiError('Unable to generate SFU token.', 500);
  }
}
