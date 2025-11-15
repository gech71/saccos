import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  req: Request,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params;

    // Allow common safe chars including parentheses
    if (!filename || !/^[\w\-.()]+$/.test(filename)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const filePath = path.join(process.cwd(), 'uploads', filename);
    const data = await fs.readFile(filePath);

    // If this is a HEAD request, return headers only
    const method = (req as any).method?.toUpperCase() || 'GET';

    // Inspect first bytes to infer MIME type (fallback when extension is wrong)
    const header = data.slice(0, 16);
    let contentType = 'application/octet-stream';
    const ext = path.extname(filename).toLowerCase();

    if (ext === '.png' || header.slice(0, 4).toString('hex') === '89504e47') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg' || header.slice(0, 3).toString('hex') === 'ffd8ff') contentType = 'image/jpeg';
    else if (ext === '.jfif') contentType = 'image/jpeg';
    else if (ext === '.gif' || header.slice(0, 3).toString() === 'GIF') contentType = 'image/gif';
    else if (ext === '.webp' || header.slice(0, 4).toString() === 'RIFF') contentType = 'image/webp';
    else if (ext === '.svg') {
      // svg is text-based; do a lightweight check
      const asText = data.toString('utf8', 0, Math.min(data.length, 512));
      if (asText.includes('<svg')) contentType = 'image/svg+xml';
    } else if (ext === '.bmp' || header.slice(0,2).toString() === 'BM') contentType = 'image/bmp';
    else if (ext === '.tiff' || header.slice(0,4).toString('hex') === '49492a00' || header.slice(0,4).toString('hex') === '4d4d002a') contentType = 'image/tiff';
    else if (ext === '.ico' || header.slice(0,4).toString('hex') === '00000100') contentType = 'image/x-icon';
    else if (ext === '.heif' || ext === '.heic') contentType = 'image/heif';
    else if (ext === '.avif') contentType = 'image/avif';

    const headers = {
      'Content-Type': contentType,
      'Content-Length': String(data.length),
    } as Record<string, string>;

    if (method === 'HEAD') {
      return new NextResponse(null, { headers });
    }

    // Convert Buffer to Uint8Array for Response body typing
    return new NextResponse(new Uint8Array(data), { headers });

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return new NextResponse('Not found', { status: 404 });
    }

    console.error('Error reading uploaded file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
