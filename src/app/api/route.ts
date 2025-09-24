import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

export async function POST(req: NextRequest) {
  const data = await req.formData();
  const file = data.get('file') as unknown as File;

  if (!file) return NextResponse.json({ success: false, error: 'No file provided.' }, { status: 400 });
  if (!ALLOWED_MIME_TYPES.includes(file.type)) return NextResponse.json({ success: false, error: 'Invalid file type.' }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadDir = join(process.cwd(), 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
  const filePath = join(uploadDir, filename);

  try {
    await writeFile(filePath, buffer);
    const url = `/api/upload/${filename}`;
    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Could not save file.' }, { status: 500 });
  }
}
