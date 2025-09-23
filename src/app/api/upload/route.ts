
import {NextRequest, NextResponse} from 'next/server';
import {writeFile} from 'fs/promises';
import {join} from 'path';
import {mkdir} from 'fs/promises';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
  'image/jfif', 
];

// This function handles POST requests to /api/upload
export async function POST(request: NextRequest) {
  const data = await request.formData();
  const file: File | null = data.get('file') as unknown as File;

  if (!file) {
    return NextResponse.json({success: false, error: 'No file provided.'});
  }
  
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ success: false, error: `Invalid file type. Only ${ALLOWED_MIME_TYPES.join(', ')} are allowed.` }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Ensure the uploads directory exists
  const uploadDir = join(process.cwd(), 'public/uploads');
  try {
    await mkdir(uploadDir, {recursive: true});
  } catch (error) {
    console.error('Error creating upload directory:', error);
    return NextResponse.json({
      success: false,
      error: 'Could not create upload directory.',
    });
  }

  // Create a unique filename
  const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
  const path = join(uploadDir, filename);

  try {
    await writeFile(path, buffer);
    console.log(`File saved to ${path}`);

    // Return the public URL path
    const url = `/uploads/${filename}`;
    return NextResponse.json({success: true, url: url});
  } catch (error) {
    console.error('Error saving file:', error);
    return NextResponse.json({
      success: false,
      error: 'An error occurred while saving the file.',
    });
  }
}
