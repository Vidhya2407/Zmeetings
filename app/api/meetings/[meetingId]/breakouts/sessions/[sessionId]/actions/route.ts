import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { resolveMeetingAuthorization } from '@/lib/meetings/authorization';
import {
  autoAssignBreakoutParticipantsService,
  broadcastBreakoutMessageService,
  clearBreakoutHelpRequestService,
  endBreakoutSessionService,
  manualAssignBreakoutParticipantsService,
  mergeAllBreakoutRoomsService,
  mergeBreakoutRoomService,
  requestBreakoutMergeService,
  requestBreakoutHelpService,
  startBreakoutSessionService,
} from '@/lib/meetings/breakoutService';
import { getMeetingRoom } from '@/lib/meetings/serverRoomStore';

type RouteContext = { params: Promise<{ meetingId: string; sessionId: string }> };

const breakoutParticipantSchema = z.object({
  id: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(160),
  role: z.string().trim().min(1).max(80),
});

const breakoutManualAssignmentSchema = z.object({
  participantId: z.string().trim().min(1).max(120),
  participantName: z.string().trim().min(1).max(160),
  participantRole: z.string().trim().min(1).max(80),
  roomId: z.string().trim().min(1).max(120),
});

const breakoutActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('autoAssign'),
    participants: z.array(breakoutParticipantSchema).max(500).optional(),
  }),
  z.object({
    action: z.literal('manualAssign'),
    assignments: z.array(breakoutManualAssignmentSchema).min(1).max(500),
  }),
  z.object({
    action: z.literal('start'),
    countdownSeconds: z.number().int().min(0).max(300).optional(),
    participants: z.array(breakoutParticipantSchema).max(500).optional(),
  }),
  z.object({
    action: z.literal('broadcast'),
    message: z.string().trim().min(1).max(1000),
  }),
  z.object({
    action: z.literal('mergeRoom'),
    roomId: z.string().trim().min(1).max(120),
    countdownSeconds: z.number().int().min(0).max(7200).optional(),
  }),
  z.object({
    action: z.literal('mergeAll'),
    countdownSeconds: z.number().int().min(0).max(7200).optional(),
  }),
  z.object({
    action: z.literal('end'),
  }),
  z.object({
    action: z.literal('requestHelp'),
    participantId: z.string().trim().min(1).max(120),
    participantName: z.string().trim().min(1).max(160),
  }),
  z.object({
    action: z.literal('requestMerge'),
    participantId: z.string().trim().min(1).max(120),
    participantName: z.string().trim().min(1).max(160),
  }),
  z.object({
    action: z.literal('clearHelpRequest'),
    participantId: z.string().trim().min(1).max(120),
  }),
]);

export async function POST(request: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const { meetingId, sessionId } = await context.params;
  if (!meetingId?.trim() || !sessionId?.trim()) {
    return apiError('Invalid breakout route params.', 400);
  }

  const access = await resolveMeetingAuthorization(meetingId, sessionCheck.session.user.id, sessionCheck.session.user.role);
  if (!access.meeting) {
    return apiError('Meeting not found.', 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = breakoutActionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid breakout action payload.', 400);
  }

  const attendeeHelpRequestAction = parsed.data.action === 'requestHelp' || parsed.data.action === 'requestMerge';
  const clearHelpRequestAction = parsed.data.action === 'clearHelpRequest';

  if (attendeeHelpRequestAction) {
    if (!access.canViewMeeting) {
      return apiError('You do not have access to this meeting.', 403);
    }
    const participantId = 'participantId' in parsed.data ? parsed.data.participantId : '';
    if (participantId !== sessionCheck.session.user.id) {
      return apiError('Participants can only update their own breakout help request.', 403);
    }
  } else if (clearHelpRequestAction) {
    if (!access.canViewMeeting) {
      return apiError('You do not have access to this meeting.', 403);
    }
    const participantId = 'participantId' in parsed.data ? parsed.data.participantId : '';
    if (!access.canModerateMeeting && participantId !== sessionCheck.session.user.id) {
      return apiError('Only hosts can clear someone else\'s breakout help request.', 403);
    }
  } else if (!access.canModerateMeeting) {
    return apiError('Host permissions required to manage breakout rooms.', 403);
  }

  try {
    if (parsed.data.action === 'autoAssign') {
      const room = await getMeetingRoom(meetingId);
      const participants = parsed.data.participants ?? room.participants.map((participant) => ({
        id: participant.id,
        displayName: participant.displayName,
        role: participant.role,
      }));
      const result = await autoAssignBreakoutParticipantsService(
        meetingId,
        sessionId,
        participants,
        sessionCheck.session.user.id,
      );
      return apiSuccess(
        { session: result.value },
        result.demoMode ? { _demoMode: true } : {},
      );
    }

    if (parsed.data.action === 'manualAssign') {
      const result = await manualAssignBreakoutParticipantsService(
        meetingId,
        sessionId,
        parsed.data.assignments,
        sessionCheck.session.user.id,
      );
      return apiSuccess(
        { session: result.value },
        result.demoMode ? { _demoMode: true } : {},
      );
    }

    if (parsed.data.action === 'start') {
      const room = await getMeetingRoom(meetingId);
      const participants = parsed.data.participants ?? room.participants.map((participant) => ({
        id: participant.id,
        displayName: participant.displayName,
        role: participant.role,
      }));
      const result = await startBreakoutSessionService(
        meetingId,
        sessionId,
        parsed.data.countdownSeconds ?? 15,
        participants,
        sessionCheck.session.user.id,
      );
      return apiSuccess(
        { session: result.value },
        result.demoMode ? { _demoMode: true } : {},
      );
    }

    if (parsed.data.action === 'broadcast') {
      const result = await broadcastBreakoutMessageService(
        meetingId,
        sessionId,
        parsed.data.message,
        sessionCheck.session.user.id,
      );
      return apiSuccess(
        { session: result.value },
        result.demoMode ? { _demoMode: true } : {},
      );
    }

    if (parsed.data.action === 'mergeRoom') {
      const result = await mergeBreakoutRoomService(
        meetingId,
        sessionId,
        parsed.data.roomId,
        parsed.data.countdownSeconds ?? 15,
        sessionCheck.session.user.id,
      );
      return apiSuccess(
        { session: result.value },
        result.demoMode ? { _demoMode: true } : {},
      );
    }

    if (parsed.data.action === 'mergeAll') {
      const result = await mergeAllBreakoutRoomsService(
        meetingId,
        sessionId,
        parsed.data.countdownSeconds ?? 15,
        sessionCheck.session.user.id,
      );
      return apiSuccess(
        { session: result.value },
        result.demoMode ? { _demoMode: true } : {},
      );
    }

    if (parsed.data.action === 'requestHelp') {
      const result = await requestBreakoutHelpService(
        meetingId,
        sessionId,
        parsed.data.participantId,
        parsed.data.participantName,
        sessionCheck.session.user.id,
      );
      return apiSuccess(
        { session: result.value },
        result.demoMode ? { _demoMode: true } : {},
      );
    }

    if (parsed.data.action === 'requestMerge') {
      const result = await requestBreakoutMergeService(
        meetingId,
        sessionId,
        parsed.data.participantId,
        parsed.data.participantName,
        sessionCheck.session.user.id,
      );
      return apiSuccess(
        { session: result.value },
        result.demoMode ? { _demoMode: true } : {},
      );
    }

    if (parsed.data.action === 'clearHelpRequest') {
      const result = await clearBreakoutHelpRequestService(
        meetingId,
        sessionId,
        parsed.data.participantId,
        sessionCheck.session.user.id,
      );
      return apiSuccess(
        { session: result.value },
        result.demoMode ? { _demoMode: true } : {},
      );
    }

    const result = await endBreakoutSessionService(
      meetingId,
      sessionId,
      sessionCheck.session.user.id,
    );
    return apiSuccess(
      { session: result.value },
      result.demoMode ? { _demoMode: true } : {},
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process breakout action.';
    if (message.toLowerCase().includes('not found')) {
      return apiError(message, 404);
    }
    if (
      message.toLowerCase().includes('invalid')
      || message.toLowerCase().includes('required')
      || message.toLowerCase().includes('no attendee')
      || message.toLowerCase().includes('already ended')
      || message.toLowerCase().includes('already active')
      || message.toLowerCase().includes('locked')
      || message.toLowerCase().includes('assign every attendee')
      || message.toLowerCase().includes('help requests are available')
      || message.toLowerCase().includes('merge requests are available')
      || message.toLowerCase().includes('only the room lead')
    ) {
      return apiError(message, 400);
    }
    console.error('Breakout action error:', error);
    return apiError('Unable to process breakout action.', 500);
  }
}
