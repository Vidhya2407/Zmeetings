import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { resolveMeetingAuthorization } from '@/lib/meetings/authorization';
import { getCurrentBreakoutSessionService } from '@/lib/meetings/breakoutService';

type RouteContext = { params: Promise<{ meetingId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const { meetingId } = await context.params;
  if (!meetingId?.trim()) {
    return apiError('Invalid meetingId.', 400);
  }

  const access = await resolveMeetingAuthorization(meetingId, sessionCheck.session.user.id, sessionCheck.session.user.role);
  if (!access.meeting) {
    return apiError('Meeting not found.', 404);
  }
  if (!access.canViewMeeting) {
    return apiError('You do not have access to this meeting.', 403);
  }

  const url = new URL(request.url);
  const participantId = url.searchParams.get('participantId')?.trim() || undefined;
  const result = await getCurrentBreakoutSessionService(meetingId, participantId);
  return apiSuccess(
    { session: result.value },
    result.demoMode ? { _demoMode: true } : {},
  );
}

