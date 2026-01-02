import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { auth } from '@/auth';

const CSRF_TTL_SECONDS = 15 * 60; // 15 minutes
const CSRF_COOKIE_NAME = 'csrf_token';
const SIGNING_KEY = process.env.CSRF_SIGNING_KEY || process.env.NEXTAUTH_SECRET || 'dev-secret';

export function generateCsrfTokenForSession(sid: string, userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sid,
    uid: userId,
    iat: now,
    exp: now + CSRF_TTL_SECONDS,
    type: 'csrf',
  } as const;
  return jwt.sign(payload, SIGNING_KEY, { algorithm: 'HS256' });
}

export function verifyCsrfToken(token: string) {
  try {
    const decoded = jwt.verify(token, SIGNING_KEY, { algorithms: ['HS256'] }) as any;
    if (decoded?.type !== 'csrf') throw new Error('Invalid CSRF token');
    return decoded as { sid: string; uid: string; iat: number; exp: number };
  } catch (err) {
    throw new Error('Invalid or expired CSRF token');
  }
}

export async function requireCsrf(tokenFromClient?: string) {
  // Ensure there's an authenticated session
  const session = await auth();
  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }

  const sid = (session as any).sid as string | undefined;
  const uid = (session as any).user?.id as string | undefined;
  if (!sid || !uid) {
    throw new Error('Invalid session for CSRF validation');
  }

  // Read cookie (double-submit cookie pattern)
  const cookieJar = cookies();
  const cookieToken = cookieJar.get(CSRF_COOKIE_NAME)?.value;

  if (!cookieToken || !tokenFromClient) {
    throw new Error('Missing CSRF token');
  }

  // Both cookie and client-provided token should be valid JWTs and equal
  if (cookieToken !== tokenFromClient) {
    throw new Error('CSRF token mismatch');
  }

  const payload = verifyCsrfToken(tokenFromClient);
  if (payload.sid !== sid || payload.uid !== uid) {
    throw new Error('CSRF token does not match session');
  }

  return true;
}

export const CSRF = {
  CSRF_TTL_SECONDS,
  CSRF_COOKIE_NAME,
  generateCsrfTokenForSession,
  verifyCsrfToken,
  requireCsrf,
};
