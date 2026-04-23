const sanitizeEnvValue = (value: string | undefined) => value?.trim();

const isPlaceholderSecret = (value: string | undefined) => !value || value.includes('replace_with');
const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const normalizeCacheProvider = (value: string | undefined) => value === 'none' ? 'none' : 'memory';
const normalizeSfuProvider = (value: string | undefined) => value === 'livekit' ? 'livekit' : 'none';

export const appEnv = {
  authSecret: sanitizeEnvValue(process.env.AUTH_SECRET)
    || (process.env.NODE_ENV === 'production' ? undefined : 'dev-local-auth-secret-change-in-production'),
  authUrl: sanitizeEnvValue(process.env.AUTH_URL) || sanitizeEnvValue(process.env.NEXTAUTH_URL) || 'http://localhost:3000',
  mongoUri: sanitizeEnvValue(process.env.MONGODB_URI) || 'mongodb://localhost:27017/zstream',
  demoUserEmail: sanitizeEnvValue(process.env.DEMO_USER_EMAIL) || 'demo@zstream.app',
  demoUserPassword: sanitizeEnvValue(process.env.DEMO_USER_PASSWORD) || 'Demo1234',
  demoUserName: sanitizeEnvValue(process.env.DEMO_USER_NAME) || 'ZSTREAM Demo',
  stripeSecretKey: sanitizeEnvValue(process.env.STRIPE_SECRET_KEY),
  cacheProvider: normalizeCacheProvider(sanitizeEnvValue(process.env.CACHE_PROVIDER)),
  cacheDefaultTtlSeconds: parsePositiveInt(process.env.CACHE_DEFAULT_TTL_SECONDS, 300),
  sfuProvider: normalizeSfuProvider(sanitizeEnvValue(process.env.SFU_PROVIDER)),
  livekitUrl: sanitizeEnvValue(process.env.LIVEKIT_URL) || sanitizeEnvValue(process.env.NEXT_PUBLIC_LIVEKIT_URL),
  livekitApiKey: sanitizeEnvValue(process.env.LIVEKIT_API_KEY),
  livekitApiSecret: sanitizeEnvValue(process.env.LIVEKIT_API_SECRET),
  isProduction: process.env.NODE_ENV === 'production',
};

export const hasConfiguredAuthSecret = !isPlaceholderSecret(appEnv.authSecret);
export const hasConfiguredStripeSecret = !isPlaceholderSecret(appEnv.stripeSecretKey);

function isProductionBuildPhase() {
  const nextPhase = process.env.NEXT_PHASE ?? '';
  return nextPhase === 'phase-production-build' || nextPhase === 'phase-export';
}

export function assertProductionAuthEnv() {
  // Do not hard-fail during build artifact generation; enforce at runtime.
  if (appEnv.isProduction && !isProductionBuildPhase() && !hasConfiguredAuthSecret) {
    throw new Error('AUTH_SECRET must be configured with a non-placeholder value in production.');
  }
}
