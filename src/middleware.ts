import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { rateLimitCheck } from "@/lib/rate-limit";

function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("base64");
}

export async function middleware(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  // --- RATE LIMITING FOR AUTH ---
  try {
    const isAuthApi = pathname.startsWith('/api/auth');
    const isLoginPost = pathname === '/login' && request.method === 'POST';

    if (isAuthApi || isLoginPost) {
      const forwarded = 
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        request.headers.get('cf-connecting-ip') ||
        "";

      const ip = forwarded.split(',')[0].trim() || "unknown";

      const ipKey = `rl:ip:${ip}`;
      const ipLimit = Number(process.env.RATE_LIMIT_IP_LIMIT || 50);
      const windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 15 * 60);

      const check = await rateLimitCheck(ipKey, ipLimit, windowSeconds);
      if (!check.allowed) {
        return new NextResponse(
          JSON.stringify({ error: "Too many requests. Try again later." }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  } catch (err) {
    console.warn("Rate limiter error:", err);
  }

  // --- RESPONSE WITH CSP ---
  const response = NextResponse.next();

  const nonce = generateNonce();
  response.headers.set("x-nonce", nonce);

 const isProd = process.env.NODE_ENV === "production";

const scriptSources = isProd
  ? ["'self'", `'nonce-${nonce}'`, "https://nibsaccos.nibbank.com.et"]
  : ["'self'", `'nonce-${nonce}'`, "http://localhost:3000/"];

const csp = `
  default-src 'self';
  script-src ${scriptSources.join(" ")};
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob:;
  connect-src 'self' ${isProd ? "https://nibsaccos.nibbank.com.et" : "http://localhost:3000/"} ;
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

  // --- AUTH REQUIRED ---
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const user = session.user;

  // --- MEMBER PASSWORD CHANGE ---
  if (user?.isMember && user.mustChangePassword && pathname !== "/member-change-password") {
    return NextResponse.redirect(new URL("/member-change-password", request.url));
  }

  if (!user?.mustChangePassword && pathname === "/member-change-password") {
    return NextResponse.redirect(new URL(`/member-profile/${user.id}`, request.url));
  }

  // --- MEMBER ROUTES ONLY ---
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
