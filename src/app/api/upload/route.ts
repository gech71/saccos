import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'image/x-icon',
  'image/heif',
  'image/heic',
  'image/avif',
];

const ALLOWED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.ico', '.heif', '.heic', '.avif', '.jfif', '.jpgf'
];

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided.' }, { status: 400 });
    }

    // If the browser didn't populate file.type reliably, fall back to extension check
    const filenameFromClient = file.name || 'file';
    const ext = extname(filenameFromClient).toLowerCase();

    const hasValidMime = !!file.type && ALLOWED_MIME_TYPES.includes(file.type);
    const hasValidExt = ALLOWED_EXTENSIONS.includes(ext);

    if (!hasValidMime && !hasValidExt) {
      return NextResponse.json({ success: false, error: 'Invalid file type.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ success: false, error: 'Empty file.' }, { status: 400 });
    }

    const uploadDir = join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const safeName = filenameFromClient.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-.()]/g, '');
    const filename = `${Date.now()}-${safeName}`;
    const filePath = join(uploadDir, filename);

    await writeFile(filePath, buffer);
    const url = `/api/upload/${filename}`;
    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred during file upload.' },
      { status: 500 }
    );
  }
}
