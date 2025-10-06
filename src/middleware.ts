import { NextRequest, NextResponse } from "next/server";

// 🔸 Securely generate a per-request nonce for inline scripts/styles
function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("base64");
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();

  // 🔸 Allow only trusted origins for CORS
  const allowedOrigins = [
    "https://nibsaccos.nibbank.com.et",
    "http://localhost:3000",
  ];
  const origin = request.headers.get("origin");

  // 🔸 Build a strong CSP header
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}';
    style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https://placehold.co https://play-lh.googleusercontent.com https://upload.wikimedia.org https://picsum.photos https://nibsaccos.nibbank.com.et;
    connect-src 'self' ${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL || ""};
    frame-ancestors 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
  `.replace(/\s{2,}/g, " ").trim();

  // 🔸 Handle preflight requests early (CORS OPTIONS)
  if (request.method === "OPTIONS") {
    const preflight = new NextResponse(null, { status: 204 });
    if (origin && allowedOrigins.includes(origin)) {
      preflight.headers.set("Access-Control-Allow-Origin", origin);
      preflight.headers.set("Vary", "Origin");
      preflight.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      preflight.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    return preflight;
  }

  // 🔸 Clone request headers to include nonce downstream
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // ✅ Apply CSP header
  response.headers.set("Content-Security-Policy", cspHeader);

  // ✅ Add strong security headers
  response.headers.set("X-Frame-Options", "SAMEORIGIN"); // Anti-clickjacking
  response.headers.set("X-Content-Type-Options", "nosniff"); // MIME sniffing protection
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin"); // Restrict referrer data
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  // ✅ Secure CORS handling
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
  }

  // ✅ Remove potentially leaky headers
  response.headers.delete("Server");
  response.headers.delete("X-Powered-By");

  return response;
}

// ✅ Apply middleware to all routes except Next.js internals and assets
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
