import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { auth } from '@/auth';

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
  const refreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, signingKey as string, {
    algorithm: 'HS256',
    expiresIn: '7d',
  });

  const res = NextResponse.json({ ok: true });
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  const cookie = `${REFRESH_COOKIE_NAME}=${refreshToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isProd ? '; Secure; SameSite=Lax' : ''}`;
  res.headers.append('Set-Cookie', cookie);
  return res;
}
