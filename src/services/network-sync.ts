import os from 'os';
import { prisma } from '@/lib/prisma';
import { MikrotikAPI } from '@/lib/routeros';

export class NetworkSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;

  public startAutoSync(initialDelayMs = 15000, intervalMs = 5 * 60 * 1000) {
    if (this.syncInterval) return;

    setTimeout(() => {
      this.syncNetworkIp().catch((err) => {
        console.error('[NetworkSync] Initial sync error:', err);
      });
    }, initialDelayMs);

    this.syncInterval = setInterval(() => {
      this.syncNetworkIp().catch((err) => {
        console.error('[NetworkSync] Interval sync error:', err);
      });
    }, intervalMs);
  }

  public async syncNetworkIp(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const router = await prisma.router.findFirst({ where: { active: true } });
      if (!router || !router.host) return;

      // ── CORREÇÃO BUG: Não tenta conectar em roteadores com VPN pendente ────────
      // Se o roteador tem VPN habilitada mas vpnStatus ainda é 'pending', significa
      // que o script WireGuard ainda não foi executado no MikroTik. Tentar conectar
      // nesse estado causa EHOSTUNREACH (errno: -113) repetido nos logs.
      if (router.vpnEnabled && (router as any).vpnStatus === 'pending') {
        console.log(`[NetworkSync] Roteador "${router.name}" aguardando execução do script WireGuard. Sincronização adiada até o túnel ser estabelecido.`);
        return;
      }

      const interfaces = os.networkInterfaces();
      const routerPrefix = router.host.split('.').slice(0, 3).join('.');
      let currentIp = '127.0.0.1';

      // 1. Prefer interface matching router subnet
      for (const name of Object.keys(interfaces)) {
        const list = interfaces[name];
        if (!list) continue;
        for (const iface of list) {
          if (iface.family === 'IPv4' && !iface.internal) {
            if (iface.address.startsWith(routerPrefix + '.')) {
              currentIp = iface.address;
              break;
            }
          }
        }
        if (currentIp !== '127.0.0.1') break;
      }

      // 2. Fallback to any non-internal IPv4
      if (currentIp === '127.0.0.1') {
        for (const name of Object.keys(interfaces)) {
          const list = interfaces[name];
          if (!list) continue;
          for (const iface of list) {
            if (iface.family === 'IPv4' && !iface.internal) {
              currentIp = iface.address;
              break;
            }
          }
          if (currentIp !== '127.0.0.1') break;
        }
      }

      const isVps = process.env.DEPLOYMENT_MODE === 'vps' || router.vpnEnabled;

      const api = new MikrotikAPI();
      const connected = await api.connect(router.host, router.user, router.password, router.port);
      if (!connected) return;

      if (isVps) {
        // ── MODO VPS: NUNCA injeta IPs do Docker ou portal.wifi.local ───────────
        // Remove quaisquer entradas legadas de portal.wifi.local ou IPs de container
        try {
          const dnsMenu = (api as any).client.menu('/ip/dns/static');
          const listDns = ((await dnsMenu.get()) as any[]) || [];
          for (const d of listDns) {
            if (d.name === 'portal.wifi.local') {
              const id = d.id || d['.id'];
              if (id) {
                await dnsMenu.remove(id).catch(() => null);
                console.log('[AutoSync] Removida entrada legada de portal.wifi.local no modo VPS.');
              }
            }
          }

          const wgIpMenu = (api as any).client.menu('/ip/hotspot/walled-garden/ip');
          const listIp = ((await wgIpMenu.get()) as any[]) || [];
          for (const item of listIp) {
            const addr = item.dstAddress || item['dst-address'] || '';
            if (
              addr.startsWith('172.16.') ||
              addr.startsWith('172.17.') ||
              addr.startsWith('192.168.') ||
              (item.comment && item.comment.includes('Auto-Cadastro'))
            ) {
              const id = item.id || item['.id'];
              if (id) {
                await wgIpMenu.remove(id).catch(() => null);
                console.log(`[AutoSync] Removida regra Walled Garden IP legada (${addr}) no modo VPS.`);
              }
            }
          }
        } catch (cleanErr) {
          console.warn('[AutoSync] VPS cleanup warning:', cleanErr);
        }

        await api.close();
        return;
      }

      // ── MODO LOCAL (Servidor na LAN física) ──────────────────────────────────
      try {
        // DNS static entry for portal.wifi.local
        const dnsMenu = (api as any).client.menu('/ip/dns/static');
        const list = (await dnsMenu.get()) as any[];
        const olds = list.filter((d: any) => d.name === 'portal.wifi.local');
        let needsUpdate = olds.length === 0;

        for (const old of olds) {
          if (old.address !== currentIp) {
            needsUpdate = true;
            await dnsMenu.remove(old.id || old['.id']);
          }
        }

        if (needsUpdate) {
          await dnsMenu.add({
            name: 'portal.wifi.local',
            address: currentIp,
            comment: 'MikroGestor: Magic Link DNS (Auto Sync)',
          });
          console.log(`[AutoSync] DNS portal.wifi.local updated to ${currentIp}`);
        }
      } catch (dnsErr) {
        console.warn('[AutoSync] DNS sync warning:', dnsErr);
      }

      try {
        // Walled Garden IP entry
        const wgIpMenu = (api as any).client.menu('/ip/hotspot/walled-garden/ip');
        const listIp = (await wgIpMenu.get()) as any[];

        const oldsIp = listIp.filter(
          (d: any) => d.comment && d.comment.includes('MikroGestor: Auto-Cadastro / API IP')
        );
        let needsWgUpdate = oldsIp.length === 0;

        for (const old of oldsIp) {
          const oldAddr = old.dstAddress || old['dst-address'] || '';
          if (oldAddr !== currentIp) {
            needsWgUpdate = true;
            await wgIpMenu.remove(old.id || old['.id']);
          }
        }

        if (needsWgUpdate) {
          await wgIpMenu.add({
            action: 'accept',
            'dst-address': currentIp,
            comment: 'MikroGestor: Auto-Cadastro / API IP',
          });
          console.log(`[AutoSync] Walled Garden IP updated to ${currentIp}`);
        }
      } catch (wgErr) {
        console.warn('[AutoSync] Walled Garden IP sync warning:', wgErr);
      }

      await api.close();
    } catch (e) {
      console.error('[AutoSync] Error syncing IP to Mikrotik', e);
    } finally {
      this.isSyncing = false;
    }
  }
}

const globalForNetworkSync = globalThis as unknown as {
  networkSyncService: NetworkSyncService | undefined;
};

export const networkSyncService: NetworkSyncService =
  globalForNetworkSync.networkSyncService || new NetworkSyncService();

if (process.env.NODE_ENV !== 'production') {
  globalForNetworkSync.networkSyncService = networkSyncService;
}
