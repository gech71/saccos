import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  req: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  if (!filename) return new NextResponse('Invalid filename', { status: 400 });

  const filePath = path.join(process.cwd(), 'uploads', filename);

  try {
    const data = await fs.readFile(filePath);
    const ext = filename.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';

    if (ext === 'png') contentType = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'gif') contentType = 'image/gif';
    else if (ext === 'webp') contentType = 'image/webp';
    else if (ext === 'svg') contentType = 'image/svg+xml';

    return new NextResponse(data, {
      headers: { 'Content-Type': contentType },
    });
  } catch {
    return new NextResponse('File not found', { status: 404 });
  }
}
