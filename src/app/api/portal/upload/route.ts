import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { resolveTemplateDir } from '@/lib/portal-template-utils';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function optimizeVideoAndGeneratePoster(filePath: string) {
  const isVideo = filePath.toLowerCase().match(/\.(mp4|webm|mov)$/);
  if (!isVideo) return;

  const posterPath = filePath.replace(/\.[^.]+$/, '_poster.jpg');
  const tempPath = filePath.replace(/\.[^.]+$/, '_temp.mp4');

  // 1. Gera o poster do vídeo a partir de 1.5s para evitar tela inicial estática ou ícones de play
  exec(`ffmpeg -y -ss 00:00:01.500 -i "${filePath}" -vframes 1 -q:v 2 "${posterPath}"`, (err) => {
    if (err) console.warn('[VideoOpt] Erro ao gerar poster:', err.message);
  });

  // 2. Otimiza o vídeo com faststart e compressão de streaming
  exec(`ffmpeg -y -i "${filePath}" -vf "scale='min(720,iw)':-2,fps=30" -c:v libx264 -crf 26 -preset fast -movflags +faststart -c:a aac -b:a 64k "${tempPath}"`, (err) => {
    if (!err && fs.existsSync(tempPath)) {
      try {
        fs.renameSync(tempPath, filePath);
      } catch (e) {}
    } else if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (e) {}
    }
  });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let buffer: Buffer;
    let fileName: string;
    let type: string;
    let slot: string | null = null;
    let ext: string;
    let templateName: string = 'default';

    if (!contentType.includes('multipart/form-data')) {
      // 1. Raw Binary Upload Mode (Highly robust for large media files)
      const url = new URL(request.url);
      type = url.searchParams.get('type') || 'ad';
      slot = url.searchParams.get('slot');
      templateName = url.searchParams.get('template') || 'default';
      const paramFilename = url.searchParams.get('filename') || 'media.mp4';
      ext = path.extname(paramFilename) || '.png';
      
      const arrayBuffer = await request.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      fileName = paramFilename;
    } else {
      // 2. Traditional Multipart Form Data Mode (Fallback)
      const formData = await request.formData();
      const file = formData.get('file') as File;
      type = formData.get('type') as string; // 'logo' | 'ad'
      slot = formData.get('slot') as string;
      templateName = formData.get('template') as string || 'default';

      if (!file) {
        return NextResponse.json({ success: false, message: 'Nenhum arquivo enviado.' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      ext = path.extname(file.name) || '.png';
      fileName = file.name;
    }

    const isVideo = ext.toLowerCase() === '.mp4' || ext.toLowerCase() === '.webm' || ext.toLowerCase() === '.mov';
    const maxSize = isVideo ? 35 * 1024 * 1024 : 10 * 1024 * 1024;

    if (type === 'bg' && buffer.length > maxSize) {
      return NextResponse.json({ 
        success: false, 
        message: `O arquivo de fundo excede o limite máximo de ${isVideo ? '35 MB para vídeos' : '10 MB para imagens'}.` 
      }, { status: 400 });
    }

    if (type === 'logo') {
      const safeName = templateName.replace(/[^a-zA-Z0-9_-]/g, '');
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Save logo with fixed name and timestamped name in public/uploads
      const logoPathFixed = path.join(uploadDir, `logo_${safeName}.png`);
      fs.writeFileSync(logoPathFixed, buffer);
      
      const fileName = `logo_${safeName}_${Date.now()}.png`;
      const logoPathTime = path.join(uploadDir, fileName);
      fs.writeFileSync(logoPathTime, buffer);

      return NextResponse.json({ 
        success: true, 
        fileUrl: `/uploads/${fileName}`,
        message: 'Logo salva no servidor com sucesso!' 
      });
    } else if (type === 'bg') {
      const safeName = templateName.replace(/[^a-zA-Z0-9_-]/g, '');
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Clean old backgrounds logic moved to AFTER successful file write

      const isVideoFile = ext.toLowerCase() === '.mp4' || ext.toLowerCase() === '.webm' || ext.toLowerCase() === '.mov';
      let cleanExt = ext.toLowerCase();
      if (!isVideoFile && !['.png', '.jpg', '.jpeg', '.webp'].includes(cleanExt)) {
         cleanExt = '.jpg';
      }
      
      const fileName = `bg_${safeName}_${Date.now()}${cleanExt}`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, buffer);
      if (isVideoFile) optimizeVideoAndGeneratePoster(filePath);

      // Clean old backgrounds for this template in public/uploads AFTER successful save
      try {
        const files = fs.readdirSync(uploadDir);
        files.forEach(f => {
          if (f.startsWith(`bg_${safeName}_`) && f !== fileName) {
            try { fs.unlinkSync(path.join(uploadDir, f)); } catch (e) {}
          }
        });
      } catch (e) {}

      // Clean any lingering bg files inside local hotspot directory if any existed
      try {
        const hDir = path.join(process.cwd(), 'hotspot', safeName);
        if (fs.existsSync(hDir)) {
          const hFiles = fs.readdirSync(hDir);
          hFiles.forEach(f => {
            if (f.startsWith('bg.') || f === 'human.png') {
              try { fs.unlinkSync(path.join(hDir, f)); } catch (e) {}
            }
          });
        }
      } catch (e) {}

      const fileUrl = `/uploads/${fileName}`;

      return NextResponse.json({ 
        success: true, 
        fileUrl: fileUrl,  
        message: 'Fundo salvo com sucesso no servidor!' 
      });
    } else if (type === 'ad') {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      if (slot) {
        const slotNum = parseInt(slot);
        if (slotNum >= 1 && slotNum <= 5) {
          const fileName = `ad_media_${slot}${ext}`;

          // Clean older extensions for this slot to prevent file pollution
          const possibleExts = ['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.mov'];
          possibleExts.forEach(e => {
            try {
              const oldPublicPath = path.join(uploadDir, `ad_media_${slot}${e}`);
              if (fs.existsSync(oldPublicPath)) fs.unlinkSync(oldPublicPath);
            } catch (err) {}
          });

          // Save to public/uploads (for admin preview and central streaming)
          const publicPath = path.join(uploadDir, fileName);
          fs.writeFileSync(publicPath, buffer);
          optimizeVideoAndGeneratePoster(publicPath);

          const fileUrl = `/uploads/${fileName}`;
          return NextResponse.json({ 
            success: true, 
            fileUrl,
            fileName,
            message: `Mídia do Slot ${slot} salva com sucesso!` 
          });
        }
      }

      // Fallback legacy upload
      const fileName = `ad_${Date.now()}${ext}`;
      const filePath = path.join(uploadDir, fileName);
      
      fs.writeFileSync(filePath, buffer);
      optimizeVideoAndGeneratePoster(filePath);

      const fileUrl = `/uploads/${fileName}`;
      
      return NextResponse.json({ 
        success: true, 
        fileUrl, 
        message: 'Mídia de anúncio salva com sucesso!' 
      });
    } else {
      return NextResponse.json({ success: false, message: 'Tipo de upload inválido.' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 1. Coleta mídias atualmente ativas em todos os templates de Hotspot
    const activeMediaMap = new Map<string, string[]>(); // fileName -> [templateNames]
    const hotspotDir = path.join(process.cwd(), 'hotspot');
    if (fs.existsSync(hotspotDir)) {
      const templates = fs.readdirSync(hotspotDir);
      templates.forEach(tpl => {
        const cfgPath = path.join(hotspotDir, tpl, 'config.json');
        if (fs.existsSync(cfgPath)) {
          try {
            const tplConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
            const checkAndAdd = (urlStr: string) => {
              if (!urlStr) return;
              const fName = path.basename(urlStr.split('?')[0]);
              if (fName) {
                const current = activeMediaMap.get(fName) || [];
                if (!current.includes(tpl)) current.push(tpl);
                activeMediaMap.set(fName, current);
              }
            };
            if (tplConfig.ad?.mediaUrl) checkAndAdd(tplConfig.ad.mediaUrl);
            if (Array.isArray(tplConfig.ad?.items)) {
              tplConfig.ad.items.forEach((item: any) => checkAndAdd(item?.url));
            }
            if (tplConfig.bg?.url) checkAndAdd(tplConfig.bg.url);
          } catch (e) {}
        }
      });
    }

    // 2. Varrer arquivos na pasta public/uploads
    const entries = fs.readdirSync(uploadDir);
    let totalBytes = 0;
    let bannerAndMediaCount = 0;
    const files: any[] = [];

    entries.forEach(name => {
      // Ignora arquivos ocultos e posters de vídeo da contagem principal
      if (name.startsWith('.') || name.endsWith('_poster.jpg')) return;

      const filePath = path.join(uploadDir, name);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) return;

        const ext = path.extname(name).toLowerCase();
        const isVideo = ['.mp4', '.webm', '.mov'].includes(ext);
        const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext);
        if (!isVideo && !isImage) return;

        totalBytes += stat.size;
        bannerAndMediaCount++;

        let category: 'banner' | 'bg' | 'logo' | 'avatar' | 'other' = 'other';
        if (name.startsWith('ad_')) category = 'banner';
        else if (name.startsWith('bg_')) category = 'bg';
        else if (name.startsWith('logo_')) category = 'logo';
        else if (name.startsWith('avatar_')) category = 'avatar';

        const usedInTemplates = activeMediaMap.get(name) || [];

        const posterName = isVideo ? name.replace(/\.[^.]+$/, '_poster.jpg') : null;
        const hasPoster = posterName ? fs.existsSync(path.join(uploadDir, posterName)) : false;

        files.push({
          name,
          url: `/uploads/${name}`,
          posterUrl: hasPoster ? `/uploads/${posterName}` : null,
          size: stat.size,
          sizeFormatted: formatBytes(stat.size),
          type: isVideo ? 'video' : 'image',
          category,
          createdAt: stat.birthtime || stat.mtime,
          isUsed: usedInTemplates.length > 0,
          usedInTemplates
        });
      } catch (err) {}
    });

    // Ordena arquivos mais recentes primeiro
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const MAX_FILES = 50; // Quota recomendada de arquivos para Hotspot leve na VPS
    const MAX_BYTES = 100 * 1024 * 1024; // 100 MB Quota recomendada de armazenamento

    const percentUsed = Math.min(100, Math.round((totalBytes / MAX_BYTES) * 100));
    const percentFiles = Math.min(100, Math.round((bannerAndMediaCount / MAX_FILES) * 100));

    return NextResponse.json({
      success: true,
      stats: {
        totalFiles: bannerAndMediaCount,
        maxFiles: MAX_FILES,
        percentFiles,
        totalBytes,
        totalFormatted: formatBytes(totalBytes),
        maxBytes: MAX_BYTES,
        maxFormatted: formatBytes(MAX_BYTES),
        freeBytes: Math.max(0, MAX_BYTES - totalBytes),
        freeFormatted: formatBytes(Math.max(0, MAX_BYTES - totalBytes)),
        percentUsed,
        isNearLimit: percentUsed >= 80 || bannerAndMediaCount >= 40
      },
      files
    });
  } catch (error: any) {
    console.error('Error listing media:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const template = searchParams.get('template') || 'default';
    const type = searchParams.get('type');
    const specificFile = searchParams.get('file');
    const clearAll = searchParams.get('all') === 'true' || type === 'all_banners';
    const unusedOnly = searchParams.get('unused') === 'true';
    const safeName = template.replace(/[^a-zA-Z0-9_-]/g, '');
    const hDir = resolveTemplateDir(template);
    const configPath = path.join(hDir, 'config.json');

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');

    // 1. EXCLUSÃO DE UM ARQUIVO ESPECÍFICO
    if (specificFile) {
      const safeFileName = path.basename(specificFile);
      const targetPath = path.join(uploadDir, safeFileName);
      let deleted = false;
      let freedBytes = 0;

      if (fs.existsSync(targetPath)) {
        try {
          const stat = fs.statSync(targetPath);
          freedBytes = stat.size;
          fs.unlinkSync(targetPath);
          deleted = true;

          // Se for vídeo, apagar também o poster gerado
          const posterPath = targetPath.replace(/\.[^.]+$/, '_poster.jpg');
          if (fs.existsSync(posterPath)) {
            try { fs.unlinkSync(posterPath); } catch (e) {}
          }
        } catch (err: any) {
          console.error(`Erro ao apagar arquivo ${safeFileName}:`, err);
        }
      }

      return NextResponse.json({
        success: true,
        message: deleted ? `Arquivo ${safeFileName} excluído com sucesso.` : 'Arquivo não encontrado no servidor.',
        deleted,
        freedBytes,
        freedFormatted: formatBytes(freedBytes)
      });
    }

    // 2. LIMPEZA TOTAL DE BANNERS & MÍDIAS DA PLATAFORMA (DESAFOGAR VPS)
    if (clearAll) {
      let deletedCount = 0;
      let freedBytes = 0;

      if (fs.existsSync(uploadDir)) {
        try {
          const entries = fs.readdirSync(uploadDir);
          entries.forEach(name => {
            // Remove ad_*, bg_*, logo_* e posters (mantém avatars intactos)
            if (name.startsWith('ad_') || name.startsWith('bg_') || name.startsWith('logo_') || name.includes('_poster.jpg')) {
              try {
                const filePath = path.join(uploadDir, name);
                const stat = fs.statSync(filePath);
                freedBytes += stat.size;
                fs.unlinkSync(filePath);
                deletedCount++;
              } catch (e) {}
            }
          });
        } catch (e) {}
      }

      // Resetar referências nos templates de hotspot para evitar links quebrados
      const hotspotDir = path.join(process.cwd(), 'hotspot');
      if (fs.existsSync(hotspotDir)) {
        try {
          const templates = fs.readdirSync(hotspotDir);
          templates.forEach(tpl => {
            const cfgPath = path.join(hotspotDir, tpl, 'config.json');
            if (fs.existsSync(cfgPath)) {
              try {
                const tplConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
                if (tplConfig.ad) {
                  tplConfig.ad.mediaUrl = '';
                  tplConfig.ad.items = [];
                }
                if (tplConfig.bg) {
                  tplConfig.bg = { type: 'default', url: '' };
                }
                fs.writeFileSync(cfgPath, JSON.stringify(tplConfig, null, 2), 'utf8');
              } catch (e) {}
            }
          });
        } catch (e) {}
      }

      return NextResponse.json({
        success: true,
        message: `Limpeza geral concluída! ${deletedCount} arquivo(s) de banner/mídia removidos e ${formatBytes(freedBytes)} liberados na VPS.`,
        deletedCount,
        freedBytes,
        freedFormatted: formatBytes(freedBytes)
      });
    }

    // 2.5 EXCLUSÃO ESPECÍFICA DE LOGOTIPO DO TEMPLATE
    if (type === 'logo') {
      let deletedCount = 0;
      if (fs.existsSync(uploadDir)) {
        try {
          const files = fs.readdirSync(uploadDir);
          files.forEach(f => {
            if (f.startsWith(`logo_${safeName}_`) || f === `logo_${safeName}.png`) {
              try {
                fs.unlinkSync(path.join(uploadDir, f));
                deletedCount++;
              } catch (e) {}
            }
          });
        } catch (e) {}
      }

      if (fs.existsSync(hDir)) {
        try {
          const hFiles = fs.readdirSync(hDir);
          hFiles.forEach(f => {
            if (f.startsWith('logo.') || f.startsWith('logo_')) {
              try {
                fs.unlinkSync(path.join(hDir, f));
                deletedCount++;
              } catch (e) {}
            }
          });
        } catch (e) {}
      }

      // Atualiza config.json para displayMode: 'none'
      if (fs.existsSync(configPath)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (!cfg.brand) cfg.brand = {};
          cfg.brand.displayMode = 'none';
          fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
        } catch (e) {}
      }

      // Limpa login.html para remover o bloco de logo
      const loginHtmlPath = path.join(hDir, 'login.html');
      if (fs.existsSync(loginHtmlPath)) {
        try {
          let html = fs.readFileSync(loginHtmlPath, 'utf8');
          const logoBlockRegex = /<!--\s*MIKROGESTOR_BRAND_LOGO\s*-->[\s\S]*?<!--\s*END_MIKROGESTOR_BRAND_LOGO\s*-->/i;
          if (logoBlockRegex.test(html)) {
            html = html.replace(logoBlockRegex, '<!-- MIKROGESTOR_BRAND_LOGO -->\n<!-- END_MIKROGESTOR_BRAND_LOGO -->');
            fs.writeFileSync(loginHtmlPath, html, 'utf8');
          }
        } catch (e) {}
      }

      return NextResponse.json({
        success: true,
        message: `Logotipo removido do servidor com sucesso!`,
        deletedCount
      });
    }

    // 3. EXCLUSÃO ESPECÍFICA DE PLANO DE FUNDO DO TEMPLATE
    if (type === 'bg') {
      let deletedCount = 0;
      if (fs.existsSync(uploadDir)) {
        try {
          const files = fs.readdirSync(uploadDir);
          files.forEach(f => {
            if (f.startsWith(`bg_${safeName}_`)) {
              try {
                fs.unlinkSync(path.join(uploadDir, f));
                deletedCount++;
              } catch (e) {}
            }
          });
        } catch (e) {}
      }

      if (fs.existsSync(hDir)) {
        try {
          const hFiles = fs.readdirSync(hDir);
          hFiles.forEach(f => {
            if (f.startsWith('bg.') && (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mov') || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp'))) {
              try {
                fs.unlinkSync(path.join(hDir, f));
                deletedCount++;
              } catch (e) {}
            }
          });
        } catch (e) {}
      }

      // Atualiza config.json para resetar fundo
      if (fs.existsSync(configPath)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          cfg.bg = { type: 'default', url: '' };
          fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
        } catch (e) {}
      }

      // Limpa login.html para remover vídeo ou imagem injetada
      const loginHtmlPath = path.join(hDir, 'login.html');
      if (fs.existsSync(loginHtmlPath)) {
        try {
          let html = fs.readFileSync(loginHtmlPath, 'utf8');
          const bgBlockRegex = /(<!--\s*MIKROGESTOR_BG_SCRIPT\s*-->|<!--\s*MIKROGESTOR BG\s*-->)[\s\S]*?(<!--\s*END_MIKROGESTOR_BG_SCRIPT\s*-->|<!--\s*END MIKROGESTOR BG\s*-->)/i;
          if (bgBlockRegex.test(html)) {
            html = html.replace(bgBlockRegex, '<!-- MIKROGESTOR_BG_SCRIPT -->\n<!-- END_MIKROGESTOR_BG_SCRIPT -->');
          }
          html = html.replace(/<video[^>]*id=["']mg-bg-video["'][^>]*>[\s\S]*?<\/video>/gi, '');
          html = html.replace(/<div[^>]*id=["']mg-bg-image["'][^>]*><\/div>/gi, '');
          html = html.replace(/<script[^>]*>[\s\S]*?mgInitVideo[\s\S]*?<\/script>/gi, '');
          fs.writeFileSync(loginHtmlPath, html, 'utf8');
        } catch (e) {}
      }

      return NextResponse.json({
        success: true,
        message: `Mídia de fundo removida e ${deletedCount} arquivo(s) apagado(s) do servidor com sucesso!`,
        deletedCount
      });
    }

    // 4. EXCLUSÃO APENAS DE ARQUIVOS NÃO UTILIZADOS
    const activeUrls = new Set<string>();
    const getSafePath = (urlStr: string) => {
      if (!urlStr) return '';
      let u = urlStr.split('?')[0];
      if (u.startsWith('http')) {
        try { u = new URL(u).pathname; } catch (e) {}
      }
      return u;
    };

    const hotspotDir = path.join(process.cwd(), 'hotspot');
    if (fs.existsSync(hotspotDir)) {
      const templates = fs.readdirSync(hotspotDir);
      templates.forEach(tpl => {
        const cfgPath = path.join(hotspotDir, tpl, 'config.json');
        if (fs.existsSync(cfgPath)) {
          try {
            const tplConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
            if (tplConfig.ad) {
              if (tplConfig.ad.mediaUrl) {
                const sp = getSafePath(tplConfig.ad.mediaUrl);
                if (sp) activeUrls.add(sp);
              }
              if (Array.isArray(tplConfig.ad.items)) {
                tplConfig.ad.items.forEach((item: any) => {
                  if (item && item.url) {
                    const sp = getSafePath(item.url);
                    if (sp) activeUrls.add(sp);
                  }
                });
              }
            }
            if (tplConfig.bg && tplConfig.bg.url) {
               const sp = getSafePath(tplConfig.bg.url);
               if (sp) activeUrls.add(sp);
            }
          } catch (e) {}
        }
      });
    }

    const files = fs.readdirSync(uploadDir);
    let deletedCount = 0;
    files.forEach(file => {
      if (file.startsWith('ad_') || file.startsWith('bg_')) {
        const fileUrl = `/uploads/${file}`;
        if (!activeUrls.has(fileUrl)) {
          try {
            fs.unlinkSync(path.join(uploadDir, file));
            deletedCount++;
          } catch (err) {}
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Limpeza concluída! ${deletedCount} arquivo(s) não utilizado(s) foram apagado(s) da pasta uploads.`,
      deletedCount
    });
  } catch (error: any) {
    console.error('Cleanup Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
