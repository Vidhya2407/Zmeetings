import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { createPasswordResetToken } from '@/lib/auth/passwordReset';
import { appEnv } from '@/lib/config/env';
import dbConnect from '@/lib/db/mongodb';
import User from '@/lib/models/User';

const requestResetSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestResetSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid reset request.', 400);
  }

  const connection = await dbConnect();
  if (!connection) {
    return apiError('Password reset is unavailable while the database is offline.', 503, { _demoMode: true });
  }

  const genericMessage = 'If an account exists for this email, a reset link will be sent shortly.';
  const user = await User.findOne({ email: parsed.data.email }).select('+passwordResetTokenHash +passwordResetExpiresAt');

  if (!user) {
    return apiSuccess({ expiresAt: null, message: genericMessage, resetUrl: null });
  }

  const resetToken = createPasswordResetToken();
  user.passwordResetTokenHash = resetToken.tokenHash;
  user.passwordResetExpiresAt = resetToken.expiresAt;
  await user.save();

  const resetUrl = new URL(`/reset-password/${resetToken.token}`, appEnv.authUrl).toString();

  return apiSuccess({
    expiresAt: resetToken.expiresAt.toISOString(),
    message: genericMessage,
    resetUrl: appEnv.isProduction ? null : resetUrl,
  });
}
