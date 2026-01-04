import { NextResponse, NextRequest } from 'next/server';
import { invalidateSessionByRefreshToken } from '@/lib/session-management';
import { requireCsrf } from '@/lib/csrf';

const REFRESH_COOKIE_NAME = 'authjs.refresh-token';

export async function POST(req: NextRequest) {
  // Require CSRF token for logout/clear-refresh
  const csrfFromHeader = req.headers.get('x-csrf-token') || req.headers.get('x-xsrf-token') || req.headers.get('csrf-token');
  try {
    await requireCsrf(csrfFromHeader || undefined);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 });
  }
  // Get refresh token from cookie before clearing it
  const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  
  // Invalidate the session in database if refresh token exists
  if (refreshToken) {
    try {
      await invalidateSessionByRefreshToken(refreshToken);
    } catch (error) {
      console.error('Error invalidating session on logout:', error);
      // Continue anyway - cookie will still be cleared
    }
  }
  
  const res = NextResponse.json({ ok: true });
  const isProd = process.env.NODE_ENV === 'production';
  // Clear cookie
  res.headers.append('Set-Cookie', `${REFRESH_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; SameSite=Strict${isProd ? '; Secure' : ''}`);
  return res;
}
