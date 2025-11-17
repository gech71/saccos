import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

// Edge-safe nonce generator
function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("base64");
}

export async function middleware(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  const response = NextResponse.next();

  // ---- CSP + NONCE ----
  const nonce = generateNonce();
  response.headers.set("x-nonce", nonce);

  const csp = `
  default-src 'self';
  script-src 'self' 'nonce-${nonce}' https:;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob: https://* http://*;
  connect-src 'self' https:;
  frame-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\n/g, " ");


  response.headers.set("Content-Security-Policy", csp);
  // ----------------------

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

  // Force members to change password
  if (
    user?.isMember &&
    user.mustChangePassword &&
    !pathname.startsWith("/member-login/change-password")
  ) {
    const url = new URL("/member-login/change-password", request.url);
    url.searchParams.set("memberId", user.id);
    return NextResponse.redirect(url);
  }

  // Members allowed only profile routes
  if (
    user?.isMember &&
    !pathname.startsWith("/member-profile") &&
    !pathname.startsWith("/member-login/change-password")
  ) {
    return NextResponse.redirect(new URL(`/member-profile/${user.id}`, request.url));
  }

  // Admin shouldn't access member-only routes
  if (
    !user?.isMember &&
    (pathname.startsWith("/member-profile") ||
      pathname.startsWith("/member-login/change-password"))
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};