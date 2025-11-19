
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

export async function middleware(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

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
    !pathname.startsWith("/member-change-password")
  ) {
    return NextResponse.redirect(new URL(`/member-profile/${user.id}`, request.url));
  }

  // Admin shouldn't access member-only routes
  if (
    !user?.isMember &&
    (pathname.startsWith("/member-profile") || pathname.startsWith("/member-change-password"))
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
