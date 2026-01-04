import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomBytes } from 'crypto';
import { auth } from '@/auth';
import { requireCsrf } from '@/lib/csrf';

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

// Max upload size in bytes (5 MB)
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024);

export async function POST(req: NextRequest) {
  try {
    // Require authenticated session to upload files. This prevents anonymous abuse.
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    // Read formData once so we can extract CSRF token along with file
    const data = await req.formData();
    const csrfToken = data.get('csrfToken')?.toString() || data.get('csrf')?.toString() || req.headers.get('x-csrf-token') || req.headers.get('csrf-token');
    try {
      await requireCsrf(csrfToken || undefined);
    } catch (err) {
      return NextResponse.json({ success: false, error: 'Invalid or missing CSRF token' }, { status: 403 });
    }

    const file = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided.' }, { status: 400 });
    }

    // If the browser didn't populate file.type reliably, fall back to extension check
    const filenameFromClient = file.name || 'file';
    const ext = extname(filenameFromClient).toLowerCase();

    if (typeof (file as any).size === 'number' && (file as any).size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ success: false, error: 'File too large.' }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ success: false, error: 'Empty file.' }, { status: 400 });
    }

    // Enforce max size using the in-memory buffer as a last resort
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ success: false, error: 'File too large.' }, { status: 413 });
    }

    // Try to validate file signature using `file-type`. We import dynamically
    // so the app can still build if the package isn't installed; absence will
    // fall back to MIME/extension checks (less secure).
    let detected: { mime?: string; ext?: string } | null = null;
    try {
      // dynamic import avoids hard dependency during build if package isn't installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ft = await import('file-type');
      if (ft && typeof ft.fileTypeFromBuffer === 'function') {
        const dt = await ft.fileTypeFromBuffer(buffer);
        if (dt) detected = { mime: dt.mime, ext: dt.ext };
      }
    } catch (e) {
      // file-type not available or failed; we'll fall back to other checks below
      detected = null;
    }

    const hasValidMime = !!file.type && ALLOWED_MIME_TYPES.includes(file.type);
    const hasValidExt = ALLOWED_EXTENSIONS.includes(ext);

    // If file-type detected a signature, prefer that authoritative result
    if (detected) {
      const detectedMime = detected.mime || '';
      const detectedExt = detected.ext ? `.${detected.ext}` : '';
      // Require the detected signature to be an allowed image type. Be strict here
      // — if file-type says the content is not an allowed image, reject.
      if (!ALLOWED_MIME_TYPES.includes(detectedMime) || !ALLOWED_EXTENSIONS.includes(detectedExt)) {
        return NextResponse.json({ success: false, error: 'Invalid file content.' }, { status: 400 });
      }
    } else {
      // Fall back to MIME/extension checks when we couldn't detect signature.
      // If the client provided a MIME type, require both MIME and extension to match
      // allowed values. This prevents an attacker from bypassing checks by
      // spoofing the Content-Type header alone.
      if (file.type) {
        if (!ALLOWED_MIME_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) {
          return NextResponse.json({ success: false, error: 'Invalid file type.' }, { status: 400 });
        }
      } else {
        // No MIME provided by the client — allow only when extension is allowed.
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          return NextResponse.json({ success: false, error: 'Invalid file type.' }, { status: 400 });
        }
      }

      // Additional lightweight SVG content check to avoid script uploads with .svg extension
      if (ext === '.svg') {
        const txt = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));
        if (!/\<svg[\s>]/i.test(txt)) {
          return NextResponse.json({ success: false, error: 'Invalid SVG content.' }, { status: 400 });
        }
      }
    }

    const uploadDir = join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Build a safe filename using timestamp + random suffix. Prefer the detected
    // extension (from file-type) when available to avoid executable extensions.
    const random = randomBytes(6).toString('hex');
    const baseSafe = filenameFromClient.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-.()]/g, '').slice(0, 64);
    const chosenExt = (detected && detected.ext) ? `.${detected.ext}` : (ALLOWED_EXTENSIONS.includes(ext) ? ext : '');
    const filename = `${Date.now()}-${random}-${baseSafe}${chosenExt}`;
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
