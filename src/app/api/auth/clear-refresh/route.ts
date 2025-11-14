import { NextResponse, NextRequest } from 'next/server';

const REFRESH_COOKIE_NAME = 'authjs.refresh-token';

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  // Clear cookie
  res.headers.append('Set-Cookie', `${REFRESH_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
  return res;
}
