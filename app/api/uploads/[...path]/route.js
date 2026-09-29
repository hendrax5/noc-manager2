import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'public', 'uploads');

const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params;
    const slug = resolvedParams.path; 
    if (!slug || slug.length === 0) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    const filePath = path.resolve(UPLOAD_ROOT, ...slug);
    if (!filePath.startsWith(UPLOAD_ROOT + path.sep)) {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext];

    const headers = {
      'Content-Type': contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // User uploads (SVG/HTML etc.) must never run script on the app origin.
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    };
    if (!contentType) {
      headers['Content-Disposition'] = `attachment; filename="${path.basename(filePath).replace(/"/g, '')}"`;
    }

    return new NextResponse(fileBuffer, { headers });
  } catch (error) {
    console.error("Uploads API Error:", error);
    return NextResponse.json({ error: 'Failed to retrieve file stream' }, { status: 500 });
  }
}
