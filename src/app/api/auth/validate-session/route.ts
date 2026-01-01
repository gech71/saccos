import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

const REFRESH_COOKIE_NAME = 'authjs.refresh-token';
const SESSION_COOKIE_NAME = 'authjs.session-token';
const NEXTAUTH_SECURE = '__Secure-next-auth.session-token';
const NEXTAUTH_UNSECURE = 'next-auth.session-token';

export async function POST(req: NextRequest) {
  try {
    const cookies = req.cookies;
    const signingKey = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (!signingKey) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });

    // Try our session cookie first, then fallback to NextAuth cookies
    const token = cookies.get(SESSION_COOKIE_NAME)?.value ?? cookies.get(NEXTAUTH_SECURE)?.value ?? cookies.get(NEXTAUTH_UNSECURE)?.value;
    if (!token) return NextResponse.json({ error: 'Missing session token' }, { status: 401 });

    let payload: any;
    try {
      payload = jwt.verify(token, signingKey as string, { algorithms: ['HS256'] }) as any;
    } catch (err) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    const sid = payload?.sid as string | undefined;
    if (!sid) return NextResponse.json({ error: 'Session not bound' }, { status: 401 });

    const sessionRecord = await (prisma as any).userSession.findUnique({ where: { id: sid } });
    if (!sessionRecord || sessionRecord.revoked) return NextResponse.json({ error: 'Session invalid or revoked' }, { status: 401 });
    if (sessionRecord.expiresAt && sessionRecord.expiresAt < new Date()) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

    // Optionally update lastActiveAt
    await (prisma as any).userSession.update({ where: { id: sid }, data: { lastActiveAt: new Date() } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Validate session error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
