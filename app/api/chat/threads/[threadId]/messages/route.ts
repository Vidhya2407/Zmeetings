import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { addMessageRepo, listMessagesRepo, markThreadReadRepo } from '@/lib/chat/chatRepository';

const postMessageSchema = z.object({
  senderUserId: z.string().min(1).default('u5'),
  body: z.string().min(1).max(2000),
});

type RouteContext = { params: Promise<{ threadId: string }> };

export async function GET(_: Request, context: RouteContext) {
  const { threadId } = await context.params;
  const messagesResult = await listMessagesRepo(threadId);
  const markResult = await markThreadReadRepo(threadId);
  return apiSuccess(
    { messages: messagesResult.value },
    (messagesResult.demoMode || markResult.demoMode) ? { _demoMode: true } : {},
  );
}

export async function POST(request: Request, context: RouteContext) {
  const sessionCheck = await requireAuthenticatedSession();
  if (!sessionCheck.ok) {
    return sessionCheck.response;
  }

  const { threadId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = postMessageSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid message payload.', 400);
  }
  const result = await addMessageRepo(threadId, parsed.data.senderUserId, parsed.data.body);
  if (!result.value) {
    return apiError('Thread not found.', 404);
  }
  return apiSuccess({ message: result.value }, result.demoMode ? { _demoMode: true } : {}, 201);
}
