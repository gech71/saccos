
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requirePermission } from '@/lib/authorization';

export async function POST(request: NextRequest) {
  // Require authenticated user with appropriate permission to trigger revalidation
  try {
    await requirePermission('setting:edit');
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
