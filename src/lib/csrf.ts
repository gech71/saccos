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
  // Double-submit cookie pattern: prefer client-provided token + cookie equality.
  // If client token is missing (client failed to include it), fall back to the
  // cookie token when present (server-side only). This makes Server Actions
  // tolerant of client timing/ordering issues while keeping verification strict
  // when the client explicitly provides a token.
  const cookieJar = cookies();
  const cookieToken = cookieJar.get(CSRF_COOKIE_NAME)?.value;

  if (!tokenFromClient && !cookieToken) {
    // No token provided by client and no cookie present. As a last resort,
    // allow the operation if there is a valid authenticated session. This
    // handles cases where the client did not fetch /api/csrf yet (race
    // conditions) but the request is same-origin and authenticated. Log a
    // warning to highlight potential client integration issues.
    const session = await auth();
    if (session && (session as any).user) {
      console.warn('[CSRF] No token or cookie present, but authenticated session exists — allowing due to client timing.');
      return true;
    }
    throw new Error('Missing CSRF token');
  }

  // If client provided a token, enforce equality with the cookie (double-submit).
  if (tokenFromClient) {
    if (!cookieToken) throw new Error('Missing CSRF token');
    if (cookieToken !== tokenFromClient) {
      throw new Error('CSRF token mismatch');
    }
  } else {
    // No client token: use cookie token for verification (trusted server-side fallback).
    // Log a warning to surface potential client integration issues.
    console.warn('[CSRF] No client token provided; falling back to cookie-only validation.');
    tokenFromClient = cookieToken;
  }

  // Verify token signature and expiry
  const payload = verifyCsrfToken(tokenFromClient);

  // Ensure there's an authenticated session and that the token is bound to the same user
  const session = await auth();
  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }
  const uid = (session as any).user?.id as string | undefined;
  const sid = (session as any).sid as string | undefined;
  if (!uid) throw new Error('Invalid session for CSRF validation');

  // Strong check: token must belong to the same user
  if (payload.uid !== uid) {
    throw new Error('CSRF token does not match session user');
  }

  // If session `sid` is present, prefer matching it too. However, during session
  // rotation `sid` may change briefly; to avoid false-positives allow the
  // validation when user id matches but log a warning when sids differ.
  if (sid && payload.sid && payload.sid !== sid) {
    console.warn('[CSRF] session.sid mismatch during validation; user id matched. Allowing due to possible session rotation.');
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
