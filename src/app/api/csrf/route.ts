import { NextResponse } from 'next/server';
import { CSRF } from '@/lib/csrf';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sid = (session as any).sid as string;
  const uid = (session as any).user?.id as string;
  if (!sid || !uid) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const token = CSRF.generateCsrfTokenForSession(sid, uid);

  const res = NextResponse.json({ csrfToken: token });
  // Set a readable cookie (double-submit cookie). Not httpOnly because client needs to read.
  const isProd = process.env.NODE_ENV === 'production';
  res.headers.append('Set-Cookie', `${CSRF.CSRF_COOKIE_NAME}=${token}; Path=/; SameSite=Strict; Max-Age=${CSRF.CSRF_TTL_SECONDS}${isProd ? '; Secure' : ''}`);
  return res;
}
