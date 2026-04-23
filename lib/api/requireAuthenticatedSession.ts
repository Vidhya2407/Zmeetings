import type { Session } from 'next-auth';
import { auth } from '@/lib/auth/auth';
import { apiError } from '@/lib/api/response';

type SessionCheckResult =
  | { ok: true; session: Session }
  | { ok: false; response: ReturnType<typeof apiError> };

export async function requireAuthenticatedSession(): Promise<SessionCheckResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: apiError('Authentication required.', 401),
    };
  }

  return { ok: true, session };
}
