import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const template = searchParams.get('template') || 'default';
    const safeName = template.replace(/[^a-zA-Z0-9_-]/g, '');
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    let targetPath = '';

    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      const found = files.find(f => (f.startsWith(`logo_${safeName}`) || f === `logo_${safeName}.png`) && (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp') || f.endsWith('.svg')));
      if (found) {
        targetPath = path.join(uploadDir, found);
      } else {
        const anyLogo = files.find(f => f.startsWith('logo_') && (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp') || f.endsWith('.svg')));
        if (anyLogo) targetPath = path.join(uploadDir, anyLogo);
      }
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
      const fallbackHuman = path.join(process.cwd(), 'public', 'uploads', 'human.png');
      if (fs.existsSync(fallbackHuman)) {
        targetPath = fallbackHuman;
      } else {
        const fallbackIcon = path.join(process.cwd(), 'public', 'icon.png');
        if (fs.existsSync(fallbackIcon)) {
          targetPath = fallbackIcon;
        }
      }
    }

    if (targetPath && fs.existsSync(targetPath)) {
      const fileBuffer = fs.readFileSync(targetPath);
      const ext = path.extname(targetPath).toLowerCase();
      let contentType = 'image/png';
      if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.svg') contentType = 'image/svg+xml';
      else if (ext === '.webp') contentType = 'image/webp';

      return new Response(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    // Modern vector SVG fallback banner when no image file exists
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 64" width="260" height="64">
      <defs>
        <linearGradient id="mgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#2563eb"/>
        </linearGradient>
      </defs>
      <rect width="260" height="64" rx="14" fill="url(#mgGrad)" fill-opacity="0.15" stroke="url(#mgGrad)" stroke-width="1.5"/>
      <g transform="translate(18, 16)">
        <path d="M16 2.5C9.65 2.5 4.1 5.72 1 10.58l3.15 3.15C6.95 9.77 11.18 7.5 16 7.5s9.05 2.27 11.85 6.23L31 10.58C27.9 5.72 22.35 2.5 16 2.5zm0 6.67c-4.42 0-8.22 2.25-10.45 5.67l3.15 3.15c1.47-2.3 4.14-3.82 7.3-3.82s5.83 1.52 7.3 3.82l3.15-3.15C24.22 11.42 20.42 9.17 16 9.17zm0 6.66c-2.45 0-4.52 1.34-5.63 3.28l5.63 5.63 5.63-5.63C20.52 17.17 18.45 15.83 16 15.83z" fill="#0284c7"/>
      </g>
      <text x="64" y="38" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="19" fill="#0284c7" letter-spacing="0.5">MikroGestor</text>
    </svg>`;

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error: any) {
    return new Response(error.message, { status: 500 });
  }
}
