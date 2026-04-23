import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { findOrCreateDirectThreadRepo, listThreadsRepo } from '@/lib/chat/chatRepository';
import { listUsersRepo } from '@/lib/people/peopleRepository';

const createThreadSchema = z.object({
  userId: z.string().min(1),
});

export async function GET() {
  const result = await listThreadsRepo();
  return apiSuccess({ threads: result.value }, result.demoMode ? { _demoMode: true } : {});
}

export async function POST(request: Request) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = createThreadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid chat thread payload.', 400);
  }

  const peopleResult = await listUsersRepo();
  const person = peopleResult.value.find((user) => user.id === parsed.data.userId);
  if (!person) {
    return apiError('Person not found.', 404);
  }

  const result = await findOrCreateDirectThreadRepo(person.id, person.name);
  return apiSuccess(
    { thread: result.value },
    result.demoMode || peopleResult.demoMode ? { _demoMode: true } : {},
    201,
  );
}
