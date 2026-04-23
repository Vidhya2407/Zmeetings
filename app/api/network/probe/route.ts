const PROBE_BYTES = 64 * 1024;
const PROBE_PAYLOAD = '0'.repeat(PROBE_BYTES);

export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(PROBE_PAYLOAD, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Length': String(PROBE_BYTES),
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Network-Probe-Bytes': String(PROBE_BYTES),
      'X-Network-Probe-Time': new Date().toISOString(),
    },
  });
}
