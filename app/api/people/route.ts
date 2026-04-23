import { apiSuccess } from '@/lib/api/response';
import { listUsersRepo } from '@/lib/people/peopleRepository';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') ?? undefined;
  const result = await listUsersRepo(query);
  return apiSuccess({ people: result.value }, result.demoMode ? { _demoMode: true } : {});
}
