import { apiSuccess } from '@/lib/api/response';

export async function GET() {
  return apiSuccess({
    service: 'zmeetings-api',
    status: 'alive',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
