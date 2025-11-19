
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { rateLimitCheck } from '@/lib/rate-limit';

export async function middleware(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  // Apply simple per-IP rate limiting for authentication endpoints
  try {
    const isAuthApi = pathname.startsWith('/api/auth');
    const isLoginPost = pathname === '/login' && request.method === 'POST';
    if (isAuthApi || isLoginPost) {
      const forwarded = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || '';
      const ip = forwarded.split(',')[0].trim() || 'unknown';
      const ipKey = `rl:ip:${ip}`;
      const ipLimit = Number(process.env.RATE_LIMIT_IP_LIMIT || 50);
      const windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 15 * 60);
      const check = await rateLimitCheck(ipKey, ipLimit, windowSeconds);
      if (!check.allowed) {
        return new NextResponse(JSON.stringify({ error: 'Too many requests from your network. Try again later.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }
    }
  } catch (err) {
    // If rate limiter errors, allow the request to proceed but log for investigation
    // eslint-disable-next-line no-console
    console.warn('Rate limiter middleware error:', err);
  }

  const response = NextResponse.next();

  const publicPaths = [
    "/login",
    "/forgot-password",
    "/reset-password",
    "/home",
    "/about",
    "/news",
    "/contact",
    "/api/auth",
    "/api/upload",
  ];

  if (publicPaths.some((path) => pathname.startsWith(path)) || pathname === "/") {
    return response;
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const user = session.user;

  // Handle forced password change for members
  if (user?.isMember && user.mustChangePassword && pathname !== '/member-change-password') {
    return NextResponse.redirect(new URL(`/member-change-password`, request.url));
  }
  
  if (user?.isMember && !user.mustChangePassword && pathname === '/member-change-password') {
    return NextResponse.redirect(new URL(`/member-profile/${user.id}`, request.url));
  }


  // Members allowed only profile and password change routes
  if (
    user?.isMember &&
    !pathname.startsWith(`/member-profile/${user.id}`) &&
    pathname !== "/member-change-password"
  ) {
    return NextResponse.redirect(new URL(`/member-profile/${user.id}`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
