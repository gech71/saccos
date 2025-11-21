
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import {
  getFirstPermittedRoute,
  getRequiredPermission,
} from "@/lib/route-permissions";

function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("base64");
}

export async function middleware(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  // --- CSP ---
  const response = NextResponse.next();

  const nonce = generateNonce();

  const isProd = process.env.NODE_ENV === "production";

  const scriptSources = isProd
    ? ["'self'", `'nonce-${nonce}'`, "https://nibsaccos.nibbank.com.et"]
    : ["'self'", `'nonce-${nonce}'`, "http://localhost:3000"];

  const csp = `
    default-src 'self';
    script-src ${scriptSources.join(" ")};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: blob:;
    connect-src 'self' ${isProd ? "https://nibsaccos.nibbank.com.et" : "http://localhost:3000"};
    frame-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\n/g, " ");

  response.headers.set("Content-Security-Policy", csp);

  // --- PUBLIC PATHS ---
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

  if (publicPaths.some((p) => pathname.startsWith(p)) || pathname === "/") {
    return response;
  }

  // --- AUTH ---
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const user = session.user as any;

  // --- MUST CHANGE PASSWORD ---
  if (user?.mustChangePassword) {
    const changePasswordPath = user.isMember ? '/member-change-password' : '/admin-change-password';
    if (pathname !== changePasswordPath) {
      return NextResponse.redirect(new URL(changePasswordPath, request.url));
    }
  }

  if (user && !user.mustChangePassword && (pathname === '/member-change-password' || pathname === '/admin-change-password')) {
     const redirectTarget = user.isMember ? `/member-profile/${user.id}` : getFirstPermittedRoute(user.permissions || []);
     return NextResponse.redirect(new URL(redirectTarget, request.url));
  }


  // --- MEMBER ONLY PATHS ---
  if (
    user?.isMember &&
    !pathname.startsWith(`/member-profile/${user.id}`) &&
    pathname !== "/member-change-password"
  ) {
    return NextResponse.redirect(
      new URL(`/member-profile/${user.id}`, request.url)
    );
  }

  // --- ADMIN PERMISSION CHECK ---
  const requiredPermission =
    !user?.isMember && getRequiredPermission(pathname);

  if (requiredPermission) {
    const permissions: string[] = Array.isArray((user as any).permissions)
      ? (user as any).permissions
      : [];
    if (!permissions.includes(requiredPermission)) {
      const redirectTarget = getFirstPermittedRoute(permissions);
      const redirectUrl = new URL(redirectTarget, request.url);
      redirectUrl.searchParams.set("error", "forbidden");
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
