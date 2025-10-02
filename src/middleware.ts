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
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // 'unsafe-inline' is needed for many UI libraries
    "img-src 'self' data: https://placehold.co https://play-lh.googleusercontent.com https://upload.wikimedia.org https://picsum.photos http://nibsaccos.nibbank.com.et https://nibsaccos.nibbank.com.et http://localhost:9002",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' https://generativelanguage.googleapis.com ${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL || ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  // Also set the nonce in the response headers for easier access if needed, although reading from request is preferred for RSCs
  response.headers.set('x-nonce', nonce);
  
  // Other security headers are in next.config.ts and are still applied

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
