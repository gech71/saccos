
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  // Buffer is not available in the Edge runtime; use btoa instead
  return btoa(String.fromCharCode(...array));
}

export async function middleware(request: NextRequest) {
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

  // --- AUTH (EDGE-SAFE) ---
  const hasSessionCookie = SESSION_COOKIES.some((name) =>
    request.cookies.get(name)
  );

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Server-side validation: call the validate-session endpoint (server runtime) to ensure the session
  // referenced by the cookie is active and not revoked. We forward cookies so the server can inspect them.
  try {
    const validateUrl = new URL('/api/auth/validate-session', request.url).toString();
    const validation = await fetch(validateUrl, {
      method: 'POST',
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
    });

    if (!validation.ok) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', request.url);
      return NextResponse.redirect(loginUrl);
    }
  } catch (err) {
    // If validation fails unexpectedly, treat as unauthenticated to be safe
    console.error('Session validation failed:', err);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
