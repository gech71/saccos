import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  try {
    await prisma.userSession.updateMany({ where: { userId: user.id, revoked: false }, data: { revoked: true } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to revoke sessions', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
