import { createHash, randomBytes } from 'crypto';

export const PASSWORD_RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

export function hashPasswordResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createPasswordResetToken() {
  const token = randomBytes(32).toString('hex');
  return {
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    token,
    tokenHash: hashPasswordResetToken(token),
  };
}
