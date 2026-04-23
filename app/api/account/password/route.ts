import { hash, verify } from 'argon2';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { apiError, apiSuccess } from '@/lib/api/response';
import dbConnect from '@/lib/db/mongodb';
import User from '@/lib/models/User';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8),
}).superRefine((value, ctx) => {
  if (value.newPassword !== value.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'New password and confirmation must match.',
      path: ['confirmPassword'],
    });
  }

  if (value.currentPassword === value.newPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'New password must be different from your current password.',
      path: ['newPassword'],
    });
  }
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return apiError('You must be signed in to change your password.', 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid password update request.', 400);
  }

  const connection = await dbConnect();
  if (!connection) {
    return apiError('Database unavailable. Please try again shortly.', 503, { _demoMode: true });
  }

  const user = await User.findOne({ email: session.user.email.toLowerCase() }).select('+password');
  if (!user?.password) {
    return apiError('Account not found.', 404);
  }

  const passwordsMatch = await verify(user.password, parsed.data.currentPassword);
  if (!passwordsMatch) {
    return apiError('Current password is incorrect.', 400);
  }

  user.password = await hash(parsed.data.newPassword);
  await user.save();

  return apiSuccess({ updated: true });
}



