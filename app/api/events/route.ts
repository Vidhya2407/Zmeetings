import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { createActivityRepo } from '@/lib/activity/activityRepository';
import { createEventRepo, listEventsRepo } from '@/lib/events/eventRepository';
import { createMeetingService, joinMeetingService } from '@/lib/meetings/meetingService';

const createEventSchema = z.object({
  title: z.string().min(2).max(140),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().trim().max(80).nullable().optional().default(null),
  ownerUserId: z.string().min(1).default('u5'),
  attendeeUserIds: z.array(z.string().min(1)).default([]),
  meetingId: z.string().nullable().default(null),
  createMeeting: z.boolean().default(false),
  color: z.enum(['blue', 'green', 'amber', 'purple']).default('blue'),
});

export async function GET() {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const result = await listEventsRepo(sessionCheck.session.user.id);
  return apiSuccess({ events: result.value }, result.demoMode ? { _demoMode: true } : {});
}

export async function POST(request: Request) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid event payload.', 400);
  }
  const ownerUserId = sessionCheck.session.user.id === 'demo-user'
    ? parsed.data.ownerUserId
    : sessionCheck.session.user.id;
  const attendeeUserIds = Array.from(new Set(parsed.data.attendeeUserIds.filter((id) => id !== ownerUserId)));
  let meetingId = parsed.data.meetingId;
  let demoMode = false;

  if (parsed.data.createMeeting) {
    const meetingResult = await createMeetingService(parsed.data.title, ownerUserId, {
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
    });
    meetingId = meetingResult.value.id;
    demoMode = demoMode || meetingResult.demoMode;
  }

  if (meetingId) {
    const participantResults = await Promise.all(
      attendeeUserIds.map((userId) => joinMeetingService(meetingId as string, userId, 'attendee')),
    );
    demoMode = demoMode || participantResults.some((result) => result.demoMode);
  }

  const result = await createEventRepo({
    title: parsed.data.title,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    timezone: parsed.data.timezone,
    ownerUserId,
    attendeeUserIds,
    meetingId,
    color: parsed.data.color,
  });
  demoMode = demoMode || result.demoMode;

  const activityResult = await createActivityRepo({
    kind: meetingId ? 'meeting_invite' : 'meeting_update',
    title: parsed.data.title,
    body: meetingId
      ? `Scheduled and linked to a meeting room for ${attendeeUserIds.length} invited member(s).`
      : `Scheduled calendar event for ${attendeeUserIds.length} invited member(s).`,
    priority: attendeeUserIds.length > 0 ? 'direct' : 'general',
    relatedMeetingId: meetingId,
    relatedThreadId: null,
    targetUserIds: Array.from(new Set([ownerUserId, ...attendeeUserIds])),
  });
  demoMode = demoMode || activityResult.demoMode;

  return apiSuccess({ event: result.value }, demoMode ? { _demoMode: true } : {}, 201);
}
