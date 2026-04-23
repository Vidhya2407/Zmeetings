import { NextResponse } from 'next/server';
import { renderPrometheusMetrics } from '@/lib/ops/metrics';

function isAuthorized(request: Request) {
  const metricsAccessToken = process.env.METRICS_ACCESS_TOKEN?.trim();
  if (!metricsAccessToken) {
    return true;
  }

  return request.headers.get('authorization') === `Bearer ${metricsAccessToken}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new NextResponse('Unauthorized\n', { status: 401 });
  }

  const body = await renderPrometheusMetrics();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
