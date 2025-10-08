import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  req: Request,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params;

    if (!filename || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const filePath = path.join(process.cwd(), 'uploads', filename);
    const data = await fs.readFile(filePath);

    // Detect MIME type based on extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';

    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.bmp') contentType = 'image/bmp';
    else if (ext === '.tiff') contentType = 'image/tiff';
    else if (ext === '.ico') contentType = 'image/x-icon';
    else if (ext === '.heif') contentType = 'image/heif';
    else if (ext === '.heic') contentType = 'image/heic';
    else if (ext === '.avif') contentType = 'image/avif';

    return new NextResponse(data, { headers: { 'Content-Type': contentType } });

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return new NextResponse('Not found', { status: 404 });
    }

    console.error('Error reading uploaded file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
