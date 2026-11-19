import { NextResponse } from 'next/server';
import { getSessionCredentials } from '@/lib/session';
import path from 'path';
import fs from 'fs';
import * as ftp from 'basic-ftp';
import { prisma } from '@/lib/prisma';
import { resolveTemplateDir } from '@/lib/portal-template-utils';
import { getMaskedPortalUrl, isVpsMode } from '@/lib/domain';

export async function POST(request: Request) {
  const client = new ftp.Client();

  try {
    const body = await request.json().catch(() => ({}));
    const ftpPort = parseInt(body.ftpPort) || 21;

    // Get active router credentials from cookies or fallback to active database router
    let credentials: { ip: string; user: string; pass: string };
    try {
      credentials = await getSessionCredentials();
    } catch (e) {
      const activeRouter = await prisma.router.findFirst({ where: { active: true } });
      if (activeRouter) {
        credentials = {
          ip: activeRouter.host,
          user: activeRouter.user,
          pass: activeRouter.password
        };
      } else {
        return NextResponse.json({ 
          success: false, 
          message: 'Nenhum roteador conectado ou ativo para realizar o deploy.' 
        }, { status: 401 });
      }
    }

    const template = body.template || 'default';
    const localHotspotDir = resolveTemplateDir(template);
    
    if (!fs.existsSync(localHotspotDir)) {
      return NextResponse.json({ 
        success: false, 
        message: `A pasta local "${template}" não foi encontrada no servidor.` 
      }, { status: 400 });
    }

    // Auto-detect server base URL and update media paths in login.html before deploy
    try {
      const defaultUrl = getMaskedPortalUrl();
      const dbSystemUrl = await prisma.systemConfig.findUnique({ where: { key: 'SYSTEM_URL' } });
      let serverBaseUrl = dbSystemUrl?.value || defaultUrl;
      if (isVpsMode() || !serverBaseUrl || serverBaseUrl.includes('portal.wifi.local') || serverBaseUrl.includes('localhost') || /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?/i.test(serverBaseUrl)) {
        serverBaseUrl = defaultUrl;
      }
      
      const loginHtmlPath = path.join(localHotspotDir, 'login.html');
      if (fs.existsSync(loginHtmlPath)) {
        let html = fs.readFileSync(loginHtmlPath, 'utf8');
        html = html.replace(/https?:\/\/192\.168\.\d+\.\d+(:\d+)?/gi, serverBaseUrl);
        html = html.replace(/https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?/gi, serverBaseUrl);
        html = html.replace(/https?:\/\/portal\.wifi\.local(:\d+)?/gi, serverBaseUrl);
        html = html.replace(/https?:\/\/(?:www\.)?mikrogestor\.com(:\d+)?/gi, serverBaseUrl);
        // Ensure relative media endpoints have absolute server base URL
        html = html.replace(/(src|href|poster|url\(['"]?)\/(api\/portal\/(bg|logo)|uploads\/[^'"]+)/gi, `$1${serverBaseUrl}/$2`);
        fs.writeFileSync(loginHtmlPath, html, 'utf8');
      }

      const configJsonPath = path.join(localHotspotDir, 'config.json');
      if (fs.existsSync(configJsonPath)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
          cfg.systemUrl = serverBaseUrl;
          fs.writeFileSync(configJsonPath, JSON.stringify(cfg, null, 2), 'utf8');
        } catch {}
      }
    } catch (err) {
      console.warn('Could not pre-process media URLs for deploy:', err);
    }

    // Connect to MikroTik via FTP
    await client.access({
      host: credentials.ip,
      user: credentials.user,
      password: credentials.pass,
      port: ftpPort,
      secure: false
    });

    // Detect if we should use '/flash/hotspot' or '/hotspot'
    let remotePath = '/hotspot';
    try {
      const rootList = await client.list('/');
      const hasFlash = rootList.some(item => 
        item.name.toLowerCase() === 'flash' && 
        (item.isDirectory || item.type === 2)
      );
      if (hasFlash) {
        remotePath = '/flash/hotspot';
      }
    } catch (err) {
      console.warn('Could not list root directory to detect flash folder. Defaulting to /hotspot.', err);
    }

    // Ensure remote directory exists
    await client.ensureDir(remotePath);

    // Helper function to recursively upload hotspot code files while strictly excluding ALL media/binary asset files
    async function uploadHotspotDirFiltered(ftpClient: ftp.Client, localDir: string, targetRemoteDir: string) {
      await ftpClient.ensureDir(targetRemoteDir);
      const items = fs.readdirSync(localDir, { withFileTypes: true });

      for (const item of items) {
        const localPath = path.join(localDir, item.name);
        const remotePathFile = `${targetRemoteDir}/${item.name}`;

        if (item.isDirectory()) {
          await uploadHotspotDirFiltered(ftpClient, localPath, remotePathFile);
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          const mediaExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.mp4', '.mov', '.avi', '.webm', '.mkv', '.mp3', '.wav'];
          if (mediaExts.includes(ext)) {
            console.log(`Skipping media file upload to MikroTik flash (hosted on central server): ${item.name}`);
            continue;
          }
          if (['.log', '.tmp'].includes(ext)) {
            console.log(`Skipping temporary/log file upload to MikroTik flash: ${item.name}`);
            continue;
          }

          const stats = fs.statSync(localPath);
          // Skip files larger than 1MB to prevent RouterOS disk space issues
          if (stats.size > 1 * 1024 * 1024) {
            console.warn(`Skipping large file (${(stats.size / 1024 / 1024).toFixed(2)} MB) to save router flash: ${item.name}`);
            continue;
          }

          await ftpClient.uploadFrom(localPath, remotePathFile);
        }
      }
    }

    // Purge ALL media files from the MikroTik router storage to keep /hotspot ultra light
    try {
      const remoteFiles = await client.list(remotePath);
      
      for (const file of remoteFiles) {
        if (file.isFile || file.type === 1) {
          const fileName = file.name;
          const isMedia = fileName.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|mp4|mov|avi|webm|mkv|mp3|wav)$/i);
          
          if (isMedia) {
            console.log(`Purging remote media file from MikroTik router storage: ${remotePath}/${fileName}`);
            const remoteFilePath = remotePath.endsWith('/') ? `${remotePath}${fileName}` : `${remotePath}/${fileName}`;
            await client.remove(remoteFilePath).catch(err => {
              console.warn(`Could not delete remote media file ${fileName}:`, err);
            });
          }
        }
      }
    } catch (err) {
      console.warn('Could not purge remote media files:', err);
    }

    // Sync directory recursively with video/large file filtering
    await uploadHotspotDirFiltered(client, localHotspotDir, remotePath);

    client.close();

    // Salvar o último template oficialmente no banco de dados e sincronizar SYSTEM_URL
    try {
      await prisma.systemConfig.upsert({
        where: { key: 'LAST_DEPLOYED_TEMPLATE' },
        update: { value: template },
        create: { key: 'LAST_DEPLOYED_TEMPLATE', value: template }
      });
      const currentPortalUrl = getMaskedPortalUrl();
      await prisma.systemConfig.upsert({
        where: { key: 'SYSTEM_URL' },
        update: { value: currentPortalUrl },
        create: { key: 'SYSTEM_URL', value: currentPortalUrl }
      });
    } catch (e) {
      console.warn('Falha ao salvar LAST_DEPLOYED_TEMPLATE/SYSTEM_URL no DB:', e);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Deploy concluído! Os arquivos foram sincronizados via FTP na pasta "${remotePath}" do seu MikroTik.` 
    });

  } catch (error: any) {
    client.close();
    console.error('FTP Deploy Error:', error);

    let errorMsg = error.message || 'Erro desconhecido durante o deploy via FTP.';
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMsg = `Não foi possível conectar ao FTP em ${error.address || 'roteador'}:${error.port || 21}. Verifique se a porta FTP (21) está liberada no MikroTik (IP > Services).`;
    } else if (error.message && error.message.includes('Timeout')) {
      errorMsg = 'Tempo limite de conexão esgotado (Timeout). Verifique se o roteador está acessível na porta FTP.';
    } else if (error.message && error.message.includes('530')) {
      errorMsg = 'Usuário ou senha do FTP incorretos (Erro 530).';
    } else if (error.message && (error.message.includes('452') || error.message.includes('No space left'))) {
      errorMsg = 'Espaço em disco insuficiente no MikroTik (Erro 452). A memória flash do roteador está cheia. Abra o WinBox em "Files" e remova arquivos antigos do armazenamento interno do MikroTik.';
    }

    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
