import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { updateUserPresenceRepo } from '@/lib/people/peopleRepository';

const presenceSchema = z.object({
  presence: z.enum(['online', 'away', 'busy', 'offline']),
});

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const { userId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = presenceSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid presence payload.', 400);
  }
  const result = await updateUserPresenceRepo(userId, parsed.data.presence);
  if (!result.value) {
    return apiError('User not found.', 404);
  }
  return apiSuccess({ user: result.value }, result.demoMode ? { _demoMode: true } : {});
}
