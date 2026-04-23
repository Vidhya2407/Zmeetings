import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { createActivityRepo } from '@/lib/activity/activityRepository';
import { deleteEventRepo, getEventRepo, patchEventRepo } from '@/lib/events/eventRepository';
import { listUsersRepo } from '@/lib/people/peopleRepository';

const patchSchema = z.object({
  title: z.string().min(2).max(140).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  ownerUserId: z.string().min(1).optional(),
  attendeeUserIds: z.array(z.string().min(1)).optional(),
  meetingId: z.string().nullable().optional(),
  color: z.enum(['blue', 'green', 'amber', 'purple']).optional(),
});

type RouteContext = { params: Promise<{ eventId: string }> };

function toCalendarUserId(userId: string) {
  return userId === 'demo-user' ? 'u5' : userId;
}

async function getHostName(ownerUserId: string) {
  const peopleResult = await listUsersRepo().catch(() => null);
  return peopleResult?.value.find((person) => person.id === ownerUserId)?.name ?? 'the host';
}

export async function GET(_: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const result = await getEventRepo(eventId);
  if (!result.value) return apiError('Event not found.', 404);
  return apiSuccess({ event: result.value }, result.demoMode ? { _demoMode: true } : {});
}

export async function PATCH(request: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const { eventId } = await context.params;
  const eventResult = await getEventRepo(eventId);
  if (!eventResult.value) return apiError('Event not found.', 404);

  const requesterUserId = toCalendarUserId(sessionCheck.session.user.id);
  if (eventResult.value.ownerUserId !== requesterUserId) {
    const hostName = await getHostName(eventResult.value.ownerUserId);
    return apiError(`Only ${hostName} can update this event.`, 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid event patch payload.', 400);
  }
  const result = await patchEventRepo(eventId, parsed.data);
  if (!result.value) return apiError('Event not found.', 404);
  return apiSuccess({ event: result.value }, result.demoMode ? { _demoMode: true } : {});
}

export async function DELETE(_: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const { eventId } = await context.params;
  const eventResult = await getEventRepo(eventId);
  if (!eventResult.value) return apiError('Event not found.', 404);

  const requesterUserId = toCalendarUserId(sessionCheck.session.user.id);
  if (eventResult.value.ownerUserId !== requesterUserId) {
    const hostName = await getHostName(eventResult.value.ownerUserId);
    return apiError(`Only ${hostName} can cancel this event.`, 403);
  }

  const result = await deleteEventRepo(eventId);
  if (!result.value) return apiError('Event not found.', 404);

  const hostName = await getHostName(eventResult.value.ownerUserId);
  const activityResult = await createActivityRepo({
    kind: 'meeting_update',
    title: eventResult.value.title,
    body: `${hostName} canceled this scheduled event.`,
    priority: eventResult.value.attendeeUserIds.length > 0 ? 'direct' : 'general',
    relatedMeetingId: eventResult.value.meetingId,
    relatedThreadId: null,
    targetUserIds: Array.from(new Set([eventResult.value.ownerUserId, ...eventResult.value.attendeeUserIds])),
  });

  return apiSuccess({ deleted: true }, result.demoMode || activityResult.demoMode ? { _demoMode: true } : {});
}
