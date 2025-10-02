import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Generate a random nonce
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const nonce = Buffer.from(array).toString('base64');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`,
    "img-src 'self' data: https://placehold.co https://play-lh.googleusercontent.com https://upload.wikimedia.org https://picsum.photos http://nibsaccos.nibbank.com.et https://nibsaccos.nibbank.com.et",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' https://generativelanguage.googleapis.com ${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL || ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",   // ✅ CSP modern protection
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);

  // ✅ Legacy clickjacking protection for older browsers
  response.headers.set('X-Frame-Options', 'SAMEORIGIN'); // or "DENY"

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
