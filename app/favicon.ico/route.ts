export const dynamic = 'force-dynamic';

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0A0F18"/><path d="M20 34c0-10 7-18 19-18 3 0 6 1 9 2-2 11-9 25-24 25h-4v-9Z" fill="#00E5BA"/><path d="M17 45c9-1 18-7 25-21" fill="none" stroke="#0A0F18" stroke-width="4" stroke-linecap="round"/></svg>`;

export function GET(request: Request) {
  const accept = request.headers.get('accept') ?? '';
  const fetchDest = request.headers.get('sec-fetch-dest') ?? '';

  if (fetchDest === 'document' || accept.includes('text/html')) {
    return Response.redirect(new URL('/meet', request.url), 307);
  }

  return new Response(faviconSvg, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'image/svg+xml',
    },
  });
}
