import { apiSuccess } from '@/lib/api/response';
import { listActivityRepo } from '@/lib/activity/activityRepository';
import { auth } from '@/lib/auth/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get('unread') === '1';
  const session = await auth();
  const result = await listActivityRepo(session?.user?.id);
  const items = unreadOnly ? result.value.filter((item) => !item.read) : result.value;
  return apiSuccess({ items }, result.demoMode ? { _demoMode: true } : {});
}
