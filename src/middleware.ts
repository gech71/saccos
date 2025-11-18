
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
    // allow anonymous uploads and public access to uploaded files
    "/api/upload",
  ];

  if (publicPaths.some((path) => pathname.startsWith(path)) || pathname === "/") {
    return response;
  }

  // Not logged in → redirect
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const user = session.user;

  // Members allowed only profile routes
  if (
    user?.isMember &&
    !pathname.startsWith("/member-profile")
  ) {
    return NextResponse.redirect(new URL(`/member-profile/${user.id}`, request.url));
  }

  // Admin shouldn't access member-only routes
  if (
    !user?.isMember &&
    (pathname.startsWith("/member-profile"))
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
