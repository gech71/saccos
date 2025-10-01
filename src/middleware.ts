import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  // Use Web Crypto API (Edge Runtime safe)
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const nonce = Buffer.from(array).toString('base64');

  // Forward the nonce in a request header
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
