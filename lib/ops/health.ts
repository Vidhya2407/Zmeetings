import { appEnv, hasConfiguredAuthSecret } from '@/lib/config/env';
import { getMongoConnectionState, isDatabaseAvailable } from '@/lib/db/mongodb';

export type HealthStatus = 'pass' | 'warn' | 'fail';

export type HealthCheck = {
  status: HealthStatus;
  summary: string;
};

export type HealthSnapshot = {
  checks: {
    auth: HealthCheck;
    cache: HealthCheck & {
      defaultTtlSeconds: number;
      provider: string;
    };
    database: HealthCheck & {
      connectionStateAfter: ReturnType<typeof getMongoConnectionState>;
      connectionStateBefore: ReturnType<typeof getMongoConnectionState>;
      mode: 'mongo' | 'demo-fallback';
    };
    sfu: HealthCheck & {
      provider: string;
    };
  };
  environment: 'development' | 'production';
  httpStatus: number;
  ready: boolean;
  service: 'zmeetings-api';
  status: 'ok' | 'degraded' | 'down';
  uptimeSeconds: number;
};

function resolveOverallStatus(checks: HealthCheck[]) {
  if (checks.some((check) => check.status === 'fail')) {
    return 'fail';
  }
  if (checks.some((check) => check.status === 'warn')) {
    return 'warn';
  }
  return 'pass';
}

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const authCheck: HealthCheck = appEnv.isProduction && !hasConfiguredAuthSecret
    ? {
        status: 'fail',
        summary: 'AUTH_SECRET is not configured for production runtime.',
      }
    : {
        status: 'pass',
        summary: appEnv.isProduction ? 'Auth runtime secret is configured.' : 'Auth secret uses development configuration.',
      };

  const mongoStateBefore = getMongoConnectionState();
  const databaseAvailable = await isDatabaseAvailable();
  const mongoStateAfter = getMongoConnectionState();

  const databaseCheck: HealthSnapshot['checks']['database'] = databaseAvailable
    ? {
        status: 'pass',
        summary: 'MongoDB is reachable.',
        mode: 'mongo',
        connectionStateBefore: mongoStateBefore,
        connectionStateAfter: mongoStateAfter,
      }
    : {
        status: appEnv.isProduction ? 'fail' : 'warn',
        summary: appEnv.isProduction
          ? 'MongoDB is unavailable in production mode.'
          : 'MongoDB unavailable. Repositories operate in demo fallback mode.',
        mode: 'demo-fallback',
        connectionStateBefore: mongoStateBefore,
        connectionStateAfter: mongoStateAfter,
      };

  const cacheCheck: HealthSnapshot['checks']['cache'] = appEnv.cacheProvider === 'none'
    ? {
        status: 'warn',
        summary: 'Cache provider is disabled.',
        provider: appEnv.cacheProvider,
        defaultTtlSeconds: appEnv.cacheDefaultTtlSeconds,
      }
    : {
        status: 'pass',
        summary: `Cache provider "${appEnv.cacheProvider}" is enabled.`,
        provider: appEnv.cacheProvider,
        defaultTtlSeconds: appEnv.cacheDefaultTtlSeconds,
      };

  const sfuCheck: HealthSnapshot['checks']['sfu'] = appEnv.sfuProvider === 'livekit'
    ? (appEnv.livekitUrl && appEnv.livekitApiKey && appEnv.livekitApiSecret)
      ? {
          status: 'pass',
          summary: 'LiveKit SFU is configured.',
          provider: appEnv.sfuProvider,
        }
      : {
          status: appEnv.isProduction ? 'fail' : 'warn',
          summary: 'LiveKit SFU is selected but one or more required credentials are missing.',
          provider: appEnv.sfuProvider,
        }
    : {
        status: 'warn',
        summary: 'SFU provider is disabled.',
        provider: appEnv.sfuProvider,
      };

  const checks: HealthCheck[] = [authCheck, databaseCheck, cacheCheck, sfuCheck];
  const overall = resolveOverallStatus(checks);
  const httpStatus = overall === 'fail' ? 503 : 200;

  return {
    service: 'zmeetings-api',
    environment: appEnv.isProduction ? 'production' : 'development',
    status: overall === 'pass' ? 'ok' : overall === 'warn' ? 'degraded' : 'down',
    ready: overall !== 'fail',
    uptimeSeconds: Math.floor(process.uptime()),
    httpStatus,
    checks: {
      auth: authCheck,
      database: databaseCheck,
      cache: cacheCheck,
      sfu: sfuCheck,
    },
  };
}
