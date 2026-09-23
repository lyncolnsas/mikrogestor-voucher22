/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * WireGuardService — MikroGestor
 *
 * Comunica-se com o WireGuard Manager Daemon (Python HTTP)
 * que roda no HOST da VPS em 127.0.0.1:51821.
 *
 * ARQUITETURA:
 *   [MikroGestor Docker] ──HTTP──> [wg-manager:51821 no HOST] ──> [wg0]
 *
 * Por que daemon? O Next.js roda dentro de um container Docker e não tem
 * acesso direto às interfaces de rede do host. O daemon Python roda como
 * root no host e expõe uma API HTTP apenas em localhost.
 *
 * Requer:
 *   - vpn/setup-vps.sh executado na VPS
 *   - WG_MANAGER_URL=http://host-gateway:51821 (ou http://127.0.0.1:51821)
 *   - WG_MANAGER_SECRET=<secret gerado pelo setup>
 *   - VPS_WG_PUBLIC_KEY=<chave pública da VPS>
 *   - VPS_PUBLIC_IP=<IP público da VPS>
 */

import { prisma, ensureVpnColumns } from "@/lib/prisma";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface WireGuardKeyPair {
  privateKey: string;
  publicKey: string;
}

export interface WireGuardPeerStatus {
  publicKey: string;
  endpoint: string | null;
  allowedIps: string;
  /** Timestamp Unix do último handshake */
  lastHandshake: Date | null;
  /** true se handshake < 3 minutos atrás */
  connected: boolean;
  transferRx: number;
  transferTx: number;
}

export interface RouterOSScriptParams {
  routerName: string;
  vpnIp: string;
  mikrotikPrivKey: string;
  vpsPublicKey: string;
  vpsIp: string;
  vpsPort?: number;
  subdomain?: string;
  routerId?: string;
  slug?: string;
  user?: string;
}

// ─── Constantes ─────────────────────────────────────────────────────────────

const WG_MANAGER_SECRET = process.env.WG_MANAGER_SECRET ?? "";
const VPN_SUBNET_BASE   = "10.8.0";
const VPN_SERVER_OCTET  = 1;
const CONNECTED_MS      = 3 * 60 * 1000;

// ─── HTTP Client com Auto-Discovery de Host Gateway Docker ──────────────────

let discoveredManagerUrl: string | null = null;

async function getManagerUrl(): Promise<string> {
  if (discoveredManagerUrl) return discoveredManagerUrl;

  const candidates: string[] = [];

  // Se variável de ambiente foi fornecida, testa primeiro
  if (process.env.WG_MANAGER_URL) {
    candidates.push(process.env.WG_MANAGER_URL);
  }

  // Tenta ler o gateway padrão diretamente de /proc/net/route no Linux/Docker
  try {
    const fs = await import("fs");
    if (fs.existsSync("/proc/net/route")) {
      const routes = fs.readFileSync("/proc/net/route", "utf8").split("\n");
      for (const line of routes) {
        const parts = line.trim().split(/\s+/);
        if (parts[1] === "00000000" && parts[2]) {
          const hex = parts[2];
          const b1 = parseInt(hex.substring(6, 8), 16);
          const b2 = parseInt(hex.substring(4, 6), 16);
          const b3 = parseInt(hex.substring(2, 4), 16);
          const b4 = parseInt(hex.substring(0, 2), 16);
          candidates.push(`http://${b1}.${b2}.${b3}.${b4}:51821`);
        }
      }
    }
  } catch {}

  // Gateways conhecidos de Docker / Coolify / Localhost
  candidates.push(
    "http://172.16.1.1:51821",          // Rede 'coolify' padrão
    "http://172.17.0.1:51821",          // docker0 padrão
    "http://127.0.0.1:51821",           // Host local direto
    "http://host.docker.internal:51821" // Host gateway
  );

  for (const c of candidates) {
    try {
      const res = await fetch(`${c}/health`, {
        headers: { "X-WG-Secret": WG_MANAGER_SECRET },
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        discoveredManagerUrl = c;
        return c;
      }
    } catch {}
  }

  return candidates[0] || "http://172.16.1.1:51821";
}

async function wgFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ ok: boolean; data: any; status: number }> {
  const baseUrl = await getManagerUrl();
  const url = `${baseUrl}${path}`;
  try {
    const res = await fetch(url, {
      method:  options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        "X-WG-Secret":  WG_MANAGER_SECRET,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      // Timeout curto — operações locais devem ser rápidas
      signal: AbortSignal.timeout(5_000),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data, status: res.status };
  } catch (err: any) {
    // Daemon não disponível (ex: ambiente de dev local sem VPS)
    return { ok: false, data: { error: err.message }, status: 0 };
  }
}

/** Verifica se o daemon WireGuard Manager está acessível */
export async function isWireGuardAvailable(): Promise<boolean> {
  const res = await wgFetch("/health");
  return res.ok;
}

// ─── Serviço ─────────────────────────────────────────────────────────────────

export class WireGuardService {
  /**
   * Gera um par de chaves WireGuard Curve25519 (X25519) de forma nativa.
   * Não depende de binário externo nem de rede, executando 100% no Node.js.
   */
  async generateKeyPair(): Promise<WireGuardKeyPair> {
    try {
      const crypto = await import("crypto");
      const { privateKey, publicKey } = crypto.generateKeyPairSync("x25519");
      const privDer = privateKey.export({ type: "pkcs8", format: "der" });
      const rawPriv = privDer.subarray(privDer.length - 32);
      const pubDer = publicKey.export({ type: "spki", format: "der" });
      const rawPub = pubDer.subarray(pubDer.length - 32);

      return {
        privateKey: rawPriv.toString("base64"),
        publicKey:  rawPub.toString("base64"),
      };
    } catch (err: any) {
      console.error("[WireGuard] Erro ao gerar chaves x25519:", err);
      throw new Error(`Falha ao gerar chaves criptográficas: ${err.message}`);
    }
  }

  /**
   * Aloca o próximo IP disponível na subnet 10.8.0.0/24.
   * Reserva .1 para o servidor VPS. Verifica tanto roteadores quanto peers (Windows/Mobile).
   */
  async allocateVpnIp(): Promise<string> {
    await ensureVpnColumns();
    const [usedRouters, usedPeers] = await Promise.all([
      prisma.router.findMany({
        where: { vpnIp: { not: null } },
        select: { vpnIp: true },
      }),
      prisma.vpnPeer.findMany({
        select: { vpnIp: true },
      }),
    ]);

    const usedOctets = new Set<number>();
    usedOctets.add(VPN_SERVER_OCTET); // .1 = servidor

    for (const r of usedRouters) {
      const octet = r.vpnIp?.split(".")[3];
      if (octet) usedOctets.add(Number(octet));
    }
    for (const p of usedPeers) {
      const octet = p.vpnIp?.split(".")[3];
      if (octet) usedOctets.add(Number(octet));
    }

    for (let i = 2; i <= 254; i++) {
      if (!usedOctets.has(i)) return `${VPN_SUBNET_BASE}.${i}`;
    }

    throw new Error("Subnet VPN esgotada — máximo de 253 clientes/roteadores atingido.");
  }

  /**
   * Gera o arquivo de configuração (.conf) padrão do WireGuard para clientes (Windows, Celular, etc.)
   * Utiliza split-tunneling (AllowedIPs = 10.8.0.0/24) para isolamento seguro do tráfego de controle.
   */
  generateClientConfig(params: {
    name?: string;
    privateKey: string;
    vpnIp: string;
    vpsPublicKey: string;
    vpsIp: string;
    vpsPort?: number;
    dns?: string;
  }): string {
    const {
      name = "MikroGestor VPN",
      privateKey,
      vpnIp,
      vpsPublicKey,
      vpsIp,
      vpsPort = 51820,
      dns = "1.1.1.1, 8.8.8.8",
    } = params;

    return `# ============================================================
# MikroGestor VPN — Configuração de Acesso Remoto
# Dispositivo : ${name}
# IP Cliente  : ${vpnIp}
# ============================================================

[Interface]
PrivateKey = ${privateKey}
Address = ${vpnIp}/24
DNS = ${dns}

[Peer]
PublicKey = ${vpsPublicKey}
Endpoint = ${vpsIp}:${vpsPort}
AllowedIPs = 10.8.0.0/24
PersistentKeepalive = 25
`;
  }

  /**
   * Adiciona um peer ao WireGuard server via daemon.
   * Se o daemon ainda não estiver ativo na VPS, registra no banco e avisa sem bloquear o script.
   */
  async addPeer(publicKey: string, vpnIp: string): Promise<void> {
    const res = await wgFetch("/peer/add", {
      method: "POST",
      body: { publicKey, vpnIp },
    });
    if (!res.ok) {
      console.warn(`[WireGuard] Daemon do kernel não respondeu em /peer/add: ${res.data?.error}. O peer está salvo no banco e o script foi gerado.`);
    }
  }

  /**
   * Remove um peer do WireGuard server via daemon.
   */
  async removePeer(publicKey: string): Promise<void> {
    const res = await wgFetch("/peer/remove", {
      method: "POST",
      body: { publicKey },
    });
    if (!res.ok) {
      console.warn(`[WireGuard] Remoção do peer falhou (não crítico): ${res.data?.error}`);
    }
  }

  /**
   * Retorna o status atual de todos os peers via daemon.
   */
  async getPeersStatus(): Promise<Record<string, WireGuardPeerStatus>> {
    const res = await wgFetch("/status");
    if (!res.ok) return {};

    const peers: Record<string, WireGuardPeerStatus> = {};
    const now = Date.now();

    for (const p of res.data.peers ?? []) {
      const lastHandshake = p.lastHandshake > 0
        ? new Date(p.lastHandshake * 1000)
        : null;
      const ageMs = lastHandshake ? now - lastHandshake.getTime() : Infinity;

      peers[p.publicKey] = {
        publicKey:    p.publicKey,
        endpoint:     p.endpoint,
        allowedIps:   p.allowedIps,
        lastHandshake,
        connected:    ageMs < CONNECTED_MS,
        transferRx:   p.transferRx,
        transferTx:   p.transferTx,
      };
    }

    return peers;
  }

  /**
   * Verifica o status de um peer específico pelo IP VPN.
   */
  async getPeerStatusByIp(vpnIp: string): Promise<WireGuardPeerStatus | null> {
    const all = await this.getPeersStatus();
    return Object.values(all).find(p => p.allowedIps.startsWith(`${vpnIp}/`)) ?? null;
  }

  /**
   * Adiciona configuração dinâmica de proxy reverso no Traefik (Coolify)
   * para apontar o subdomínio HTTPS diretamente para a porta 80 do MikroTik via VPN.
   */
  async addSubdomainProxy(subdomain: string, vpnIp: string, slug: string): Promise<{ ok: boolean; error?: string }> {
    const res = await wgFetch("/traefik/subdomain/add", {
      method: "POST",
      body: { subdomain, vpnIp, slug },
    });
    if (!res.ok) {
      console.warn(`[WireGuard] Falha ao registrar proxy no Traefik: ${res.data?.error}`);
      return { ok: false, error: res.data?.error };
    }
    return { ok: true };
  }

  /**
   * Remove configuração de proxy reverso do Traefik ao deletar ou desvincular o roteador.
   */
  async removeSubdomainProxy(slug: string): Promise<{ ok: boolean; error?: string }> {
    const res = await wgFetch("/traefik/subdomain/remove", {
      method: "POST",
      body: { slug },
    });
    return { ok: res.ok, error: res.data?.error };
  }

  /**
   * Extrai o certificado Let's Encrypt gerado pelo Traefik em /data/coolify/proxy/acme.json
   */
  async getDomainCert(subdomain: string): Promise<{ ok: boolean; certificate?: string; privateKey?: string; error?: string }> {
    const res = await wgFetch(`/cert/extract?domain=${encodeURIComponent(subdomain)}`);
    if (!res.ok) {
      return { ok: false, error: res.data?.error || "Certificado não encontrado no acme.json" };
    }
    return {
      ok: true,
      certificate: res.data.certificate,
      privateKey: res.data.privateKey,
    };
  }

  /**
   * Gera o script RouterOS (.rsc) para configurar o WireGuard no MikroTik.
   * O script é idempotente — pode ser executado múltiplas vezes sem duplicar.
   * Em conformidade com as regras do RouterOS v7 e mikrotik-script-specialist:
   * comandos em linha única sem barras invertidas (\) para evitar syntax error no Winbox.
   */
  generateRouterOSScript(params: RouterOSScriptParams): string {
    const {
      routerName,
      vpnIp,
      mikrotikPrivKey,
      vpsPublicKey,
      vpsIp,
      vpsPort = 51820,
      subdomain,
      routerId,
      slug,
      user = "admin",
    } = params;

    if (!vpsPublicKey || vpsPublicKey.trim() === "") {
      throw new Error(
        "A chave pública da VPS (VPS_WG_PUBLIC_KEY) não está configurada. Configure a chave nas variáveis de ambiente antes de gerar o script."
      );
    }

    const certHost = process.env.PORTAL_PUBLIC_DOMAIN 
      ? (process.env.PORTAL_PUBLIC_DOMAIN.startsWith("www.") ? process.env.PORTAL_PUBLIC_DOMAIN : `www.${process.env.PORTAL_PUBLIC_DOMAIN}`)
      : "www.mikrogestor.com";

    const certSlug = slug || 'cert';
    const certName = `mg-ssl-${certSlug}`;

    // ─────────────────────────────────────────────────────────────────────────
    // Script RouterOS v7 inline — REGRA: linha única, sem barra invertida (\)
    // O `source=` do /system script add deve ser uma string sem quebras reais.
    //
    // Lógica:
    // 1. Remove TODOS os certs com nome~"certName" (inclui _0, _1 do RouterOS)
    // 2. Baixa cert + key e importa com mesmo nome → RouterOS faz merge (KLT)
    // 3. Seleciona APENAS o que tem private-key=yes (flag K = KLT) → sem ambiguidade
    // 4. Aplica em www-ssl e hsprof_hotspot
    // ─────────────────────────────────────────────────────────────────────────
    const syncSource = `:do { :log info "[MikroGestor] Iniciando sync SSL para ${subdomain}..."; :do { /certificate remove [find where name~"${certName}"] } on-error={}; :delay 1s; /tool fetch url="https://${certHost}/api/vpn/router/${routerId}/cert-file?type=cert" dst-path="mg-cert.pem" check-certificate=no; :delay 3s; /certificate import file-name=mg-cert.pem passphrase="" name="${certName}"; :delay 2s; /tool fetch url="https://${certHost}/api/vpn/router/${routerId}/cert-file?type=key" dst-path="mg-key.pem" check-certificate=no; :delay 3s; /certificate import file-name=mg-key.pem passphrase="" name="${certName}"; :delay 2s; :do { /file remove [find name="mg-cert.pem"] } on-error={}; :do { /file remove [find name="mg-key.pem"] } on-error={}; /certificate set [find where name~"${certName}"] trusted=yes; /ip service set www-ssl certificate=[/certificate get [find where name~"${certName}" and private-key=yes] name] disabled=no port=443; /ip hotspot profile set [find name=hsprof_hotspot] ssl-certificate=[/certificate get [find where name~"${certName}" and private-key=yes] name] dns-name="${subdomain}" login-by=http-chap,https,http-pap,trial; :log info "[MikroGestor] SSL ativo com sucesso para ${subdomain}"; } on-error={ :log warning "[MikroGestor] Falha SSL sync para ${subdomain}"; }`;

    const sslBlock = subdomain && routerId
      ? `
# --- 6. CERTIFICADO SSL E AUTO-RENOVACAO (SUBDOMINIO ${subdomain}) ---
# Limpa agendadores e script anterior
:do { /system scheduler remove [find name=mg-renew-ssl] } on-error={}
:do { /system scheduler remove [find name=mg-ssl-init] } on-error={}
:do { /system script remove [find name=mg-sync-ssl] } on-error={}

# Registra script de sincronizacao SSL (com selecao KLT automatica)
/system script add name=mg-sync-ssl policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon comment="MikroGestor: SSL auto-sync ${subdomain}" source="${syncSource.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"

# Agendador de renovacao automatica a cada 15 dias (LE expira em 90d)
/system scheduler add name=mg-renew-ssl interval=15d start-time=startup policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon on-event=mg-sync-ssl comment="MikroGestor: Renovacao SSL a cada 15d"

# Disparo inicial: executa o sync 30s apos instalar o script (se aguardando)
/system scheduler add name=mg-ssl-init interval=0s start-time=(/system clock get time + 30s) policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon on-event=":do { /system script run mg-sync-ssl; /system scheduler remove [find name=mg-ssl-init]; } on-error={}" comment="MikroGestor: Disparo inicial SSL"
`
      : "";

    return `# ============================================================
# MikroGestor VPN — Configuração WireGuard (RouterOS v7)
# Roteador : ${routerName}
# IP VPN   : ${vpnIp}
${subdomain ? `# Subdomínio: ${subdomain}\n` : ""}# Gerado em: ${new Date().toISOString()}
# ============================================================
# INSTRUÇÕES:
#   1. Abra o Terminal no Winbox ou acesse via SSH
#   2. Cole este script completo e pressione Enter
#   3. O roteador se conectará automaticamente ao MikroGestor
# ============================================================

# --- 1. LIMPEZA PREVENTIVA ---
:do { /interface wireguard peers remove [find interface=wg-mikrogestor] } on-error={}
:do { /ip address remove [find interface=wg-mikrogestor] } on-error={}
:do { /ip address remove [find network=10.8.0.0] } on-error={}
:do { /ip route remove [find comment="MikroGestor VPN route"] } on-error={}
:do { /interface wireguard remove [find name=wg-mikrogestor] } on-error={}

# --- 2. INTERFACE E IP ---
/interface wireguard add name=wg-mikrogestor private-key="${mikrotikPrivKey}" listen-port=13231 comment="MikroGestor VPN - NAO MODIFICAR"
/ip address add address=${vpnIp}/24 interface=wg-mikrogestor network=10.8.0.0 comment="MikroGestor VPN IP"

# --- 3. PEER VPS ---
/interface wireguard peers add interface=wg-mikrogestor public-key="${vpsPublicKey}" endpoint-address=${vpsIp} endpoint-port=${vpsPort} allowed-address=10.8.0.0/24 persistent-keepalive=25 comment="MikroGestor VPS"

# --- 4. ROTA DE CONTROLE ---
/ip route add dst-address=10.8.0.0/24 gateway=wg-mikrogestor comment="MikroGestor VPN route"

# --- 5. FIREWALL DE SEGURANÇA E SERVIÇOS ---
/ip service set ftp disabled=no; /ip service set api disabled=no
:local ruleApi [/ip firewall filter find comment="MikroGestor: API access"]
:if ([:len $ruleApi] = 0) do={ /ip firewall filter add chain=input in-interface=wg-mikrogestor src-address=10.8.0.0/24 dst-port=21,80,443,8291,8728,8729 protocol=tcp action=accept place-before=0 comment="MikroGestor: API access" } else={ /ip firewall filter set $ruleApi src-address=10.8.0.0/24 dst-port=21,80,443,8291,8728,8729 }

:local ruleBlock [/ip firewall filter find comment="MikroGestor: block non-VPS via VPN"]
:if ([:len $ruleBlock] = 0) do={ /ip firewall filter add chain=input in-interface=wg-mikrogestor src-address=!10.8.0.0/24 action=drop comment="MikroGestor: block non-VPS via VPN" } else={ /ip firewall filter set $ruleBlock src-address=!10.8.0.0/24 }

:do {
  :local ruleHs [/ip firewall filter find comment="MikroGestor: block hotspot thru VPN"]
  :if ([:len $ruleHs] = 0) do={ /ip firewall filter add chain=forward in-interface=bridge-hotspot out-interface=wg-mikrogestor action=drop comment="MikroGestor: block hotspot thru VPN" }
} on-error={}

# Desativa FastTrack e IPv6 para garantir interceptacao total do Hotspot (evita bypass de Google, WhatsApp, Telegram)
:do { /ip firewall filter disable [find action=fasttrack-connection] } on-error={}
:do { /ipv6 settings set disable-ipv6=yes } on-error={}

# --- 5.1 PERMISSAO FULL PARA O USUARIO DA API ---
:do {
  :local u [/user find where name="${user}"]
  :if ([:len $u] > 0) do={ /user set $u group=full }
} on-error={}

# --- 5. WALLED GARDEN IDEMPOTENTE (ACESSO SISTEMA & GATEWAYS) ---
# NOTA: O subdominio dedicado do roteador NUNCA deve ser adicionado ao Walled Garden IP,
# pois o Hotspot gerencia seu proprio dns-name nativamente. Adiciona-lo causa bypass para WebFig (erro 404).
:do {
  :if ([:len [/ip hotspot walled-garden find where dst-host="*mikrogestor.com*"]] = 0) do={ /ip hotspot walled-garden add action=allow dst-host="*mikrogestor.com*" comment="MikroGestor: Dominio Publico" }
  :if ([:len [/ip hotspot walled-garden ip find where dst-host="mikrogestor.com"]] = 0) do={ /ip hotspot walled-garden ip add action=accept dst-host="mikrogestor.com" comment="MikroGestor: Dominio Publico (HTTPS)" }
  :if ([:len [/ip hotspot walled-garden ip find where dst-host="www.mikrogestor.com"]] = 0) do={ /ip hotspot walled-garden ip add action=accept dst-host="www.mikrogestor.com" comment="MikroGestor: WWW Dominio Publico (HTTPS)" }
  :if ([:len [/ip hotspot walled-garden ip find where dst-address="${vpsIp}"]] = 0) do={ /ip hotspot walled-garden ip add action=accept dst-address="${vpsIp}" comment="MikroGestor: VPS IP Publico (HTTPS)" }
  :if ([:len [/ip hotspot walled-garden ip find where dst-address="10.8.0.1"]] = 0) do={ /ip hotspot walled-garden ip add action=accept dst-address="10.8.0.1" comment="MikroGestor: IP VPN Servidor" }
} on-error={}
${sslBlock}
:log info "MikroGestor VPN: configuracao concluida (${vpnIp})"
:put "============================================================"
:put "Configuracao concluida com sucesso!"
:put "Roteador : ${routerName}"
:put "IP VPN   : ${vpnIp}"
${subdomain ? `:put "Subdominio: https://${subdomain}"\n` : ""}:put "Status   : Conectado a VPS MikroGestor (${vpsIp})"
:put "============================================================"
`;
  }
}

/** Singleton para uso nas API routes */
export const wireguardService = new WireGuardService();