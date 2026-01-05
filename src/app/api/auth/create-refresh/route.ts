import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { auth } from '@/auth';
import { createActiveSession } from '@/lib/session-management';
import crypto from 'crypto';

const REFRESH_COOKIE_NAME = 'authjs.refresh-token';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const signingKey = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!signingKey) {
    console.error('Missing NEXTAUTH_SECRET for refresh token creation');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const user = session.user as any;
  
  // If there's no server-side session id (sid) available on the server session,
  // defer creating a new refresh token. This prevents generating a refresh token
  // bound to an unknown session id; the client will retry once the session
  // contains a stable `sid`.
  if (!(session as any).sid) {
    console.warn(`[CREATE-REFRESH] Server session has no sid for user ${user.id}; deferring refresh creation`);
    return NextResponse.json({ ok: true, deferred: true });
  }

  // If the client already has a valid refresh token cookie, avoid creating a new one
  // This prevents parallel requests or repeated navigations from creating multiple
  // sessions and causing unnecessary invalidations when MAX_CONCURRENT_SESSIONS = 1.
  const existingRefreshCookie = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (existingRefreshCookie) {
    try {
      const existingPayload = jwt.verify(existingRefreshCookie, signingKey as string, { algorithms: ['HS256'] }) as any;
      if (existingPayload?.type === 'refresh' && existingPayload?.sub === user.id) {
        const userType = user.isMember ? 'member' : 'user';
        const { validateRefreshToken } = await import('@/lib/session-management');
        const stillValid = await validateRefreshToken(existingRefreshCookie, user.id, userType, existingPayload.sessionId);
        if (stillValid) {
          const currentSid = (session as any).sid;
          // If the existing refresh token is bound to a different sessionId (sid)
          // we should create a new refresh token bound to the current sid. If we
          // skip creation, the access token issued for the new login (with a new
          // sid) may not match the active session.
          if (currentSid && existingPayload?.sessionId && existingPayload.sessionId !== currentSid) {
            console.log(`[CREATE-REFRESH] Existing refresh token bound to different sessionId (${existingPayload.sessionId}) — creating new refresh for current sid ${currentSid}`);
            // fall through to create a new refresh token bound to the current sid
          } else {
            console.log(`[CREATE-REFRESH] Existing refresh token valid for user ${user.id}, skipping creation`);
            return NextResponse.json({ ok: true });
          }
        }
      }
    } catch (e) {
      // Invalid cookie or verification failed - proceed to create a new refresh token
      console.debug('[CREATE-REFRESH] existing refresh cookie invalid or expired, creating new one');
    }
  }

  // Generate a sessionId to bind the refresh token. Prefer the server-issued
  // `sid` attached to the NextAuth session. Do NOT create server sessions here.
  const sessionId = (session as any).sid || crypto.randomUUID();
  console.log(`[CREATE-REFRESH] Creating refresh token for user ${user.id}, sessionId: ${sessionId}, sid available: ${!!(session as any).sid}`);
  const expiresIn = '7d';
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  
  // Create refresh token with sessionId (sid) in payload
  const refreshToken = jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
      sessionId: sessionId,
    },
    signingKey as string,
    {
      algorithm: 'HS256',
      expiresIn,
    }
  );
  // Persist an active session bound to this refresh token. This ensures the
  // refresh token is recorded server-side and concurrency limits are applied.
  try {
    const userType = (user as any).isMember ? 'member' : 'user';
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || null;
    // Force replacement to enforce single-session policies on login
    await createActiveSession({
      sessionId,
      userId: user.id,
      userType,
      refreshToken,
      ipAddress,
      userAgent: userAgent || undefined,
      expiresAt,
      forceReplace: true,
    });
  } catch (e) {
    console.error('[CREATE-REFRESH] Failed to persist active session', e);
    // Proceed to return the refresh token to the client even if DB write fails.
  }

  const res = NextResponse.json({ ok: true });
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  const sameSite = 'SameSite=Strict';
  const securePart = isProd ? '; Secure' : '';
  const cookie = `${REFRESH_COOKIE_NAME}=${refreshToken}; Path=/; HttpOnly; ${sameSite}; Max-Age=${maxAge}${securePart}`;
  res.headers.append('Set-Cookie', cookie);
  return res;
}
