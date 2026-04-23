import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { isGlobalMeetingModerator } from '@/lib/meetings/authorization';
import { createMeetingService, listMeetingsService } from '@/lib/meetings/meetingService';

const createMeetingSchema = z.object({
  title: z.string().min(2).max(120),
  hostUserId: z.string().min(1).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export async function GET() {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const result = await listMeetingsService();
  const userId = sessionCheck.session.user.id;
  const userRole = sessionCheck.session.user.role;
  const visibleMeetings = isGlobalMeetingModerator(userRole)
    ? result.value
    : result.value.filter((meeting) => (
      meeting.hostUserId === userId ||
      meeting.participants.some((participant) => participant.userId === userId)
    ));

  return apiSuccess({ meetings: visibleMeetings }, result.demoMode ? { _demoMode: true } : {});
}

export async function POST(request: Request) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = createMeetingSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid create meeting payload.', 400);
  }

  const currentUserId = sessionCheck.session.user.id;
  const currentUserRole = sessionCheck.session.user.role;
  const requestedHostUserId = parsed.data.hostUserId?.trim();
  const hostUserId = requestedHostUserId && isGlobalMeetingModerator(currentUserRole)
    ? requestedHostUserId
    : currentUserId;

  const result = await createMeetingService(parsed.data.title, hostUserId, {
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
  });
  return apiSuccess({ meeting: result.value }, result.demoMode ? { _demoMode: true } : {}, 201);
}
