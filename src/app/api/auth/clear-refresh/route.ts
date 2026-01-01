import { NextResponse, NextRequest } from 'next/server';
import { invalidateSessionByRefreshToken } from '@/lib/session-management';

const REFRESH_COOKIE_NAME = 'authjs.refresh-token';

export async function POST(req: NextRequest) {
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
