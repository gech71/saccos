
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requirePermission } from '@/lib/authorization';
import { requireCsrf } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  // Require authenticated user with appropriate permission to trigger revalidation
  try {
    await requirePermission('setting:edit');
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Enforce CSRF token for revalidation actions which modify cache/state
  const csrfFromHeader = request.headers.get('x-csrf-token') || request.headers.get('x-xsrf-token') || request.headers.get('csrf-token');
  try {
    await requireCsrf(csrfFromHeader || undefined);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 });
  }

  const tag = request.nextUrl.searchParams.get('tag');

  if (!tag) {
    return NextResponse.json({ error: 'Tag parameter is required' }, { status: 400 });
  }

  try {
    revalidateTag(tag);
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (error) {
    console.error("Revalidation error:", error);
    return NextResponse.json({ error: 'Failed to revalidate' }, { status: 500 });
  }
}
