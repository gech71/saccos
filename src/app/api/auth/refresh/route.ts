
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { AuthUser, MemberAuthUser } from '@/types';

const REFRESH_COOKIE_NAME = 'authjs.refresh-token';
const SESSION_COOKIE_NAME = 'authjs.session-token';

function buildSessionCookie(token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = 15 * 60; // 15 minutes
  // NextAuth uses httpOnly session cookies; mirror similar attributes
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isProd ? '; Secure' : ''}`;
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
      console.log('[REFRESH_API] Invalid refresh token received.');
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    if (payload?.type !== 'refresh' || !payload?.sub) {
      console.log('[REFRESH_API] Malformed refresh token payload.');
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    const userId = payload.sub as string;
    const tokenSessionVersion = payload.sessionVersion as number;

    console.log(`[REFRESH_API] Refresh requested for user ${userId}. Token sessionVersion: ${tokenSessionVersion}`);

    // Rebuild the user payload for access token. Prefer admin user then member.
    let userRecord = await prisma.user.findUnique({ where: { id: userId } });
    let tokenPayload: AuthUser | MemberAuthUser | null = null;
    if (userRecord) {
        console.log(`[REFRESH_API] Found admin user. DB sessionVersion: ${userRecord.sessionVersion}`);
        // Validate session version
        if (userRecord.sessionVersion !== tokenSessionVersion) {
            console.log(`[REFRESH_API] Session version mismatch for admin ${userId}. Token: ${tokenSessionVersion}, DB: ${userRecord.sessionVersion}. Invalidating session.`);
            return NextResponse.json({ error: 'Session has been invalidated.' }, { status: 401 });
        }
      // admin user
      const userRoles = await prisma.role.findMany({ where: { users: { some: { id: userRecord.id } } } });
      const permissions = new Set<string>();
      const isAdmin = userRoles.some(r => r.name === 'Admin');
      if (isAdmin) permissions.add('admin');
      
      const roles = userRoles.map(r => r.name);
      
      tokenPayload = {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        phoneNumber: userRecord.phoneNumber,
        isMember: false,
        roles,
        permissions: Array.from(permissions),
        sessionVersion: userRecord.sessionVersion,
      };
    } else {
      const member = await prisma.member.findUnique({ where: { id: userId } });
      if (!member) {
        console.log(`[REFRESH_API] User/Member with ID ${userId} not found in DB.`);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      console.log(`[REFRESH_API] Found member. DB sessionVersion: ${member.sessionVersion}`);
       // Validate session version
        if (member.sessionVersion !== tokenSessionVersion) {
            console.log(`[REFRESH_API] Session version mismatch for member ${userId}. Token: ${tokenSessionVersion}, DB: ${member.sessionVersion}. Invalidating session.`);
            return NextResponse.json({ error: 'Session has been invalidated.' }, { status: 401 });
        }
      tokenPayload = {
        id: member.id,
        name: member.fullName,
        email: member.email,
        phoneNumber: member.phoneNumber,
        isMember: true,
        mustChangePassword: member.mustChangePassword,
        sessionVersion: member.sessionVersion,
      };
    }

    console.log(`[REFRESH_API] Session for ${userId} is valid. Generating new access token.`);
    // Sign new access token (15 minutes)
    const accessToken = jwt.sign({ user: tokenPayload }, signingKey as string, {
      algorithm: 'HS256',
      expiresIn: '15m',
    });

    const res = NextResponse.json({ ok: true });
    // Set session cookie
    res.headers.append('Set-Cookie', buildSessionCookie(accessToken));

    return res;
  } catch (err) {
    console.error('Refresh error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
