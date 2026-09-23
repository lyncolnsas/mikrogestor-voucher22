/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { RouterOSClient, RosApiMenu } from 'routeros-client';

// ─── Patch para RouterOS v7 (!empty replies) ──────────────────────────────────
// No RouterOS v7, consultas a tabelas vazias retornam a sentença "!empty" antes
// de "!done". A biblioteca 'node-routeros' desconhece "!empty" e lança RosException
// dentro de Channel.onUnknown. Este patch trata "!empty" de forma nativa e segura.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Channel } = require('node-routeros/dist/Channel');
  if (Channel && Channel.prototype && !(Channel.prototype as any)._ros7Patched) {
    (Channel.prototype as any)._ros7Patched = true;
    const origProcessPacket = Channel.prototype.processPacket;
    Channel.prototype.processPacket = function (packet: string[]) {
      const reply = packet[0];
      if (reply === '!empty') {
        this.data = [];
        return;
      }
      return origProcessPacket.call(this, packet);
    };
    Channel.prototype.onUnknown = function (reply: string) {
      if (reply === '!empty') {
        this.data = [];
        return;
      }
      console.warn('[MikroTik] Unhandled reply from RouterOS:', reply);
    };
  }
} catch (e) {
  console.warn('[MikrotikAPI] Falha ao aplicar patch para RouterOS v7:', e);
}

export class MikrotikAPI {
  private client: RosApiMenu | null = null;
  private connection: RouterOSClient | null = null;

  async connect(host: string, user: string, pass: string, port?: number) {
    this.connection = new RouterOSClient({
      host,
      port: port || 8728,
      user,
      password: pass,
      keepalive: true,
      timeout: 2500
    });

    try {
      this.client = await this.connection.connect();
      return true;
    } catch (err: any) {
      // errno -113 = EHOSTUNREACH: roteador VPN ainda não se conectou (script pendente no MikroTik)
      // errno -111 = ECONNREFUSED: porta 8728 não está escutando
      // Esses são estados esperados — não logar como erro crítico para não poluir os logs
      const isExpectedVpnState = err?.errno === -113 || err?.errno === -111;
      if (isExpectedVpnState) {
        // Silencioso — o NetworkSync já trata o caso de VPN pendente
        // Para depuração, use DEBUG_MIKROTIK=true nas variáveis de ambiente
        if (process.env.DEBUG_MIKROTIK === 'true') {
          console.warn(`[MikrotikAPI] Host ${host} inacessível (errno ${err?.errno}). VPN pendente ou serviço API desativado.`);
        }
      } else {
        console.error(`[MikrotikAPI] Erro de conexão com ${host}:`, err);
      }
      return false;
    }
  }

  async close() {
    this.disconnect();
  }

  async getIdentity() {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/system/identity');
    return await menu.get();
  }

  async getSystemResources() {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/system/resource');
    return await menu.get();
  }

  async getRouterboard() {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/system/routerboard');
    return await menu.get();
  }

  async getSystemClock() {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/system/clock');
    return await menu.get();
  }

  async getLogs() {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/log');
    return await menu.get();
  }

  async getHotspotActive() {
    if (!this.client) throw new Error('Not connected');
    try {
      const menu = this.client.menu('/ip/hotspot/active');
      return await menu.get();
    } catch (err: any) {
      if (err?.message && (err.message.includes('!empty') || err.message.includes('empty'))) {
        return [];
      }
      throw err;
    }
  }

  async getHotspotUsers() {
    if (!this.client) throw new Error('Not connected');
    try {
      const menu = this.client.menu('/ip/hotspot/user');
      return await menu.get();
    } catch (err: any) {
      if (err?.message && (err.message.includes('!empty') || err.message.includes('empty'))) {
        return [];
      }
      throw err;
    }
  }

  async getHotspotProfiles() {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/hotspot/user/profile');
    return await menu.get();
  }

  async addHotspotProfile(profile: any) {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/hotspot/user/profile');
    return await menu.add(profile);
  }

  async updateHotspotProfile(profile: any, id: string) {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/hotspot/user/profile');
    return await menu.set(profile, id);
  }

  async getHotspotServers() {
    if (!this.client) throw new Error('Not connected');
    // Correct RouterOS path: /ip/hotspot (NOT /ip/hotspot/server which doesn't exist)
    return await this.client.menu('/ip/hotspot').get();
  }

  async addHotspotUser(user: any) {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/hotspot/user');

    // Normaliza os campos (evita leading/trailing whitespace em profile, name, server)
    const payload = { ...user };
    if (typeof payload.profile === 'string') {
      payload.profile = payload.profile.trim();
    }
    if (!payload.profile) {
      payload.profile = 'default';
    }

    try {
      return await menu.add(payload);
    } catch (err: any) {
      // Fallback de segurança: Se o perfil especificado não existir no MikroTik
      if (err?.message && err.message.toLowerCase().includes('profile') && payload.profile !== 'default') {
        console.warn(`[MikrotikAPI] Perfil "${payload.profile}" não encontrado no MikroTik (${err.message}). Aplicando fallback automático para "default".`);
        payload.profile = 'default';
        return await menu.add(payload);
      }
      throw err;
    }
  }

  async removeHotspotUser(id: string) {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/hotspot/user');
    return await menu.remove(id);
  }

  async removeHotspotUsersByComment(comment: string) {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/hotspot/user');
    const users = await menu.where('comment', comment).get();
    let count = 0;
    for (const u of users) {
      if (u.id) {
        await menu.remove(u.id);
        count++;
      }
    }
    return count;
  }


  /** Remove active hotspot sessions for a given MAC address */
  async removeHotspotActiveByMac(mac: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    const active = await this.client.menu('/ip/hotspot/active').where('mac-address', mac).get() as any[];
    for (const u of active) {
      const id: string | undefined = u['.id'] ?? u.id;
      if (id) await this.client.menu('/ip/hotspot/active').remove(id);
    }
  }

  /** Enable a hotspot user by ID (sets disabled=false) */
  async enableHotspotUser(id: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    await this.client.menu('/ip/hotspot/user').update({ '.id': id, disabled: 'false' });
  }

  /** Disable a hotspot user by ID (sets disabled=true) */
  async disableHotspotUser(id: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    await this.client.menu('/ip/hotspot/user').update({ '.id': id, disabled: 'true' });
  }

  /** Returns all active hotspot sessions */
  async getActiveHotspotUsers(): Promise<any[]> {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/hotspot/active').get() as any[];
  }

  /** Remove a specific active hotspot session by its ID */
  async removeActiveHotspotUser(id: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    await this.client.menu('/ip/hotspot/active').remove(id);
  }

  /** Remove active sessions matching a username */
  async removeHotspotActiveByUser(username: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    const active = await this.client.menu('/ip/hotspot/active').where('user', username).get() as any[];
    for (const u of active) {
      const id: string | undefined = u['.id'] ?? u.id;
      if (id) await this.client.menu('/ip/hotspot/active').remove(id);
    }
  }

  /** Remove hotspot users matching a username */
  async removeHotspotUserByName(username: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    const users = await this.client.menu('/ip/hotspot/user').where('name', username).get() as any[];
    for (const u of users) {
      const id: string | undefined = u['.id'] ?? u.id;
      if (id) await this.client.menu('/ip/hotspot/user').remove(id);
    }
  }

  async updateCaptivePortal(htmlContent: string) {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/file');
    
    let files = await menu.where('name', 'hotspot/login.html').get();
    if (files.length === 0) {
      files = await menu.where('name', 'flash/hotspot/login.html').get();
    }
    
    if (files.length > 0) {
      const fileId = files[0].id;
      await menu.set({ contents: htmlContent }, fileId);
      return { success: true, path: files[0].name };
    } else {
      throw new Error('Arquivo login.html não encontrado na pasta hotspot do Mikrotik.');
    }
  }

  // --- SECURITY & ACCESS CONTROL --- //

  async getWalledGarden() {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/hotspot/walled-garden');
    return await menu.get();
  }

  async addWalledGarden(action: 'allow' | 'deny', dstHost: string, comment: string = '') {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/hotspot/walled-garden');
    const cleanHost = dstHost.replace(/^\*+|\*+$/g, '').trim();
    if (!cleanHost) return null;
    const wildcardPattern = `*${cleanHost}*`;

    // 1. Busca regras existentes para verificar duplicatas (idempotência estrita)
    // OBS: routeros-client converte campos kebab-case para camelCase (ex: dstHost / dstAddress)
    const existingRules = ((await menu.get()) as any[]) || [];
    const matching = existingRules.filter((r: any) => {
      const hostVal = r.dstHost || r['dst-host'] || '';
      const rHost = hostVal.replace(/^\*+|\*+$/g, '').trim();
      return (
        (rHost.toLowerCase() === cleanHost.toLowerCase() ||
          hostVal === wildcardPattern ||
          hostVal === cleanHost) &&
        r.action === action
      );
    });

    if (matching.length > 0) {
      // Se houver mais de uma regra para o mesmo host, remove os duplicados sobressalentes
      for (let i = 1; i < matching.length; i++) {
        const dupId = matching[i]['.id'] || matching[i].id;
        if (dupId) {
          await menu.remove(dupId).catch(() => null);
        }
      }
      return matching[0];
    }

    const comm = comment.startsWith('MikroGestor:') ? comment : `MikroGestor: ${comment}`;
    return await menu.add({
      action: action,
      'dst-host': wildcardPattern,
      comment: comm,
    });
  }

  async removeWalledGarden(id: string) {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/hotspot/walled-garden');
    return await menu.remove(id);
  }

  async getWalledGardenIp() {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/hotspot/walled-garden/ip');
    return await menu.get();
  }

  async addWalledGardenIp(action: 'accept' | 'reject' | 'drop', dstAddressOrHost: string, comment: string = '') {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/hotspot/walled-garden/ip');
    // Remove qualquer asterisco (RouterOS v7 invalida regras com asteriscos em walled-garden/ip)
    const clean = dstAddressOrHost.replace(/\*/g, '').trim();
    if (!clean) return null;
    const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/.test(clean);

    const existingRules = ((await menu.get()) as any[]) || [];

    // Limpa regras corrompidas com asteriscos na tabela IP
    for (const r of existingRules) {
      const hostVal = r.dstHost || r['dst-host'] || '';
      if (r.invalid === true || r.invalid === 'true' || hostVal.includes('*')) {
        const id = r['.id'] || r.id;
        if (id) await menu.remove(id).catch(() => null);
      }
    }

    // Verifica duplicatas exatas
    const matching = existingRules.filter((r: any) => {
      const addrVal = r.dstAddress || r['dst-address'] || '';
      const hostVal = r.dstHost || r['dst-host'] || '';
      if (isIp) {
        return addrVal === clean && r.action === action;
      } else {
        const rHost = hostVal.replace(/\*/g, '').trim();
        return rHost.toLowerCase() === clean.toLowerCase() && r.action === action;
      }
    });

    if (matching.length > 0) {
      for (let i = 1; i < matching.length; i++) {
        const dupId = matching[i]['.id'] || matching[i].id;
        if (dupId) {
          await menu.remove(dupId).catch(() => null);
        }
      }
      return matching[0];
    }

    const comm = comment.startsWith('MikroGestor:') ? comment : `MikroGestor: ${comment}`;
    const data: any = {
      action: action,
      comment: comm,
    };
    if (isIp) {
      data['dst-address'] = clean;
    } else {
      data['dst-host'] = clean;
    }
    return await menu.add(data);
  }

  async removeWalledGardenIp(id: string) {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/hotspot/walled-garden/ip');
    return await menu.remove(id);
  }

  /**
   * Varredura profunda para limpar e desduplicar regras de Walled Garden no RouterOS
   */
  async cleanupAndDeduplicateWalledGarden(opts?: { isVps?: boolean }) {
    if (!this.client) throw new Error('Not connected');

    // 1. Limpeza no Walled Garden HTTP
    try {
      const wgMenu = this.client.menu('/ip/hotspot/walled-garden');
      const list = ((await wgMenu.get()) as any[]) || [];
      const seenHosts = new Set<string>();

      for (const item of list) {
        const rawHost = item.dstHost || item['dst-host'] || '';
        const clean = rawHost.replace(/^\*+|\*+$/g, '').trim().toLowerCase();
        if (!clean) continue;

        // Expurgar domínios externos que não pertencem à infraestrutura da plataforma
        const comment = (item.comment || '').toLowerCase();
        const isExternal =
          clean.includes('mercadopago') ||
          clean.includes('mercadolivre') ||
          clean.includes('mercadolibre') ||
          clean.includes('whatsapp') ||
          clean.includes('googleapis') ||
          clean.includes('gstatic') ||
          comment.includes('integracao') ||
          comment.includes('mercadolivre') ||
          comment.includes('mercadopago') ||
          comment.includes('whatsapp');

        if (isExternal) {
          const id = item['.id'] || item.id;
          if (id) await wgMenu.remove(id).catch(() => null);
          continue;
        }

        if (seenHosts.has(clean)) {
          const id = item['.id'] || item.id;
          if (id) await wgMenu.remove(id).catch(() => null);
        } else {
          seenHosts.add(clean);
        }
      }
    } catch (err) {
      console.warn('[Cleanup WG] Erro ao desduplicar Walled Garden HTTP:', err);
    }

    // 2. Limpeza no Walled Garden IP
    try {
      const wgIpMenu = this.client.menu('/ip/hotspot/walled-garden/ip');
      const listIp = ((await wgIpMenu.get()) as any[]) || [];
      const seenDestinations = new Set<string>();

      for (const item of listIp) {
        const id = item['.id'] || item.id;
        if (!id) continue;
        const hostVal = (item.dstHost || item['dst-host'] || '').toLowerCase();
        const addrVal = item.dstAddress || item['dst-address'] || '';
        const comment = (item.comment || '').toLowerCase();

        // Regra inválida ou com asterisco (não suportado em IP no ROS v7)
        if (item.invalid === true || item.invalid === 'true' || hostVal.includes('*')) {
          await wgIpMenu.remove(id).catch(() => null);
          continue;
        }

        // Expurgar domínios externos que não pertencem à infraestrutura da plataforma
        const isExternal =
          hostVal.includes('mercadopago') ||
          hostVal.includes('mercadolivre') ||
          hostVal.includes('mercadolibre') ||
          hostVal.includes('whatsapp') ||
          hostVal.includes('googleapis') ||
          hostVal.includes('gstatic') ||
          comment.includes('integracao') ||
          comment.includes('mercadolivre') ||
          comment.includes('mercadopago') ||
          comment.includes('whatsapp');

        if (isExternal) {
          await wgIpMenu.remove(id).catch(() => null);
          continue;
        }

        // Se estiver em modo VPS, remove IPs locais do Docker ou da antiga LAN
        if (opts?.isVps) {
          if (
            addrVal.startsWith('172.16.') ||
            addrVal.startsWith('172.17.') ||
            addrVal.startsWith('192.168.') ||
            (item.comment && item.comment.includes('Auto-Cadastro'))
          ) {
            await wgIpMenu.remove(id).catch(() => null);
            continue;
          }
        }

        const destKey = addrVal
          ? `ip_${addrVal}`
          : `host_${hostVal.replace(/\*/g, '').trim().toLowerCase()}`;

        const fullKey = `${item.action || 'accept'}_${destKey}`;
        if (seenDestinations.has(fullKey)) {
          await wgIpMenu.remove(id).catch(() => null);
        } else {
          seenDestinations.add(fullKey);
        }
      }
    } catch (err) {
      console.warn('[Cleanup WG] Erro ao desduplicar Walled Garden IP:', err);
    }

    // 3. Limpeza de Static DNS legado no modo VPS
    if (opts?.isVps) {
      try {
        const dnsStatic = this.client.menu('/ip/dns/static');
        const statics = ((await dnsStatic.get()) as any[]) || [];
        for (const s of statics) {
          if (s.name === 'portal.wifi.local') {
            const sid = s['.id'] || s.id;
            if (sid) await dnsStatic.remove(sid).catch(() => null);
          }
        }
      } catch (err) {
        console.warn('[Cleanup WG] Erro ao limpar static DNS legado:', err);
      }
    }
  }

  /**
   * Configuração completa, segura e 100% idempotente de Walled Garden no MikroTik.
   * Evita repetições, remove duplicatas e garante acesso irrestrito EXCLUSIVAMENTE
   * ao domínio da plataforma e IP da VPS (removendo plataformas externas).
   */
  async ensureWalledGardenRules(opts?: {
    mode?: 'local' | 'vps';
    publicDomain?: string;
    subdomain?: string;
    adminIp?: string;
  }) {
    if (!this.client) throw new Error('Not connected');
    const isVps = opts?.mode === 'vps';
    const publicDomain = (opts?.publicDomain || '').replace(/^\*+|\*+$/g, '').trim();
    const subdomain = (opts?.subdomain || '').replace(/^\*+|\*+$/g, '').trim();
    const adminIp = opts?.adminIp || '';

    // 1. Executa limpeza, remoção de externos e deduplicação profunda primeiro
    await this.cleanupAndDeduplicateWalledGarden({ isVps });

    if (!isVps) {
      // ── MODO LOCAL ──────────────────────────────────────────────────────────
      if (adminIp) {
        await this.addWalledGarden('allow', adminIp, 'Auto-Cadastro / API IP');
        await this.addWalledGardenIp('accept', adminIp, 'Auto-Cadastro / API IP');
      }
      await this.addWalledGarden('allow', 'portal.wifi.local', 'Auto-Cadastro / API DNS');
      await this.addWalledGardenIp('accept', 'portal.wifi.local', 'Auto-Cadastro / API DNS');
    } else {
      // ── MODO VPS ────────────────────────────────────────────────────────────
      // 1. Domínio principal e subdomínios MikroGestor
      if (publicDomain) {
        await this.addWalledGarden('allow', publicDomain, 'Portal Publico VPS');
        await this.addWalledGarden('allow', `www.${publicDomain}`, 'Portal Publico WWW');
        await this.addWalledGardenIp('accept', publicDomain, 'Dominio Publico (HTTPS)');
        await this.addWalledGardenIp('accept', `www.${publicDomain}`, 'WWW Dominio Publico (HTTPS)');
      }

      // 2. Subdomínio dedicado do roteador (NÃO deve ser adicionado ao Walled Garden!
      // O subdomain é o dns-name do próprio Hotspot (192.168.88.1). Se for adicionado
      // em walled-garden/ip, o RouterOS cria uma regra de bypass para o IP local do roteador,
      // fazendo com que requisições HTTPS caiam no WebFig em vez do servlet do Hotspot,
      // resultando em erro 404. O Hotspot gerencia seu próprio dns-name nativamente).
      if (subdomain) {
        // Limpeza preventiva de qualquer entrada legada do subdomínio local no Walled Garden
        try {
          const wgIpMenu = this.client.menu('/ip/hotspot/walled-garden/ip');
          const legacyIp = (await wgIpMenu.where('dst-host', subdomain).get()) as any[];
          for (const item of legacyIp) {
            const iid = item['.id'] || item.id;
            if (iid) await wgIpMenu.remove(iid).catch(() => null);
          }
          const wgMenu = this.client.menu('/ip/hotspot/walled-garden');
          const legacyWg = (await wgMenu.get()) as any[];
          for (const item of legacyWg) {
            if (item['dst-host'] && item['dst-host'].includes(subdomain)) {
              const iid = item['.id'] || item.id;
              if (iid) await wgMenu.remove(iid).catch(() => null);
            }
          }
        } catch {}
      }

      // 3. IP público da VPS (para requisições diretas / APIs)
      const VPS_PUBLIC_IP = process.env.VPS_PUBLIC_IP;
      if (VPS_PUBLIC_IP) {
        await this.addWalledGardenIp('accept', VPS_PUBLIC_IP, 'VPS IP Publico (HTTPS)');
      }

      // 4. IP VPN de controle (10.8.0.1)
      const VPN_SERVER_IP = process.env.VPN_SERVER_IP || '10.8.0.1';
      await this.addWalledGardenIp('accept', VPN_SERVER_IP, 'IP VPN Servidor');

      // OBS: Domínios externos como WhatsApp, Google e Mercado Pago foram intencionalmente
      // removidos do Walled Garden para evitar uso indevido da rede, pois o cliente já recebe
      // 15 minutos de navegação completa para efetuar o pagamento.
    }
  }

  // --- ANTI-TETHERING (BLOQUEIO CONTRA COMPARTILHAMENTO) --- //

  /**
   * Garante a regra de Mangle com TTL=1 no MikroTik para impedir que clientes compartilhem
   * o acesso Wi-Fi via Roteador Wi-Fi (Tethering), Bluetooth ou USB.
   * Quando o pacote chega ao celular com TTL=1, o celular consome o pacote normalmente,
   * mas se tentar repassar para outro dispositivo, o TTL é decrementado para 0 e descartado.
   */
  async ensureAntiTetheringRule(bridgeName: string = 'bridge'): Promise<{ status: string; id?: string }> {
    if (!this.client) throw new Error('Not connected');
    try {
      const mangleMenu = this.client.menu('/ip/firewall/mangle');
      const rules = ((await mangleMenu.get()) as any[]) || [];
      const existing = rules.find(
        (r: any) =>
          r.comment &&
          r.comment.includes('Anti-Tethering') &&
          (r['out-interface'] === bridgeName || !r['out-interface'])
      );

      if (existing) {
        if (existing.disabled === 'true' || existing.disabled === 'yes') {
          const eid = existing['.id'] || existing.id;
          await mangleMenu.update({ '.id': eid, disabled: 'no' });
          return { status: 'enabled', id: eid };
        }
        return { status: 'already_exists', id: existing['.id'] || existing.id };
      }

      // Adiciona a regra de Mangle postrouting change-ttl set:1
      const res = await mangleMenu.add({
        chain: 'postrouting',
        action: 'change-ttl',
        'new-ttl': 'set:1',
        'out-interface': bridgeName,
        comment: 'MikroGestor: Anti-Tethering (Bloqueio Compartilhamento)',
        passthrough: 'yes',
      });

      return { status: 'created', id: res?.id || res?.['.id'] };
    } catch (err: any) {
      console.warn('[Anti-Tethering] Erro ao configurar regra Mangle:', err);
      throw err;
    }
  }

  // --- ISOLAMENTO TOTAL DE TRÁFEGO HOTSPOT (IPV6 & FASTTRACK) --- //

  /**
   * Desativa o IPv6 e o FastTrack no RouterOS para garantir isolamento absoluto do Hotspot.
   * O Hotspot do RouterOS é estritamente IPv4. Aplicativos modernos (Google, WhatsApp, Telegram)
   * utilizam IPv6 por padrão (Happy Eyeballs RFC 8305). Se o IPv6 estiver ativo, esses serviços
   * contornam o Captive Portal completamente. Da mesma forma, o FastTrack (action=fasttrack-connection)
   * faz com que pacotes estabelecidos contornem as cadeias do firewall e o Hotspot.
   */
  async ensureHotspotTrafficIsolation(bridgeName: string = 'bridge'): Promise<{
    ipv6Disabled: boolean;
    fasttrackDisabled: number;
  }> {
    if (!this.client) throw new Error('Not connected');

    let ipv6Disabled = false;
    let fasttrackDisabled = 0;

    // 1. Desativa FastTrack no Firewall IPv4
    try {
      const filterMenu = this.client.menu('/ip/firewall/filter');
      const allFilters = ((await filterMenu.get()) as any[]) || [];
      const ftRules = allFilters.filter(
        (r: any) =>
          r.action === 'fasttrack-connection' &&
          r.disabled !== true &&
          r.disabled !== 'true' &&
          r.disabled !== 'yes'
      );

      for (const r of ftRules) {
        const rid = r['.id'] || r.id;
        if (rid) {
          if ((this.client as any).rosApi?.write) {
            await (this.client as any).rosApi.write('/ip/firewall/filter/set', [`=.id=${rid}`, '=disabled=yes']);
          } else {
            await filterMenu.where('.id', rid).update({ disabled: 'yes' });
          }
          fasttrackDisabled++;
        }
      }
    } catch (err) {
      console.warn('[Hotspot Isolation] Erro ao desativar FastTrack:', err);
    }

    // 2. Desativa IPv6 globalmente no RouterOS
    try {
      if ((this.client as any).rosApi?.write) {
        await (this.client as any).rosApi.write('/ipv6/settings/set', ['=disable-ipv6=yes']);
      } else {
        await this.client.menu('/ipv6/settings').update({ 'disable-ipv6': 'yes' });
      }
      ipv6Disabled = true;
    } catch (err) {
      // Fallback: se o pacote IPv6 não suportar disable-ipv6 diretamente, tenta adicionar drop no forward
      try {
        const v6Fw = this.client.menu('/ipv6/firewall/filter');
        const v6Rules = ((await v6Fw.get()) as any[]) || [];
        const hasDrop = v6Rules.some(
          (r: any) => r.chain === 'forward' && r.action === 'drop' && r.comment?.includes('MikroGestor')
        );
        if (!hasDrop) {
          await v6Fw.add({
            chain: 'forward',
            action: 'drop',
            comment: 'MikroGestor: Bloqueio IPv6 para Hotspot',
          });
        }
        ipv6Disabled = true;
      } catch (eFw) {
        console.warn('[Hotspot Isolation] IPv6 já desabilitado ou não disponível:', eFw);
      }
    }

    return { ipv6Disabled, fasttrackDisabled };
  }

  // --- BLOQUEIO DE CAMADA 2 (IP BINDING BLOCKED) --- //

  /**
   * Bloqueia categoricamente um endereço MAC no MikroTik via IP-Binding type=blocked.
   * Remove a sessão ativa imediatamente e derruba qualquer tentativa de acesso,
   * mesmo se o usuário esquecer a rede e reconectar.
   */
  async blockHotspotMac(macAddress: string, comment: string = 'Bloqueado por inadimplencia'): Promise<any> {
    if (!this.client) throw new Error('Not connected');
    const cleanMac = macAddress.trim().toUpperCase();
    if (!cleanMac) throw new Error('MAC Address inválido para bloqueio.');

    // 1. Derruba qualquer sessão ativa deste MAC
    await this.removeHotspotActiveByMac(cleanMac).catch(() => null);

    // 2. Procura e remove bindings existentes (ex: bypassed antigos)
    const bindingMenu = this.client.menu('/ip/hotspot/ip-binding');
    const existing = ((await bindingMenu.where('mac-address', cleanMac).get()) as any[]) || [];

    for (const b of existing) {
      const bid = b['.id'] || b.id;
      if (b.type === 'blocked') {
        return b; // Já está bloqueado
      }
      if (bid) await bindingMenu.remove(bid).catch(() => null);
    }

    // 3. Adiciona regra categórica de bloqueio
    return await bindingMenu.add({
      'mac-address': cleanMac,
      type: 'blocked',
      comment: `MikroGestor: ${comment}`.substring(0, 100),
    });
  }

  /**
   * Desbloqueia um endereço MAC no MikroTik removendo a regra de IP-Binding blocked.
   */
  async unblockHotspotMac(macAddress: string): Promise<boolean> {
    if (!this.client) throw new Error('Not connected');
    const cleanMac = macAddress.trim().toUpperCase();
    if (!cleanMac) return false;

    const bindingMenu = this.client.menu('/ip/hotspot/ip-binding');
    const existing = ((await bindingMenu.where('mac-address', cleanMac).get()) as any[]) || [];
    let removed = false;

    for (const b of existing) {
      const bid = b['.id'] || b.id;
      if (bid) {
        await bindingMenu.remove(bid).catch(() => null);
        removed = true;
      }
    }
    return removed;
  }

  // --- ACESSO TEMPORÁRIO CIRÚRGICO AO WHATSAPP PÓS-PAGAMENTO --- //

  /**
   * Localiza o IP atual do cliente no MikroTik a partir do seu endereço MAC.
   * Varre /ip/hotspot/host, /ip/dhcp-server/lease e /ip/arp.
   */
  async getClientIpByMac(mac: string): Promise<string | null> {
    if (!this.client) throw new Error('Not connected');
    const cleanMac = mac.trim().toUpperCase();
    if (!cleanMac) return null;

    // 1. Tenta encontrar no /ip/hotspot/host
    try {
      const hosts = ((await this.client.menu('/ip/hotspot/host').get()) as any[]) || [];
      const found = hosts.find((h: any) => {
        const hMac = (h.macAddress || h['mac-address'] || '').toUpperCase();
        return hMac === cleanMac;
      });
      if (found?.address) return found.address;
    } catch (e) {
      console.warn('[getClientIpByMac] Erro em /ip/hotspot/host:', e);
    }

    // 2. Tenta encontrar no /ip/dhcp-server/lease
    try {
      const leases = ((await this.client.menu('/ip/dhcp-server/lease').get()) as any[]) || [];
      const found = leases.find((l: any) => {
        const lMac = (l.macAddress || l['mac-address'] || '').toUpperCase();
        return lMac === cleanMac;
      });
      if (found?.address) return found.address;
    } catch (e) {
      console.warn('[getClientIpByMac] Erro em /ip/dhcp-server/lease:', e);
    }

    // 3. Tenta encontrar no /ip/arp
    try {
      const arps = ((await this.client.menu('/ip/arp').get()) as any[]) || [];
      const found = arps.find((a: any) => {
        const aMac = (a.macAddress || a['mac-address'] || '').toUpperCase();
        return aMac === cleanMac;
      });
      if (found?.address) return found.address;
    } catch (e) {
      console.warn('[getClientIpByMac] Erro em /ip/arp:', e);
    }

    return null;
  }

  /**
   * Libera temporariamente o tráfego do WhatsApp EXCLUSIVAMENTE para o IP deste cliente.
   * Garante que o cliente receba a notificação com Usuário e Senha pelo WhatsApp no celular
   * antes de efetuar o login formal no Hotspot.
   * Não libera nenhum outro site ou serviço geral.
   */
  async addTempWhatsAppAccess(clientIp: string, mac: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    const cleanIp = clientIp.trim();
    const cleanMac = mac.trim().toUpperCase();
    if (!cleanIp) return;

    const commentTag = `MikroGestor: Temp WhatsApp ${cleanIp} - ${cleanMac}`;

    // 1. Regra no Firewall Filter (portas nativas do protocolo de mensagens WhatsApp)
    try {
      const filterMenu = this.client.menu('/ip/firewall/filter');
      const existingFilter = ((await filterMenu.where('comment', commentTag).get()) as any[]) || [];
      if (existingFilter.length === 0) {
        await filterMenu.add({
          chain: 'forward',
          action: 'accept',
          'src-address': cleanIp,
          protocol: 'tcp',
          'dst-port': '5222,5223,5228,4244',
          comment: commentTag,
        });
      }
    } catch (err) {
      console.warn('[addTempWhatsAppAccess] Erro ao adicionar filter rule:', err);
    }

    // 2. Regras no Walled Garden IP (HTTPS porta 443 para WhatsApp)
    try {
      const wgIpMenu = this.client.menu('/ip/hotspot/walled-garden/ip');
      const waHosts = ['whatsapp.net', 'whatsapp.com', 'web.whatsapp.com', 'api.whatsapp.com'];
      for (const d of waHosts) {
        const existing = ((await wgIpMenu.where('src-address', cleanIp).where('dst-host', d).get()) as any[]) || [];
        if (existing.length === 0) {
          await wgIpMenu.add({
            action: 'accept',
            'src-address': cleanIp,
            'dst-host': d,
            comment: commentTag,
          });
        }
      }
    } catch (err) {
      console.warn('[addTempWhatsAppAccess] Erro ao adicionar WG IP rule:', err);
    }

    // 3. Regra no Walled Garden HTTP
    try {
      const wgMenu = this.client.menu('/ip/hotspot/walled-garden');
      const existingWg = ((await wgMenu.where('src-address', cleanIp).where('dst-host', '*whatsapp*').get()) as any[]) || [];
      if (existingWg.length === 0) {
        await wgMenu.add({
          action: 'allow',
          'src-address': cleanIp,
          'dst-host': '*whatsapp*',
          comment: commentTag,
        });
      }
    } catch (err) {
      console.warn('[addTempWhatsAppAccess] Erro ao adicionar WG HTTP rule:', err);
    }
  }

  /**
   * Deleta todas as regras temporárias de firewall criadas para um cliente (por IP ou MAC).
   * Chamado automaticamente pelo MikroTik on-login ou pelo backend.
   */
  async removeTempWhatsAppAccess(clientIpOrMac: string): Promise<number> {
    if (!this.client) throw new Error('Not connected');
    const term = clientIpOrMac.trim();
    if (!term) return 0;
    let count = 0;

    // 1. Limpa de /ip/firewall/filter
    try {
      const filterMenu = this.client.menu('/ip/firewall/filter');
      const filters = ((await filterMenu.get()) as any[]) || [];
      for (const f of filters) {
        if (f.comment && f.comment.includes('Temp WhatsApp') && f.comment.includes(term)) {
          const fid = f['.id'] || f.id;
          if (fid) {
            await filterMenu.remove(fid).catch(() => null);
            count++;
          }
        }
      }
    } catch (e) {
      console.warn('[removeTempWhatsAppAccess] Erro ao remover do filter:', e);
    }

    // 2. Limpa de /ip/hotspot/walled-garden/ip
    try {
      const wgIpMenu = this.client.menu('/ip/hotspot/walled-garden/ip');
      const wgIps = ((await wgIpMenu.get()) as any[]) || [];
      for (const w of wgIps) {
        if (w.comment && w.comment.includes('Temp WhatsApp') && w.comment.includes(term)) {
          const wid = w['.id'] || w.id;
          if (wid) {
            await wgIpMenu.remove(wid).catch(() => null);
            count++;
          }
        }
      }
    } catch (e) {
      console.warn('[removeTempWhatsAppAccess] Erro ao remover de WG IP:', e);
    }

    // 3. Limpa de /ip/hotspot/walled-garden
    try {
      const wgMenu = this.client.menu('/ip/hotspot/walled-garden');
      const wgs = ((await wgMenu.get()) as any[]) || [];
      for (const w of wgs) {
        if (w.comment && w.comment.includes('Temp WhatsApp') && w.comment.includes(term)) {
          const wid = w['.id'] || w.id;
          if (wid) {
            await wgMenu.remove(wid).catch(() => null);
            count++;
          }
        }
      }
    } catch (e) {
      console.warn('[removeTempWhatsAppAccess] Erro ao remover de WG HTTP:', e);
    }

    return count;
  }

  async setTimeBlockRule(startTime: string, endTime: string, days: string, comment: string) {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/firewall/filter');
    // time format: start-end,days -> e.g. 22:00:00-06:00:00,sun,mon,tue,wed,thu,fri,sat
    return await menu.add({
      chain: 'forward',
      action: 'drop',
      time: `${startTime}-${endTime},${days}`,
      comment: `MikroGestor Bloqueio Horario: ${comment}`
    });
  }

  async getTimeBlockRules() {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/firewall/filter');
    const rules = await menu.get();
    return rules.filter((r: any) => r.comment && r.comment.startsWith('MikroGestor Bloqueio Horario:'));
  }

  async removeTimeBlockRule(id: string) {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/firewall/filter');
    return await menu.remove(id);
  }

  /** Returns ALL rules in /ip/firewall/filter (used by the provisioning audit) */
  async getAllFirewallFilterRules(): Promise<any[]> {
    if (!this.client) throw new Error('Not connected');
    try {
      return await this.client.menu('/ip/firewall/filter').get() as any[];
    } catch {
      return [];
    }
  }

  // --- PPP / PPPoE --- //
  async getPppSecrets() {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ppp/secret');
    return await menu.get();
  }

  // --- DHCP LEASES --- //
  async getDhcpLeases() {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/dhcp-server/lease');
    return await menu.get();
  }

  // --- TRAFFIC MONITOR --- //
  async getInterfaces() {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/interface');
    return await menu.get();
  }

  async getTraffic(interfaceName: string) {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/interface');
    // Executes: /interface/monitor-traffic interface=interfaceName once=yes
    const traffic = await menu.exec('monitor-traffic', { interface: interfaceName, once: true });
    return traffic;
  }

  // --- IP ADDRESSES, POOLS, DHCP & NAT (PROVISIONING) --- //
  async getIpAddresses() {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/address').get();
  }

  async addIpAddress(address: string, network: string, interfaceName: string) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/address').add({
      address,
      network,
      interface: interfaceName
    });
  }

  async getIpPools() {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/pool').get();
  }

  async addIpPool(name: string, ranges: string) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/pool').add({
      name,
      ranges
    });
  }

  async getDhcpNetworks() {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/dhcp-server/network').get();
  }

  async addDhcpServerNetwork(address: string, gateway: string, dns: string) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/dhcp-server/network').add({
      address,
      gateway,
      'dns-server': dns
    });
  }

  async getDhcpServers() {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/dhcp-server').get();
  }

  async addDhcpServer(name: string, interfaceName: string, poolName: string, leaseTime: string = '00:30:00') {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/dhcp-server').add({
      name,
      interface: interfaceName,
      'address-pool': poolName,
      'lease-time': leaseTime,
      'add-arp': 'yes',
      disabled: 'no'
    });
  }

  async getSimpleQueues() {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/queue/simple').get();
  }

  async getSchedulers() {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/system/scheduler').get();
  }

  async addScheduler(params: any) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/system/scheduler').add(params);
  }

  async setScheduler(params: any, id: string) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/system/scheduler').set(params, id);
  }

  async removeScheduler(id: string) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/system/scheduler').remove(id);
  }

  async getSystemScripts() {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/system/script').get();
  }

  async removeSystemScript(id: string) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/system/script').remove(id);
  }

  // --- HOTSPOT SERVERS AND SERVER PROFILES --- //
  async getHotspotServerProfiles() {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/hotspot/profile').get();
  }

  async addHotspotServerProfile(profile: any) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/hotspot/profile').add(profile);
  }

  async addHotspotServer(server: any) {
    if (!this.client) throw new Error('Not connected');
    // Correct path: /ip/hotspot (NOT /ip/hotspot/server)
    return await this.client.menu('/ip/hotspot').add(server);
  }

  /**
   * Smart upsert: checks state and creates/enables/corrects the hotspot server as needed.
   * Returns { action: 'created' | 'enabled' | 'updated' | 'already_active', id: string }
   */
  async upsertHotspotServer(server: {
    name: string;
    interface: string;
    'address-pool': string;
    profile: string;
    disabled?: string;
  }): Promise<{ action: string; id?: string; existing?: any }> {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/hotspot');
    const existing = await menu.get() as any[];

    // Check by name OR by interface (same interface = same logical server)
    const byName  = existing.find((s: any) => s.name === server.name);
    const byIface = existing.find((s: any) => s.interface === server.interface);
    const found   = byName || byIface;

    if (found) {
      const isDisabled = found.disabled === 'true' || found.disabled === 'yes';
      const isMismatched = found['address-pool'] !== server['address-pool'] || found.profile !== server.profile;
      
      if (isDisabled || isMismatched) {
        await menu.where('.id', found.id).update({
          disabled: 'no',
          'address-pool': server['address-pool'],
          profile: server.profile
        });
        return { action: 'updated', id: found.id, existing: found };
      }
      // Already active and correct
      return { action: 'already_active', id: found.id, existing: found };
    }

    // Doesn't exist — create it
    const id = await menu.add({ ...server, disabled: 'no' });
    return { action: 'created', id };
  }

  async getNatRules() {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/firewall/nat').get();
  }

  async addNatMasquerade(srcAddress: string) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/firewall/nat').add({
      chain: 'srcnat',
      'src-address': srcAddress,
      action: 'masquerade',
      comment: 'MikroGestor NAT Masquerade'
    });
  }

  async addNatMasqueradeWan(wanInterface: string) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/firewall/nat').add({
      chain: 'srcnat',
      'out-interface': wanInterface,
      action: 'masquerade',
      comment: `MikroGestor NAT WAN: ${wanInterface}`
    });
  }


  // --- KEYWORD FIREWALL BLOCKING --- //
  async getKeywordBlockRules() {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/firewall/filter');
    const list = await menu.get();
    return list.filter((r: any) => r.comment && r.comment.startsWith('MikroGestor Bloqueio Palavra:'));
  }

  async addKeywordBlockRule(keyword: string) {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/firewall/filter');
    
    // 1. Add TCP 443 tls-host drop rule
    await menu.add({
      chain: 'forward',
      protocol: 'tcp',
      'dst-port': '443',
      'tls-host': `*${keyword}*`,
      action: 'drop',
      comment: `MikroGestor Bloqueio Palavra: ${keyword} (HTTPS)`
    });

    // 2. Add TCP 80 content drop rule
    await menu.add({
      chain: 'forward',
      protocol: 'tcp',
      'dst-port': '80',
      content: keyword,
      action: 'drop',
      comment: `MikroGestor Bloqueio Palavra: ${keyword} (HTTP)`
    });
  }

  async removeKeywordBlockRules(keyword: string) {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/firewall/filter');
    const rules = await menu.get();
    for (const r of rules) {
      if (r.comment && r.comment.startsWith(`MikroGestor Bloqueio Palavra: ${keyword}`)) {
        await menu.remove(r.id);
      }
    }
  }

  async isProvisionedByMikroGestor(): Promise<boolean> {
    if (!this.client) throw new Error('Not connected');

    // Check 1: System Note contains MikroGestor
    try {
      const notes = await this.client.menu('/system/note').get() as any[];
      if (notes && notes.length > 0 && notes[0].note && notes[0].note.includes('MikroGestor:PROVISIONED')) {
        return true;
      }
    } catch (e) {
      // note not found or error, continue
    }

    // Check 2: System Script named MikroGestor_PROVISIONED
    try {
      const scripts = await this.client.menu('/system/script').get() as any[];
      if (scripts && scripts.some((s: any) => s.name === 'MikroGestor_PROVISIONED')) {
        return true;
      }
    } catch (e) {
      // script not found or error, continue
    }

    // Check 3: Bridge comment contains PROVISIONED
    try {
      const bridges = await this.getBridges();
      const ours = bridges.find((b: any) => b.name === 'bridge-hotspot');
      if (ours && ours.comment && ours.comment.includes('PROVISIONED')) {
        return true;
      }
    } catch (e) {
      // bridge check failed
    }

    // Check 4: Hotspot comment contains PROVISIONED
    try {
      const servers = await this.getHotspotServers();
      const ours = servers.find((s: any) => s.name === 'hs_hotspot' || s.interface === 'bridge-hotspot');
      if (ours && ours.comment && ours.comment.includes('PROVISIONED')) {
        return true;
      }
    } catch (e) {
      // hotspot check failed
    }

    return false;
  }

  async writeProvisioningSignature(): Promise<void> {
    if (!this.client) throw new Error('Not connected');

    // 1. Create a dummy script /system/script MikroGestor_PROVISIONED
    try {
      const scriptMenu = this.client.menu('/system/script');
      const existing = await scriptMenu.get() as any[];
      const already = existing.some((s: any) => s.name === 'MikroGestor_PROVISIONED');
      if (!already) {
        await scriptMenu.add({
          name: 'MikroGestor_PROVISIONED',
          comment: 'MikroGestor:PROVISIONED',
          source: '# Provisionado por MikroGestor'
        });
      }
    } catch (e) {
      console.warn('Failed to write signature to system script:', e);
    }

    // 2. Set System Note /system/note
    try {
      const noteMenu = this.client.menu('/system/note');
      await noteMenu.set({ note: 'MikroGestor:PROVISIONED' });
    } catch (e) {
      console.warn('Failed to write signature to system note:', e);
    }

    // 3. Set comment on bridge-hotspot
    try {
      const bridgeMenu = this.client.menu('/interface/bridge');
      const bridges = await bridgeMenu.get() as any[];
      const ours = bridges.find((b: any) => b.name === 'bridge-hotspot');
      if (ours && ours.id) {
        await bridgeMenu.where('.id', ours.id).update({ comment: 'MikroGestor Bridge — PROVISIONED' });
      }
    } catch (e) {
      console.warn('Failed to write signature to bridge comment:', e);
    }

    // 4. Set comment on hs_hotspot server
    try {
      const hsMenu = this.client.menu('/ip/hotspot');
      const servers = await hsMenu.get() as any[];
      const ours = servers.find((s: any) => s.name === 'hs_hotspot' || s.interface === 'bridge-hotspot');
      if (ours && ours.id) {
        await hsMenu.where('.id', ours.id).update({ comment: 'MikroGestor Hotspot — PROVISIONED' });
      }
    } catch (e) {
      console.warn('Failed to write signature to hotspot comment:', e);
    }
  }

  async ensureApiAccessNotBlocked(): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    const menu = this.client.menu('/ip/firewall/filter');
    try {
      const rules = await menu.get() as any[];

      // ── 1. API RouterOS (8728 plain + 8729 SSL) ───────────────────────────
      const apiRule = rules.find((r: any) => r.comment === 'MikroGestor: Accept API Access');
      if (!apiRule) {
        const addParams: any = {
          chain: 'input',
          protocol: 'tcp',
          'dst-port': '8728,8729',
          action: 'accept',
          comment: 'MikroGestor: Accept API Access'
        };
        // Posiciona no topo apenas se já existir alguma regra
        if (rules.length > 0 && rules[0]['.id']) {
          addParams['place-before'] = rules[0]['.id'];
        }
        await menu.add(addParams);
      } else if (apiRule.disabled === 'true' || apiRule.disabled === 'yes') {
        await menu.where('.id', apiRule.id).update({ disabled: 'no' });
      }

      // ── 2. Winbox (8291) ──────────────────────────────────────────────────
      // Re-fetch so indexes are accurate after possible insert above
      const rulesAfterApi = await menu.get() as any[];
      const winboxRule = rulesAfterApi.find((r: any) => r.comment === 'MikroGestor: Accept Winbox');
      if (!winboxRule) {
        const addParams: any = {
          chain: 'input',
          protocol: 'tcp',
          'dst-port': '8291',
          action: 'accept',
          comment: 'MikroGestor: Accept Winbox'
        };
        if (rulesAfterApi.length > 0 && rulesAfterApi[0]['.id']) {
          addParams['place-before'] = rulesAfterApi[0]['.id'];
        }
        await menu.add(addParams);
      } else if (winboxRule.disabled === 'true' || winboxRule.disabled === 'yes') {
        await menu.where('.id', winboxRule.id).update({ disabled: 'no' });
      }
    } catch (e) {
      console.warn('Failed to ensure firewall API/Winbox rules:', e);
    }
  }

  /**
   * Registra o IP/MAC do servidor no MikroTik para garantir acesso administrativo.
   *
   * MODO LOCAL (DEPLOYMENT_MODE=local ou não definido):
   *   1. /ip/arp  — entrada ARP estática na bridge LAN (garante alcançabilidade)
   *   2. /ip/hotspot/ip-binding — type=bypassed (admin nunca vê captive portal)
   *   3. /ip/dns/static — portal.wifi.local → IP LAN do servidor
   *   4. /ip/hotspot/walled-garden — libera IP LAN e portal.wifi.local
   *
   * MODO VPS (DEPLOYMENT_MODE=vps):
   *   • Não cria ARP/IP-binding com IP Docker (inacessível para hotspot)
   *   • NÃO cria DNS estático portal.wifi.local → IP Docker (causaria bloqueio!)
   *   • Walled Garden libera o DOMÍNIO PÚBLICO (publicDomain) e o IP VPN (10.8.0.1)
   *   • Force DNS (redirect porta 53) é mantido em ambos os modos
   */
  async ensureAdminArpAndBypass(
    adminIp: string,
    bridgeName: string,
    adminMac?: string,
    opts?: { mode?: 'local' | 'vps'; publicDomain?: string }
  ): Promise<{ arp: string; bypass: string }> {
    if (!this.client) throw new Error('Not connected');
    const result = { arp: '', bypass: '' };
    const isVps = opts?.mode === 'vps';
    const publicDomain = opts?.publicDomain?.trim() || '';

    // ── ARP + IP Binding: apenas no modo LOCAL ────────────────────────────────
    // No modo VPS o container Docker não tem IP roteável pelo hotspot dos clientes.
    // Adicionar o IP Docker à tabela ARP/IP-Binding não tem efeito útil e pode
    // confundir o diagnóstico de rede.
    if (!isVps) {
      // ARP table
      try {
        const arpMenu = this.client.menu('/ip/arp');
        const arpEntries = await arpMenu.get() as any[];
        const existingArp = arpEntries.find(
          (e: any) => e.address === adminIp && (e.interface === bridgeName || e.comment?.includes('MikroGestor'))
        );
        if (!existingArp) {
          const arpParams: any = {
            address: adminIp,
            interface: bridgeName,
            comment: 'MikroGestor: Admin System IP'
          };
          if (adminMac) arpParams['mac-address'] = adminMac;
          await arpMenu.add(arpParams);
          result.arp = `IP ${adminIp} adicionado à tabela ARP na interface ${bridgeName}.`;
        } else {
          result.arp = `IP ${adminIp} já presente na tabela ARP.`;
        }
      } catch (e: any) {
        result.arp = `ARP: ${e?.message || 'erro desconhecido (não crítico).'}`;
        console.warn('Failed to add ARP entry:', e);
      }

      // Hotspot IP Binding (bypassed)
      try {
        const bindMenu = this.client.menu('/ip/hotspot/ip-binding');
        const bindings = await bindMenu.get() as any[];
        const existingBind = bindings.find(
          (b: any) => b.address === adminIp && b.type === 'bypassed'
        );
        if (!existingBind) {
          const bindParams: any = {
            address: adminIp,
            type: 'bypassed',
            comment: 'MikroGestor: Admin System IP — bypass automático'
          };
          if (adminMac) bindParams['mac-address'] = adminMac;
          await bindMenu.add(bindParams);
          result.bypass = `IP ${adminIp} (MAC: ${adminMac || 'N/A'}) adicionado ao Hotspot como bypassed.`;
        } else {
          result.bypass = `IP ${adminIp} já está bypassed no Hotspot.`;
        }
      } catch (e: any) {
        result.bypass = `Bypass: ${e?.message || 'erro desconhecido (não crítico).'}`;
        console.warn('Failed to add hotspot bypass binding:', e);
      }
    } else {
      result.arp    = 'Modo VPS: ARP estático ignorado (IP Docker não roteável pelo hotspot).';
      result.bypass = 'Modo VPS: IP Binding ignorado (IP Docker não roteável pelo hotspot).';
    }

    // ── Walled Garden (HTTP e IP) unificado e deduplicado ─────────────────────
    try {
      await this.ensureWalledGardenRules({
        mode: isVps ? 'vps' : 'local',
        publicDomain,
        adminIp,
      });
    } catch (e: any) {
      console.warn('Failed to configure walled garden rules in ensureAdminArpAndBypass:', e);
    }

    // ── Force DNS (Redirect & Block Private DNS) — ambos os modos ────────────
    try {
      await this.client.menu('/ip/dns').set({ 'allow-remote-requests': 'yes' }).catch(() => null);

      const filterMenu = this.client.menu('/ip/firewall/filter');
      const filters = await filterMenu.get() as any[];
      if (!filters.find((f: any) => f['dst-port'] === '853' && f.chain === 'forward')) {
        await filterMenu.add({ chain: 'forward', protocol: 'tcp', 'dst-port': '853', action: 'drop', comment: 'Block Private DNS (DoT)', 'place-before': '0' }).catch(() => null);
      }
      if (!filters.find((f: any) => f['dst-port'] === '853' && f.chain === 'input')) {
        await filterMenu.add({ chain: 'input', protocol: 'tcp', 'dst-port': '853', action: 'drop', comment: 'Block Private DNS (DoT)', 'place-before': '0' }).catch(() => null);
      }

      const natMenu = this.client.menu('/ip/firewall/nat');
      const nats = await natMenu.get() as any[];
      if (!nats.find((n: any) => n['dst-port'] === '53' && n.protocol === 'udp' && n.action === 'redirect')) {
        await natMenu.add({ chain: 'dstnat', protocol: 'udp', 'dst-port': '53', action: 'redirect', 'to-ports': '53', comment: 'Force local DNS UDP', 'place-before': '0' }).catch(() => null);
      }
      if (!nats.find((n: any) => n['dst-port'] === '53' && n.protocol === 'tcp' && n.action === 'redirect')) {
        await natMenu.add({ chain: 'dstnat', protocol: 'tcp', 'dst-port': '53', action: 'redirect', 'to-ports': '53', comment: 'Force local DNS TCP', 'place-before': '0' }).catch(() => null);
      }
    } catch (e) {
      console.warn('Failed to force DNS during provisioning:', e);
    }

    // ── Static DNS: portal.wifi.local → IP do Servidor ────────────────────────
    // MODO LOCAL: cria/atualiza entrada DNS estática apontando para IP LAN
    // MODO VPS:   NÃO cria DNS estático!
    //   Razão: no modo VPS, o "adminIp" é um IP Docker interno (172.17.x.x),
    //   que é completamente inacessível para clientes do hotspot. Criar esse
    //   DNS faria portal.wifi.local resolver para um IP morto, bloqueando
    //   todo o acesso ao portal de login do hotspot.
    //   No modo VPS o hotspot usa o PORTAL_PUBLIC_DOMAIN diretamente.
    if (!isVps) {
      try {
        const dnsMenu = this.client.menu('/ip/dns/static');
        const list = await dnsMenu.get() as any[];
        const exists = list.find((d: any) => d.name === 'portal.wifi.local' && d.address === adminIp);
        if (!exists) {
          // Remove entradas antigas de portal.wifi.local
          const olds = list.filter((d: any) => d.name === 'portal.wifi.local');
          for (const old of olds) {
            await dnsMenu.remove(old.id || old['.id']);
          }
          await dnsMenu.add({
            name: 'portal.wifi.local',
            address: adminIp,
            comment: 'MikroGestor: Magic Link DNS'
          });
        }
      } catch (e: any) {
        console.warn('Failed to add static DNS during provisioning:', e);
      }
    } else {
      console.log('[Provision VPS] DNS estático portal.wifi.local NÃO criado (modo VPS — usando domínio público).');
    }

    return result;
  }

  disconnect() {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
      this.client = null;
    }
  }

  // --- BRIDGE MANAGEMENT --- //

  async getBridges() {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/interface/bridge').get();
  }

  async addBridge(name: string) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/interface/bridge').add({
      name,
      'auto-mac': 'yes',
      comment: 'MikroGestor Bridge'
    });
  }

  async getBridgePorts() {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/interface/bridge/port').get();
  }

  async addBridgePort(bridgeName: string, interfaceName: string) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/interface/bridge/port').add({
      bridge: bridgeName,
      interface: interfaceName,
      comment: 'MikroGestor Port'
    });
  }

  // --- HOTSPOT IP BINDING --- //

  async getHotspotIpBindings() {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/hotspot/ip-binding').get();
  }

  async addHotspotIpBinding(address: string, type: 'bypassed' | 'blocked' | 'regular', comment: string = '', macAddress?: string) {
    if (!this.client) throw new Error('Not connected');
    const params: any = {
      address: address,
      type: type,
      comment: `MikroGestor: ${comment}`
    };
    if (macAddress) {
      params['mac-address'] = macAddress;
    }
    return await this.client.menu('/ip/hotspot/ip-binding').add(params);
  }

  async removeHotspotIpBinding(id: string) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/hotspot/ip-binding').remove(id);
  }

  async updateHotspotUser(id: string, params: Record<string, any>) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/hotspot/user').update({ '.id': id, ...params });
  }

  async updateHotspotIpBinding(id: string, params: Record<string, any>) {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/ip/hotspot/ip-binding').update({ '.id': id, ...params });
  }

  // --- DEFAULT HOTSPOT USER PROFILE --- //

  async addHotspotUserProfile(profile: {
    name: string;
    rateLimit?: string;
    sessionTimeout?: string;
    sharedUsers?: string;
    onLogin?: string;
  }) {
    if (!this.client) throw new Error('Not connected');
    const params: any = { name: profile.name };
    if (profile.rateLimit) params['rate-limit'] = profile.rateLimit;
    if (profile.sessionTimeout) params['session-timeout'] = profile.sessionTimeout;
    if (profile.sharedUsers) params['shared-users'] = profile.sharedUsers;
    if (profile.onLogin) params['on-login'] = profile.onLogin;
    return await this.client.menu('/ip/hotspot/user/profile').add(params);
  }

  // --- SYSTEM PACKAGES --- //

  async getPackages() {
    if (!this.client) throw new Error('Not connected');
    return await this.client.menu('/system/package').get();
  }

  // --- SMART HOTSPOT DIAGNOSTICS --- //

  async checkHotspot(): Promise<{
    available: boolean;
    version: string;
    majorVersion: number;
    installedPackages: string[];
    probeError: string;
  }> {
    let version = 'desconhecida';
    let installedPackages: string[] = [];
    let probeError = '';

    // 1. Get RouterOS version
    try {
      const res = await this.getSystemResources();
      version = res[0]?.version || 'desconhecida';
    } catch { /* ignore */ }

    // 2. List installed packages (names only, no disabled flag for matching)
    try {
      const pkgs = await this.client!.menu('/system/package').get();
      installedPackages = (pkgs as any[]).map((p: any) => p.name);
    } catch { /* ignore */ }

    const majorVersion = parseInt(version.split('.')[0] || '0', 10);

    // 3. SMART DETECTION — version-aware
    //
    //  RouterOS 7.x: hotspot is ALWAYS included in the base 'routeros' package.
    //  No separate 'hotspot' package exists in v7 — it's part of the core system.
    //  Checking for 'routeros' package presence is the correct signal.
    //
    //  RouterOS 6.x: hotspot was a SEPARATE optional package named 'hotspot'.
    //
    if (majorVersion >= 7) {
      const hasBasePackage = installedPackages.some(p => p === 'routeros' || p === 'system');
      if (hasBasePackage) {
        // RouterOS 7.x with base package = hotspot is always available
        return { available: true, version, majorVersion, installedPackages, probeError: '' };
      }
    }

    // 4. RouterOS 6.x or unknown version: check for explicit hotspot package
    const hasHotspotPkg = installedPackages.some(p =>
      p === 'hotspot' || p === 'advanced-tools'
    );
    if (hasHotspotPkg) {
      return { available: true, version, majorVersion, installedPackages, probeError: '' };
    }

    // 5. Last resort: live probe (catches edge cases)
    try {
      await this.client!.menu('/ip/hotspot').get();
      return { available: true, version, majorVersion, installedPackages, probeError: '' };
    } catch (e: any) {
      probeError = e?.message || 'erro desconhecido';
      return { available: false, version, majorVersion, installedPackages, probeError };
    }
  }

  /** @deprecated Use checkHotspot() instead */
  async isHotspotAvailable(): Promise<boolean> {
    const result = await this.checkHotspot();
    return result.available;
  }
}

// Singleton for API across requests if needed, but in serverless/Next.js edge we might need to handle sessions.
// For now, we'll instantiate it per request based on cookies.
