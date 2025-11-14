export { auth as middleware } from "@/auth"

// Optionally, don't invoke Middleware on some paths
// Read more: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|home|about|news|contact).*)"],
};
