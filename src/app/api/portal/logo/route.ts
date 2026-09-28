import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { resolveTemplateDir } from '@/lib/portal-template-utils';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const template = searchParams.get('template') || 'default';
    const safeName = template.replace(/[^a-zA-Z0-9_-]/g, '');
    const checkOnly = searchParams.get('check') === '1';
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const templateDir = resolveTemplateDir(template);
    let targetPath = '';

    // 1. If config explicitly disables the logo, return 404 (or false on check)
    const configPath = path.join(templateDir, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (cfg.brand && cfg.brand.displayMode === 'none') {
          if (checkOnly) {
            return NextResponse.json({ hasLogo: false, disabled: true });
          }
          return new Response(null, { status: 404, statusText: 'Logo Disabled' });
        }
      } catch (e) {}
    }

    // 2. Search in public/uploads for this specific template's logo
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      const matches = files
        .filter(f => (f.startsWith(`logo_${safeName}_`) || f === `logo_${safeName}.png`) && (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp') || f.endsWith('.svg')))
        .sort((a, b) => b.localeCompare(a)); // Sort newest first
      if (matches.length > 0) {
        targetPath = path.join(uploadDir, matches[0]);
      }
    }

    // 3. Fallback: Search inside hotspot/<template>/ for logo.png, logo.svg, etc.
    if (!targetPath && fs.existsSync(templateDir)) {
      const tFiles = fs.readdirSync(templateDir);
      const tFound = tFiles.find(f => (f.startsWith('logo.') || f.startsWith('logo_')) && (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp') || f.endsWith('.svg')));
      if (tFound) {
        targetPath = path.join(templateDir, tFound);
      }
    }

    if (checkOnly) {
      return NextResponse.json({ 
        hasLogo: Boolean(targetPath && fs.existsSync(targetPath)),
        file: targetPath ? path.basename(targetPath) : null
      });
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

    // Return 404 when no logo exists for this template - never leak another template's logo
    return new Response(null, { 
      status: 404, 
      statusText: 'No logo found for template' 
    });
  } catch (error: any) {
    return new Response(error.message, { status: 500 });
  }
}

