import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth-helper';
import { put } from '@vercel/blob';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed formats: PNG, JPEG, WebP, and PDF.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10 MB limit.' },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const pathname = `transactions/${timestamp}-${safeName}`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(pathname, file, { access: 'public' });
      return NextResponse.json({ ok: true, url: blob.url });
    } else {
      try {
        const blob = await put(pathname, file, { access: 'public' });
        return NextResponse.json({ ok: true, url: blob.url });
      } catch (blobErr: any) {
        if (process.env.NODE_ENV !== 'production') {
          // Dev fallback: encode as data URL so local testing works without Vercel token
          const buffer = Buffer.from(await file.arrayBuffer());
          const base64 = buffer.toString('base64');
          const dataUrl = `data:${file.type};base64,${base64}`;
          return NextResponse.json({
            ok: true,
            url: dataUrl,
            warning: 'BLOB_READ_WRITE_TOKEN missing; served as inline data URL for local dev',
          });
        }
        return NextResponse.json(
          { error: `Vercel Blob error: ${blobErr.message}. Ensure BLOB_READ_WRITE_TOKEN is set in Vercel environment variables.` },
          { status: 500 }
        );
      }
    }
  } catch (err: any) {
    console.error('File upload error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error during upload' },
      { status: 500 }
    );
  }
}
