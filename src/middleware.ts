import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';

export async function middleware(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  // ------ CSP + NONCE ------
  const response = NextResponse.next();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  response.headers.set("x-nonce", nonce);

  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' https:;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self';
    connect-src 'self';
    frame-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\n/g, " ");

  response.headers.set("Content-Security-Policy", csp);
  // --------------------------

  const publicPaths = [
    '/login',
    '/forgot-password',
    '/reset-password',
    '/home',
    '/about',
    '/news',
    '/contact',
    '/api/auth'
  ];

  // Allow public routes
  if (publicPaths.some(path => pathname.startsWith(path)) || pathname === '/') {
    return response;
  }

  // Not logged in → redirect to login
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const user = session.user;

  // Members forced to change password
  if (
    user?.isMember &&
    user.mustChangePassword &&
    !pathname.startsWith('/member-login/change-password')
  ) {
    const changePasswordUrl = new URL(`/member-login/change-password`, request.url);
    changePasswordUrl.searchParams.set('memberId', user.id);
    return NextResponse.redirect(changePasswordUrl);
  }

  // Members can only access their profile
  if (
    user?.isMember &&
    !pathname.startsWith('/member-profile') &&
    !pathname.startsWith('/member-login/change-password')
  ) {
    const profileUrl = new URL(`/member-profile/${user.id}`, request.url);
    return NextResponse.redirect(profileUrl);
  }

  // Admin trying to access member-only pages
  if (
    !user?.isMember &&
    (pathname.startsWith('/member-profile') ||
     pathname.startsWith('/member-login/change-password'))
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
