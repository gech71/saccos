import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  
  // Set a temporary cookie for CSRF token if it doesn't exist.
  // In a real app, this should be a secure, HTTP-only cookie.
  if (!request.cookies.has('X-CSRF-Token')) {
      const csrfToken = Buffer.from(crypto.randomUUID()).toString('base64');
      requestHeaders.append('cookie', `X-CSRF-Token=${csrfToken}; Path=/; SameSite=Strict`);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  
  const isDev = process.env.NODE_ENV === 'development';

  const csp = [
    "default-src 'self'",
    // Next.js requires 'unsafe-eval' in dev for HMR. 'strict-dynamic' allows trusted scripts to load other scripts.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ""}`,
    // Allow inline styles for component libraries, but keep scripts strict.
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    "img-src 'self' data: https://placehold.co https://play-lh.googleusercontent.com https://upload.wikimedia.org https://picsum.photos http://nibsaccos.nibbank.com.et https://nibsaccos.nibbank.com.et",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' https://generativelanguage.googleapis.com ${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL || ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'", 
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
