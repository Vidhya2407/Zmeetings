import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { resolveMeetingAuthorization } from '@/lib/meetings/authorization';
import { joinMeetingService, leaveMeetingService } from '@/lib/meetings/meetingService';

const addParticipantSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['host', 'cohost', 'attendee']).optional(),
});

type RouteContext = { params: Promise<{ meetingId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const { meetingId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = addParticipantSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid participant payload.', 400);
  }

  const access = await resolveMeetingAuthorization(meetingId, sessionCheck.session.user.id, sessionCheck.session.user.role);
  if (!access.meeting) {
    return apiError('Meeting not found.', 404);
  }
  const isSelfJoin = parsed.data.userId === sessionCheck.session.user.id
    && (!parsed.data.role || parsed.data.role === 'attendee');

  if (!access.canModerateMeeting && !isSelfJoin) {
    return apiError('Host permissions required to add participants.', 403);
  }

  if (parsed.data.role === 'host' && !access.isGlobalModerator) {
    return apiError('Only admins can assign host role.', 403);
  }

  const result = await joinMeetingService(meetingId, parsed.data.userId, isSelfJoin ? 'attendee' : (parsed.data.role ?? 'attendee'));
  if (!result.value) {
    return apiError('Meeting not found.', 404);
  }
  return apiSuccess({ meeting: result.value }, result.demoMode ? { _demoMode: true } : {});
}

export async function DELETE(request: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const { meetingId } = await context.params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return apiError('userId query parameter is required.', 400);
  }

  const access = await resolveMeetingAuthorization(meetingId, sessionCheck.session.user.id, sessionCheck.session.user.role);
  if (!access.meeting) {
    return apiError('Meeting not found.', 404);
  }

  const isSelfLeave = sessionCheck.session.user.id === userId;
  if (!isSelfLeave && !access.canModerateMeeting) {
    return apiError('Host permissions required to remove participants.', 403);
  }

  if (!access.isGlobalModerator && access.meeting.hostUserId === userId) {
    return apiError('Host cannot be removed from the meeting.', 400);
  }

  const result = await leaveMeetingService(meetingId, userId);
  if (!result.value) {
    return apiError('Meeting not found.', 404);
  }
  return apiSuccess({ meeting: result.value }, result.demoMode ? { _demoMode: true } : {});
}
