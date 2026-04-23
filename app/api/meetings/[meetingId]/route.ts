import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { resolveMeetingAuthorization } from '@/lib/meetings/authorization';
import {
  endMeetingService,
  getMeetingService,
  startMeetingService,
  updateMeetingService,
} from '@/lib/meetings/meetingService';

const patchSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  status: z.enum(['scheduled', 'live', 'ended']).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

type RouteContext = { params: Promise<{ meetingId: string }> };

export async function GET(_: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const { meetingId } = await context.params;
  const access = await resolveMeetingAuthorization(meetingId, sessionCheck.session.user.id, sessionCheck.session.user.role);
  if (!access.meeting) {
    return apiError('Meeting not found.', 404);
  }
  const canPreviewJoinableMeeting = access.meeting.status !== 'ended';
  if (!access.canViewMeeting && !canPreviewJoinableMeeting) {
    return apiError('You do not have access to this meeting.', 403);
  }

  const result = await getMeetingService(meetingId);
  return apiSuccess({ meeting: result.value }, result.demoMode ? { _demoMode: true } : {});
}

export async function PATCH(request: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const { meetingId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid patch payload.', 400);
  }

  const access = await resolveMeetingAuthorization(meetingId, sessionCheck.session.user.id, sessionCheck.session.user.role);
  if (!access.meeting) {
    return apiError('Meeting not found.', 404);
  }
  if (!access.canModerateMeeting) {
    return apiError('Host permissions required to update this meeting.', 403);
  }

  let result;
  if (parsed.data.status === 'live' && Object.keys(parsed.data).length === 1) {
    result = await startMeetingService(meetingId);
  } else if (parsed.data.status === 'ended' && Object.keys(parsed.data).length === 1) {
    result = await endMeetingService(meetingId);
  } else {
    result = await updateMeetingService(meetingId, parsed.data);
  }
  if (!result.value) {
    return apiError('Meeting not found.', 404);
  }
  return apiSuccess({ meeting: result.value }, result.demoMode ? { _demoMode: true } : {});
}
