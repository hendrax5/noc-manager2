import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params;
    const slug = resolvedParams.path; 
    if (!slug || slug.length === 0) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    // Secure path traversal protection
    const sanitizedPath = slug.join('/').replace(/\.\./g, '');
    const filePath = path.join(process.cwd(), 'public', 'uploads', sanitizedPath);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.webp') contentType = 'image/webp';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error("Uploads API Error:", error);
    return NextResponse.json({ error: 'Failed to retrieve file stream' }, { status: 500 });
  }
}
