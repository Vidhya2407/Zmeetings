import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { resolveMeetingAuthorization } from '@/lib/meetings/authorization';
import { createBreakoutSessionService } from '@/lib/meetings/breakoutService';

type RouteContext = { params: Promise<{ meetingId: string }> };

const createBreakoutSessionSchema = z.object({
  roomCount: z.number().int().min(1).max(20),
});

export async function POST(request: Request, context: RouteContext) {
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
  if (!access.canModerateMeeting) {
    return apiError('Host permissions required to create breakout rooms.', 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = createBreakoutSessionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid breakout session payload.', 400);
  }

  const result = await createBreakoutSessionService(
    meetingId,
    sessionCheck.session.user.id,
    parsed.data.roomCount,
  );
  return apiSuccess(
    { session: result.value },
    result.demoMode ? { _demoMode: true } : {},
    201,
  );
}

