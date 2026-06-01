import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { requireAuthenticatedSession } from '@/lib/api/requireAuthenticatedSession';
import { addMessageRepo, listMessagesRepo, markThreadReadRepo } from '@/lib/chat/chatRepository';

const postMessageSchema = z.object({
  senderUserId: z.string().min(1).default('u5'),
  body: z.string().max(2000).default(''),
  attachments: z.array(
    z.object({
      id: z.string().min(1).max(140),
      name: z.string().min(1).max(240),
      type: z.string().min(1).max(160),
      size: z.number().min(0),
      dataUrl: z.string().min(1).max(5_000_000),
      kind: z.enum(['file', 'image', 'video']),
    }),
  ).max(10).optional().default([]),
}).refine((value) => value.body.trim().length > 0 || value.attachments.length > 0, {
  message: 'Message body or attachments are required.',
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
  const result = await addMessageRepo(
    threadId,
    parsed.data.senderUserId,
    parsed.data.body.trim(),
    parsed.data.attachments,
  );
  if (!result.value) {
    return apiError('Thread not found.', 404);
  }
  return apiSuccess({ message: result.value }, result.demoMode ? { _demoMode: true } : {}, 201);
}
