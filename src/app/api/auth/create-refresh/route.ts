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
  
  // Generate a unique session ID for tracking
  // Use the session ID from NextAuth (jti) if available to link the sessions
  const sessionId = (session as any).jti || crypto.randomUUID();
  console.log(`[CREATE-REFRESH] Creating session for user ${user.id}, sessionId: ${sessionId}, jti available: ${!!(session as any).jti}`);
  const expiresIn = '7d';
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  
  // Create refresh token with sessionId in payload
  const refreshToken = jwt.sign(
    { 
      sub: user.id, 
      type: 'refresh',
      sessionId: sessionId, // Include sessionId for tracking
    }, 
    signingKey as string, 
    {
      algorithm: 'HS256',
      expiresIn,
    }
  );

  // Track the session in database (this will enforce concurrency limits)
  try {
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = req.headers.get('user-agent') || undefined;
    
    await createActiveSession({
      sessionId,
      userId: user.id,
      userType: user.isMember ? 'member' : 'user',
      refreshToken,
      ipAddress,
      userAgent,
      expiresAt,
    });
  } catch (error) {
    console.error('Error creating active session:', error);
    // Continue anyway - the refresh token is still valid
    // Session tracking failure shouldn't block authentication
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
