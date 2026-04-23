import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { markActivityReadRepo } from '@/lib/activity/activityRepository';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const { id } = await context.params;
  const result = await markActivityReadRepo(id);
  if (!result.value) {
    return apiError('Activity item not found.', 404);
  }
  return apiSuccess({ item: result.value }, result.demoMode ? { _demoMode: true } : {});
}
