import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { getMeetingByRoomCodeRepo } from '@/lib/meetings/meetingRepository';

export async function GET(request: Request) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code')?.trim() ?? '';

  if (!code) {
    return apiError('code query parameter is required.', 400);
  }

  const result = await getMeetingByRoomCodeRepo(code);
  if (!result.value) {
    return apiError('Meeting not found for the provided code.', 404);
  }

  return apiSuccess({ meeting: result.value }, result.demoMode ? { _demoMode: true } : {});
}
