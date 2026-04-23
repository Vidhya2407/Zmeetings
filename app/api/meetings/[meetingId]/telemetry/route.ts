import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { resolveMeetingAuthorization } from '@/lib/meetings/authorization';
import { recordPacketLossSample, recordSfuJoinAttempt, recordSfuJoinResult } from '@/lib/ops/metrics';

type RouteContext = { params: Promise<{ meetingId: string }> };

const telemetryPayloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('joinAttempt'),
    provider: z.enum(['none', 'livekit']),
    roomType: z.enum(['main', 'breakout']),
  }),
  z.object({
    action: z.literal('joinResult'),
    provider: z.enum(['none', 'livekit']),
    roomType: z.enum(['main', 'breakout']),
    success: z.boolean(),
  }),
  z.object({
    action: z.literal('packetLoss'),
    provider: z.enum(['none', 'livekit']),
    roomType: z.enum(['main', 'breakout']),
    packetLossRatio: z.number().min(0).max(1),
    sampleCount: z.number().int().min(0).max(100_000).optional(),
    rttMs: z.number().min(0).max(60_000).nullable().optional(),
  }),
]);

export async function POST(request: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const { meetingId } = await context.params;
  if (!meetingId?.trim()) {
    return apiError('Invalid meetingId.', 400);
  }

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

  const body = await request.json().catch(() => null);
  const parsed = telemetryPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid telemetry payload.', 400);
  }

  if (parsed.data.action === 'joinAttempt') {
    recordSfuJoinAttempt({
      provider: parsed.data.provider,
      roomType: parsed.data.roomType,
    });
  } else if (parsed.data.action === 'joinResult') {
    recordSfuJoinResult({
      provider: parsed.data.provider,
      roomType: parsed.data.roomType,
      success: parsed.data.success,
    });
  } else {
    recordPacketLossSample({
      provider: parsed.data.provider,
      roomType: parsed.data.roomType,
      packetLossRatio: parsed.data.packetLossRatio,
      sampleCount: parsed.data.sampleCount,
      rttMs: parsed.data.rttMs,
    });
  }

  return apiSuccess({ ok: true });
}
