import { apiSuccess } from '@/lib/api/response';
import { getHealthSnapshot } from '@/lib/ops/health';

export async function GET() {
  const snapshot = await getHealthSnapshot();

  return apiSuccess(
    {
      service: snapshot.service,
      environment: snapshot.environment,
      status: snapshot.status,
      ready: snapshot.ready,
      uptimeSeconds: snapshot.uptimeSeconds,
      checks: snapshot.checks,
    },
    {},
    snapshot.httpStatus,
  );
}
