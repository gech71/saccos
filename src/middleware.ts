import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  // Use Web Crypto API (Edge Runtime safe)
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const nonce = Buffer.from(array).toString('base64');

  // Forward the nonce in a request header
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // Note: 'unsafe-eval' is required for Next.js in development mode.
  // It is conditionally removed for production builds to enhance security.
  const scriptSrc = `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''}`;

  const cspHeader = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https://placehold.co https://play-lh.googleusercontent.com https://upload.wikimedia.org https://picsum.photos http://nibsaccos.nibbank.com.et https://nibsaccos.nibbank.com.et",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' https://generativelanguage.googleapis.com ${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL || ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Attach nonce so frontend can inject it into <script nonce="...">
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
