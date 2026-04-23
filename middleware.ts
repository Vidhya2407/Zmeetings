import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const normalizedLegalPath = pathname.endsWith('=') ? pathname.slice(0, -1) : pathname;
  if (
    normalizedLegalPath !== pathname
    && ['/privacy-policy', '/cookie-policy', '/terms-of-service'].includes(normalizedLegalPath)
  ) {
    const legalUrl = request.nextUrl.clone();
    legalUrl.pathname = normalizedLegalPath;
    legalUrl.search = search;
    return NextResponse.redirect(legalUrl);
  }

  if (pathname === '/api/auth/error') {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = search;
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/auth/error', '/privacy-policy=', '/cookie-policy=', '/terms-of-service='],
};
