
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { validateRefreshToken } from '@/lib/session-management';

const REFRESH_COOKIE_NAME = 'authjs.refresh-token';
const SESSION_COOKIE_NAME = 'authjs.session-token';

function buildSessionCookie(token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = 15 * 60; // 15 minutes
  // NextAuth uses httpOnly session cookies; mirror similar attributes
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isProd ? '; Secure' : ''}`;
}

export async function POST(req: NextRequest) {
  try {
    const cookies = req.cookies;
    const refresh = cookies.get(REFRESH_COOKIE_NAME)?.value;
    if (!refresh) return NextResponse.json({ error: 'Missing refresh token' }, { status: 401 });

    const signingKey = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (!signingKey) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });

    let payload: any;
    try {
      payload = jwt.verify(refresh, signingKey as string, { algorithms: ['HS256'] }) as any;
    } catch (err) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    if (payload?.type !== 'refresh' || !payload?.sub) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    const userId = payload.sub as string;
    const sessionId = payload.sessionId as string | undefined;

    // Determine user type and validate refresh token against database
    let userRecord = await prisma.user.findUnique({ where: { id: userId } });
    let memberRecord = null;
    let userType: 'user' | 'member' = 'user';
    
    if (userRecord) {
      userType = 'user';
    } else {
      memberRecord = await prisma.member.findUnique({ where: { id: userId } });
      if (!memberRecord) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      userType = 'member';
    }
    
    // Security: Validate refresh token exists in database and is bound to the correct session
    // This prevents use of revoked tokens and ensures sessionId binding is enforced
    const isValidSession = await validateRefreshToken(refresh, userId, userType, sessionId);
    if (!isValidSession) {
      return NextResponse.json({ error: 'Session expired or invalid' }, { status: 401 });
    }

    // Rebuild the user payload for access token. Prefer admin user then member.
    let tokenPayload: any = null;
    if (userRecord) {
      // admin user
      const userRoles = await prisma.role.findMany({ where: { users: { some: { id: userRecord.id } } } });
      const permissions = new Set<string>();
      const isAdmin = userRoles.some(r => r.name === 'Admin');
      if (isAdmin) permissions.add('admin');
      userRecord.roles = userRoles.map(r => r.name) as any;
      tokenPayload = {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        phoneNumber: userRecord.phoneNumber,
        isMember: false,
        roles: userRecord.roles,
        permissions: Array.from(permissions),
      };
    } else if (memberRecord) {
      tokenPayload = {
        id: memberRecord.id,
        name: memberRecord.fullName,
        email: memberRecord.email,
        phoneNumber: memberRecord.phoneNumber,
        isMember: true,
        mustChangePassword: memberRecord.mustChangePassword,
      };
    }

    // Sign new access token (15 minutes) with sessionId (jti) for session validation
    // The sessionId binding ensures access tokens are immediately invalidated when the session is revoked
    const accessToken = jwt.sign(
      { 
        user: tokenPayload,
        jti: sessionId, // Include sessionId (jti) to bind access token to the active session
      }, 
      signingKey as string, 
      {
        algorithm: 'HS256',
        expiresIn: '15m',
      }
    );

    const res = NextResponse.json({ ok: true });
    // Set session cookie
    res.headers.append('Set-Cookie', buildSessionCookie(accessToken));

    return res;
  } catch (err) {
    console.error('Refresh error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
