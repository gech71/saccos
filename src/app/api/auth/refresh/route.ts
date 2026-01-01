
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

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
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    if (payload?.type !== 'refresh' || !payload?.sub) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    const userId = payload.sub as string;

    // Validate server-side session id (sid) to ensure refresh token is tied to an active session
    const sid = payload.sid as string | undefined;
    if (!sid) {
      return NextResponse.json({ error: 'Invalid refresh token (no session)' }, { status: 401 });
    }

    const sessionRecord = await (prisma as any).userSession.findUnique({ where: { id: sid } });
    if (!sessionRecord || sessionRecord.userId !== userId || sessionRecord.revoked) {
      return NextResponse.json({ error: 'Session invalid or revoked' }, { status: 401 });
    }

    if (sessionRecord.expiresAt && sessionRecord.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    // Update last active timestamp
    await (prisma as any).userSession.update({ where: { id: sid }, data: { lastActiveAt: new Date() } });

    // Rebuild the user payload for access token. Prefer admin user then member.
    let userRecord = await prisma.user.findUnique({ where: { id: userId } });
    let tokenPayload: any = null;
    if (userRecord) {
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
      };
    } else {
      const member = await prisma.member.findUnique({ where: { id: userId } });
      if (!member) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      tokenPayload = {
        id: member.id,
        name: member.fullName,
        email: member.email,
        phoneNumber: member.phoneNumber,
        isMember: true,
        mustChangePassword: member.mustChangePassword,
      };
    }

    // Sign new access token (15 minutes)
    const accessToken = jwt.sign({ user: tokenPayload, sid }, signingKey as string, {
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
