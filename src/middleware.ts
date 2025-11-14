
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextResponse) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/forgot-password', '/reset-password', '/home', '/about', '/news', '/contact', '/api/auth'];

  // Allow all API routes for auth and public pages to be accessed
  if (publicPaths.some(path => pathname.startsWith(path)) || pathname === '/') {
    return NextResponse.next();
  }

  // If there's no session, redirect to login
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(loginUrl);
  }
  
  // If a member is logged in, they should only access their profile page
  if (session.user?.isMember && !pathname.startsWith('/member-profile')) {
      const profileUrl = new URL(`/member-profile/${session.user.id}`, request.url);
      return NextResponse.redirect(profileUrl);
  }

  // If an admin is trying to access a member-only page, redirect them
  if (!session.user?.isMember && pathname.startsWith('/member-profile')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes, but we want to protect some)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
