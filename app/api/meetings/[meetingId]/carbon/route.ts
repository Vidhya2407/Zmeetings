import { apiError } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { resolveMeetingAuthorization } from '@/lib/meetings/authorization';
import {
  getCarbonRoomResponse,
  parseCarbonRoomId,
  postCarbonRoomResponse,
} from '@/lib/meetings/carbonRoomRoute';

type RouteContext = { params: Promise<{ meetingId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const params = await context.params;
  const meetingId = parseCarbonRoomId(params.meetingId);
  if (!meetingId) {
    return apiError('Invalid meetingId.', 400);
  }

  const access = await resolveMeetingAuthorization(meetingId, sessionCheck.session.user.id, sessionCheck.session.user.role);
  if (!access.meeting) {
    return apiError('Meeting not found.', 404);
  }
  if (!access.canViewMeeting) {
    return apiError('You do not have access to this meeting room.', 403);
  }

  return getCarbonRoomResponse(_request, meetingId);
}

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;
  const meetingId = parseCarbonRoomId(params.meetingId);
  if (!meetingId) {
    return apiError('Invalid meetingId.', 400);
  }

  return postCarbonRoomResponse(request, meetingId);
}
