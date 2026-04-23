import { hash } from 'argon2';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { hashPasswordResetToken } from '@/lib/auth/passwordReset';
import dbConnect from '@/lib/db/mongodb';
import User from '@/lib/models/User';

type RouteContext = { params: Promise<{ token: string }> };

const tokenSchema = z.string().trim().min(32).max(256);
const resetPasswordSchema = z.object({
  confirmPassword: z.string().min(8),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters.')
    .regex(/[A-Z]/, 'Password must include an uppercase letter.')
    .regex(/[0-9]/, 'Password must include a number.')
    .regex(/[^A-Za-z0-9]/, 'Password must include a special character.'),
}).superRefine((value, ctx) => {
  if (value.newPassword !== value.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Passwords do not match.',
      path: ['confirmPassword'],
    });
  }
});

function parseResetToken(rawToken: string) {
  const tokenResult = tokenSchema.safeParse(rawToken);
  return tokenResult.success ? tokenResult.data : null;
}

async function findUserForToken(token: string) {
  const tokenHash = hashPasswordResetToken(token);
  return User.findOne({
    passwordResetExpiresAt: { $gt: new Date() },
    passwordResetTokenHash: tokenHash,
  }).select('+password +passwordResetTokenHash +passwordResetExpiresAt');
}

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const token = parseResetToken(params.token);
  if (!token) {
    return apiError('Reset link is invalid or expired.', 404);
  }

  const connection = await dbConnect();
  if (!connection) {
    return apiError('Password reset verification is unavailable while the database is offline.', 503, { _demoMode: true });
  }

  const user = await findUserForToken(token);
  if (!user) {
    return apiError('Reset link is invalid or expired.', 404);
  }

  return apiSuccess({
    expiresAt: user.passwordResetExpiresAt?.toISOString() ?? null,
    valid: true,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;
  const token = parseResetToken(params.token);
  if (!token) {
    return apiError('Reset link is invalid or expired.', 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid password reset request.', 400);
  }

  const connection = await dbConnect();
  if (!connection) {
    return apiError('Password reset is unavailable while the database is offline.', 503, { _demoMode: true });
  }

  const user = await findUserForToken(token);
  if (!user) {
    return apiError('Reset link is invalid or expired.', 404);
  }

  user.password = await hash(parsed.data.newPassword);
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  await user.save();

  return apiSuccess({ updated: true });
}
