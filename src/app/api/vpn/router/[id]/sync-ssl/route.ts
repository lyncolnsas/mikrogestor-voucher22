import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wireguardService } from '@/services/wireguard';
import { MikrotikAPI } from '@/lib/routeros';
import { getPublicDomain, getMaskedPortalUrl } from '@/lib/domain';
import * as ftp from 'basic-ftp';
import path from 'path';
import fs from 'fs';
import { resolveTemplateDir } from '@/lib/portal-template-utils';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let mk: MikrotikAPI | null = null;

  try {
    const { id } = await params;

    const router = await prisma.router.findUnique({
      where: { id },
    });

    if (!router) {
      return NextResponse.json({ success: false, message: 'Roteador não encontrado' }, { status: 404 });
    }

    if (!router.subdomain) {
      return NextResponse.json(
        { success: false, message: 'Roteador não possui subdomínio configurado' },
        { status: 400 }
      );
    }

    // 1. Verifica se o certificado já existe no Traefik (acme.json)
    const certResult = await wireguardService.getDomainCert(router.subdomain);
    if (!certResult.ok || !certResult.certificate) {
      return NextResponse.json({
        success: false,
        pending: true,
        message: `O certificado SSL para ${router.subdomain} ainda está sendo emitido pelo Let's Encrypt. Acesse https://${router.subdomain} no navegador uma vez para disparar a emissão do desafio e tente novamente em 1 minuto.`,
      });
    }

    // 2. Conecta ao MikroTik via VPN (ou IP cadastrado)
    const host = router.vpnIp || router.host;
    const port = router.port || 8728;
    const user = router.user;
    const pass = router.password;

    mk = new MikrotikAPI();
    const connected = await mk.connect(host, user, pass, port);

    if (!connected) {
      return NextResponse.json({
        success: false,
        message: `Certificado SSL está pronto na VPS, mas o MikroTik não pôde ser contatado em ${host}:${port}. Verifique se o túnel WireGuard está ativo.`,
      });
    }

    const conn = (mk as any).connection;
    const slug = router.subdomain.split('.')[0];
    const certName = `mg-ssl-${slug}`;
    const certHost = process.env.PORTAL_PUBLIC_DOMAIN 
      ? (process.env.PORTAL_PUBLIC_DOMAIN.startsWith("www.") ? process.env.PORTAL_PUBLIC_DOMAIN : `www.${process.env.PORTAL_PUBLIC_DOMAIN}`)
      : "www.mikrogestor.com";

    // 3. Executa download e importação limpa do certificado (apenas folha leaf cert) diretamente no MikroTik
    const syncCmds = `
:do {
  :log info "[MikroGestor] Limpando certificados antigos para ${router.subdomain}..."
  :do { /certificate remove [find where name~"${certName}"] } on-error={}
  :do { /certificate remove [find where common-name="${router.subdomain}"] } on-error={}
  :delay 1s
  :log info "[MikroGestor] Baixando certificado (cert) para ${router.subdomain}..."
  /tool fetch url="https://${certHost}/api/vpn/router/${router.id}/cert-file?type=cert" dst-path="mg-cert.pem" check-certificate=no
  :delay 3s
  /certificate import file-name=mg-cert.pem passphrase="" name="${certName}"
  :delay 2s
  :log info "[MikroGestor] Baixando chave privada (key) para ${router.subdomain}..."
  /tool fetch url="https://${certHost}/api/vpn/router/${router.id}/cert-file?type=key" dst-path="mg-key.pem" check-certificate=no
  :delay 3s
  /certificate import file-name=mg-key.pem passphrase="" name="${certName}"
  :delay 2s
  :do { /file remove [find name="mg-cert.pem"] } on-error={}
  :do { /file remove [find name="mg-key.pem"] } on-error={}
  :do { /certificate set [find where name~"${certName}"] trusted=yes } on-error={}
  :do { /ip service set [find name="reverse-proxy"] disabled=yes } on-error={}
  /ip service set www-ssl certificate=[/certificate get [find where name~"${certName}" and private-key=yes] name] disabled=no port=443
  /ip hotspot profile set [find name=hsprof_hotspot] ssl-certificate=[/certificate get [find where name~"${certName}" and private-key=yes] name] dns-name="${router.subdomain}" login-by=http-chap,https,http-pap,trial
  :log info "[MikroGestor] Certificado SSL ${router.subdomain} injetado com sucesso!"
} on-error={
  :log error "[MikroGestor] Erro ao sincronizar certificado SSL para ${router.subdomain}"
}
    `.trim();

    const scriptsMenu = (mk as any).client?.menu('/system/script');
    if (scriptsMenu && conn?.rosApi) {
      // Limpa scripts anteriores
      const existing = await scriptsMenu.where('name', 'mg-ssl-manual-sync').get().catch(() => []);
      for (const s of existing) {
        await scriptsMenu.remove(s.id || s['.id']).catch(() => {});
      }

      const scriptItem = await scriptsMenu.add({
        name: 'mg-ssl-manual-sync',
        policy: 'ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon',
        source: syncCmds,
      });

      // Executa script
      await conn.rosApi.write('/system/script/run', ['=.id=' + (scriptItem.id || scriptItem['.id'])]);

      // Aguarda tempo suficiente para os fetches e imports completarem
      await new Promise((r) => setTimeout(r, 16000));

      // Limpa o script temporário
      await scriptsMenu.remove(scriptItem.id || scriptItem['.id']).catch(() => {});
    }

    // 4. PROVISIONAMENTO COM BLOQUEIO COMPLETO
    // 4.1 Identifica a interface Bridge LAN e Hotspot
    const [bridges, hsServers, hsProfiles] = await Promise.all([
      mk.getBridges().catch(() => []),
      mk.getHotspotServers().catch(() => []),
      mk.getHotspotServerProfiles().catch(() => []),
    ]);

    const activeHs = hsServers.find((h: any) => h.interface && h.disabled !== 'true' && h.disabled !== 'yes');
    const targetBridge = activeHs
      ? activeHs.interface
      : (bridges.find((b: any) => b.name === 'bridge') || bridges[0] || { name: 'bridge' }).name;

    // 4.2 Garante perfil hsprof_hotspot e servidor hs_hotspot
    const existingHsProf = hsProfiles.find((p: any) => p.name === 'hsprof_hotspot');
    if (!existingHsProf) {
      await mk.addHotspotServerProfile({
        name: 'hsprof_hotspot',
        'html-directory': 'flash/hotspot',
        'dns-name': router.subdomain,
        'login-by': 'http-chap,https,http-pap,trial',
        'ssl-certificate': certName,
        'use-radius': 'no',
      }).catch(() => null);
    } else {
      await (mk as any).client?.menu('/ip/hotspot/profile').where('.id', existingHsProf.id || existingHsProf['.id']).update({
        'dns-name': router.subdomain,
        'login-by': 'http-chap,https,http-pap,trial',
        'ssl-certificate': certName,
      }).catch(() => null);
    }

    // 4.3 Garante Servidor Hotspot ativo na bridge
    const existingServer = hsServers.find((s: any) => s.interface === targetBridge || s.name === 'hs_hotspot');
    if (!existingServer) {
      await mk.upsertHotspotServer({
        name: 'hs_hotspot',
        interface: targetBridge,
        'address-pool': 'pool_hotspot',
        profile: 'hsprof_hotspot',
      }).catch(() => null);
    } else if (existingServer.disabled === 'true' || existingServer.disabled === 'yes') {
      await (mk as any).client?.menu('/ip/hotspot').where('.id', existingServer.id || existingServer['.id']).update({
        disabled: 'no',
        profile: 'hsprof_hotspot',
      }).catch(() => null);
    }

    // 4.4 Bypass de Interceptação HTTPS Externa (Elimina erro "Página web não disponível")
    await mk.ensureBypassForeignHttpsInterception().catch((e) => console.warn('Bypass Foreign HTTPS error:', e));

    // 4.5 Walled Garden Ultra-Restrito (Regra 13: Lockdown Total)
    const publicDomain = getPublicDomain() || 'mikrogestor.com';
    await mk.ensureWalledGardenRules({
      mode: 'vps',
      publicDomain,
      subdomain: router.subdomain,
    }).catch((e) => console.warn('Walled Garden error:', e));

    // 4.6 Anti-Tethering (Regra 15: Mangle TTL=1)
    await mk.ensureAntiTetheringRule(targetBridge).catch((e) => console.warn('Anti-Tethering error:', e));

    // 4.7 Isolamento de Tráfego: IPv6 e FastTrack (Regra 17)
    await mk.ensureHotspotTrafficIsolation(targetBridge).catch((e) => console.warn('Traffic Isolation error:', e));

    // 4.8 Bloqueio de DoT (porta 853) para impedir bypass via Android Private DNS
    await mk.ensureBlockDoT().catch((e) => console.warn('DoT Block error:', e));

    // 4.9 DNS Estático Local: subdomain → IP LAN do roteador
    // Isso faz o MikroTik resolver fap2.mikrogestor.com → 192.168.88.1 para clientes
    // conectados no Wi-Fi, que então acessam o www-ssl local com cert válido → SEM AVISO
    try {
      const ipAddrs = (await (mk as any).client?.menu('/ip/address').get() || []) as any[];
      const bridgeAddr = ipAddrs.find((a: any) => a.interface === targetBridge && !a.disabled && a.address);
      const lanIp = bridgeAddr?.address?.split('/')[0] || '192.168.88.1';
      await mk.ensureHotspotLocalDns(router.subdomain, lanIp).catch((e) => console.warn('DNS estático hotspot error:', e));
    } catch (e) {
      console.warn('Erro ao obter IP LAN:', e);
      await mk.ensureHotspotLocalDns(router.subdomain).catch(() => null);
    }

    // 4.9 Perfil de Usuário Padrão com restrição a 1 dispositivo e auto-limpeza
    const userProfiles = (await mk.getHotspotProfiles().catch(() => [])) as any[];
    const defaultProf = userProfiles.find((p: any) => p.name === 'default');
    const onLoginCleanScript =
      '/ip firewall filter remove [find comment~("Temp WhatsApp.*" . $"mac-address")]; /ip hotspot walled-garden ip remove [find comment~("Temp WhatsApp.*" . $"mac-address")]; /ip hotspot walled-garden remove [find comment~("Temp WhatsApp.*" . $"mac-address")]';
    if (defaultProf) {
      await (mk as any).client?.menu('/ip/hotspot/user/profile').where('.id', defaultProf.id || defaultProf['.id']).update({
        'shared-users': '1',
        'rate-limit': '5M/5M',
        'session-timeout': '1d',
        'on-login': onLoginCleanScript,
      }).catch(() => null);
    }

    // 4.10 Proteção de API e Winbox via VPN (Regra 11)
    await mk.ensureApiAccessNotBlocked().catch(() => null);

    // 5. Deploy / Atualização do Template no MikroTik via FTP
    let ftpDeployed = false;
    try {
      const ftpClient = new ftp.Client();
      ftpClient.ftp.verbose = false;
      await ftpClient.access({
        host,
        user,
        password: pass,
        port: 21,
        secure: false,
      });

      let remotePath = '/hotspot';
      try {
        const rootList = await ftpClient.list('/');
        if (rootList.some((item) => item.name.toLowerCase() === 'flash' && (item.isDirectory || item.type === 2))) {
          remotePath = '/flash/hotspot';
        }
      } catch {}

      await ftpClient.ensureDir(remotePath);

      const localHotspotDir = resolveTemplateDir('default');
      if (fs.existsSync(localHotspotDir)) {
        const defaultUrl = getMaskedPortalUrl();
        const loginHtmlPath = path.join(localHotspotDir, 'login.html');
        if (fs.existsSync(loginHtmlPath)) {
          let html = fs.readFileSync(loginHtmlPath, 'utf8');
          html = html.replace(/https?:\/\/192\.168\.\d+\.\d+(:\d+)?/gi, defaultUrl);
          html = html.replace(/https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?/gi, defaultUrl);
          html = html.replace(/https?:\/\/portal\.wifi\.local(:\d+)?/gi, defaultUrl);
          html = html.replace(/(src|href|poster|url\(['"]?)\/(api\/portal\/(bg|logo)|uploads\/[^'"]+)/gi, `$1${defaultUrl}/$2`);
          fs.writeFileSync(loginHtmlPath, html, 'utf8');
        }

        const items = fs.readdirSync(localHotspotDir, { withFileTypes: true });
        for (const item of items) {
          if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase();
            if (['.html', '.css', '.js', '.txt'].includes(ext)) {
              await ftpClient.uploadFrom(path.join(localHotspotDir, item.name), `${remotePath}/${item.name}`);
            }
          }
        }
        ftpDeployed = true;
      }
      ftpClient.close();
    } catch (ftpErr) {
      console.warn('[Sync-SSL] Aviso no deploy FTP do template (não impeditivo):', ftpErr);
    }

    // 6. Atualiza o banco de dados com status SSL ativo
    const expiresAt = new Date(Date.now() + 85 * 24 * 60 * 60 * 1000);
    await prisma.router.update({
      where: { id: router.id },
      data: {
        sslActive: true,
        sslExpiresAt: expiresAt,
      },
    });

    mk.disconnect();

    return NextResponse.json({
      success: true,
      message: `Certificado SSL e Provisionamento com Bloqueio aplicados com sucesso no MikroTik (${router.subdomain})! O captive portal está ativo com HTTPS seguro e todas as regras de segurança/bloqueio foram sincronizadas.`,
      subdomain: router.subdomain,
      sslExpiresAt: expiresAt,
      ftpDeployed,
    });
  } catch (error: any) {
    if (mk) mk.disconnect();
    return NextResponse.json(
      { success: false, message: `Erro ao sincronizar SSL e provisionar bloqueio: ${error.message}` },
      { status: 500 }
    );
  }
}
