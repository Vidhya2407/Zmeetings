import { apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { listMeetingsService } from '@/lib/meetings/meetingService';

export async function GET() {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const result = await listMeetingsService();
  return apiSuccess({ meetings: result.value }, result.demoMode ? { _demoMode: true } : {});
}
