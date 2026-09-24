import { NextResponse } from 'next/server';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/prisma';
import { getMikrotikClient, getSessionCredentials, getActiveRouterRecord, MikrotikSessionError } from '@/lib/session';
import { MikrotikAPI } from '@/lib/routeros';
import { routerErrorResponse } from '@/lib/api-error';
import { getMaskedPortalUrl, isVpsMode, getPublicDomain } from '@/lib/domain';

// ── Helper: detect admin IP ───────────────────────────────────────────────────
function getAdminIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  const real = req.headers.get('x-real-ip');
  const ip = real || (fwd ? fwd.split(',')[0].trim() : null);
  if (!ip || ip === '::1' || ip === '127.0.0.1') return null;
  return ip;
}

// ── Helper: suggest an unused /24 subnet ─────────────────────────────────────
function suggestSubnet(existingIps: any[]): string {
  const used = new Set<string>();
  existingIps.forEach((ipObj: any) => {
    const parts = (ipObj.address || '').split('/')[0].split('.');
    if (parts.length === 4) used.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
  });
  for (let x = 10; x <= 254; x++) {
    const c = `10.10.${x}`;
    if (!used.has(c)) return `${c}.1`;
  }
  return '10.10.10.1';
}

// ── GET: interfaces for WAN selection & 10-point real-time audit ─────────────
export async function GET() {
  let mk;
  try {
    mk = await getMikrotikClient();
    
    // Fetch all required resources in parallel for minimum latency
    const [
      interfaces,
      ips,
      bridges,
      bridgePorts,
      dhcps,
      dhcpNets,
      pools,
      hsProfiles,
      hotspots,
      natRules,
      firewallRules,
      hotspotDiag,
      isProvisioned,
    ] = await Promise.all([
      mk.getInterfaces().catch(() => []),
      mk.getIpAddresses().catch(() => []),
      mk.getBridges().catch(() => []),
      mk.getBridgePorts().catch(() => []),
      mk.getDhcpServers().catch(() => []),
      mk.getDhcpNetworks().catch(() => []),
      mk.getIpPools().catch(() => []),
      mk.getHotspotServerProfiles().catch(() => []),
      mk.getHotspotServers().catch(() => []),
      mk.getNatRules().catch(() => []),
      mk.getAllFirewallFilterRules().catch(() => []),
      mk.checkHotspot().catch(() => ({ available: true, version: '' })),
      mk.isProvisionedByMikroGestor().catch(() => false),
    ]);

    // 2. Dynamic Target Bridge/Interface Detection
    // Check if there is an active Hotspot, or a bridge named 'bridge', or any bridge, or fallback to 'bridge'
    const activeHotspot = hotspots.find((h: any) => h.interface);
    const targetBridgeName = activeHotspot 
      ? activeHotspot.interface 
      : (bridges.find((b: any) => b.name === 'bridge') || bridges[0] || { name: 'bridge' }).name;

    // 3. Dynamic Gateway IP Detection
    const bridgeIpObj = ips.find((ip: any) => ip.interface === targetBridgeName);
    const detectedFullIp = bridgeIpObj ? bridgeIpObj.address : ''; // e.g., "10.10.10.1/24"
    const gatewayIp = detectedFullIp ? detectedFullIp.split('/')[0] : suggestSubnet(ips);
    const suggestedGateway = gatewayIp;
    const ipParts = gatewayIp.split('.');
    const base = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
    const network = `${base}.0`;
    const networkCidr = `${network}/24`;
    const poolRanges = `${base}.10-${base}.254`;

    // 4. Compute 10-point audit
    const audit = {
      apiProtected: {
        status: 'failed',
        message: 'Regra de liberação da API MikroGestor não encontrada no Firewall.',
      },
      bridgeCreated: {
        status: 'failed',
        message: `Interface bridge '${targetBridgeName}' não encontrada ou desabilitada.`,
      },
      portsMoved: {
        status: 'failed',
        message: `Portas LAN físicas não associadas à bridge '${targetBridgeName}'.`,
      },
      ipConfigured: {
        status: 'failed',
        message: `IP do Gateway (${gatewayIp}) não configurado na bridge '${targetBridgeName}'.`,
      },
      poolCreated: {
        status: 'failed',
        message: `Pool de IPs 'pool_hotspot' (${poolRanges}) não encontrado.`,
      },
      dhcpNetworkCreated: {
        status: 'failed',
        message: `Rede DHCP para a subrede ${networkCidr} não encontrada ou sem DNS correto.`,
      },
      dhcpServerRunning: {
        status: 'failed',
        message: `Servidor DHCP não está rodando na bridge '${targetBridgeName}'.`,
      },
      hotspotProfileCreated: {
        status: 'failed',
        message: "Perfil do Hotspot 'hsprof_hotspot' (hotspot.wifi.local) não encontrado.",
      },
      hotspotServerRunning: {
        status: 'failed',
        message: `Servidor Hotspot 'hs_hotspot' não está ativo na bridge '${targetBridgeName}'.`,
      },
      natEnabled: {
        status: 'failed',
        message: `NAT Masquerade não configurado no roteador.`,
      },
    };

    // Item 1: API protection firewall rule
    // NOTE: Check only by comment — RouterOS may return protocol as '6' (not 'tcp')
    // or dst-port in a different format. The comment is unique and set by us.
    console.log('[Audit] Firewall rules fetched:', JSON.stringify(firewallRules.map((r: any) => ({
      comment: r.comment, chain: r.chain, protocol: r.protocol,
      'dst-port': r['dst-port'], disabled: r.disabled
    }))));
    const apiRule = firewallRules.find((r: any) =>
      r.comment === 'MikroGestor: Accept API Access'
    );
    if (apiRule && apiRule.disabled !== 'true' && apiRule.disabled !== 'yes') {
      audit.apiProtected = {
        status: 'success',
        message: 'Regra de proteção da API está ativa (portas 8728/8729).',
      };
    } else if (apiRule) {
      audit.apiProtected = {
        status: 'failed',
        message: 'Regra de proteção da API existe mas está desabilitada no Firewall.',
      };
    }
    // If apiRule is null/undefined → stays as 'failed' (default set above)

    // Item 2: Bridge Created
    const hBridge = bridges.find((b: any) => b.name === targetBridgeName);
    if (hBridge && hBridge.disabled !== 'true' && hBridge.disabled !== 'yes') {
      audit.bridgeCreated = {
        status: 'success',
        message: `Bridge '${targetBridgeName}' está criada e ativa.`,
      };
    } else if (hBridge) {
      audit.bridgeCreated = {
        status: 'failed',
        message: `Bridge '${targetBridgeName}' está desabilitada no roteador.`,
      };
    }

    // Item 3: Ports Moved
    const bridgeHasPorts = bridgePorts.some((p: any) => p.bridge === targetBridgeName);
    if (bridgeHasPorts) {
      audit.portsMoved = {
        status: 'success',
        message: `Portas LAN associadas à bridge '${targetBridgeName}' com sucesso.`,
      };
    } else {
      audit.portsMoved = {
        status: 'success',
        message: `Portas LAN gerenciadas manualmente (Nenhuma associada à bridge '${targetBridgeName}').`,
      };
    }

    // Item 4: IP Configured
    if (bridgeIpObj && bridgeIpObj.disabled !== 'true' && bridgeIpObj.disabled !== 'yes') {
      audit.ipConfigured = {
        status: 'success',
        message: `Gateway IP ${bridgeIpObj.address} ativo na bridge '${targetBridgeName}'.`,
      };
    } else if (bridgeIpObj) {
      audit.ipConfigured = {
        status: 'failed',
        message: `IP do Gateway ${bridgeIpObj.address} está desativado na bridge '${targetBridgeName}'.`,
      };
    }

    // Item 5: Pool Created
    const targetDhcpOnBridge = dhcps.find((d: any) => d.interface === targetBridgeName);
    const poolNameFromDhcp = targetDhcpOnBridge ? targetDhcpOnBridge['address-pool'] : 'pool_hotspot';
    const hPool = pools.find((p: any) => p.name === poolNameFromDhcp || p.name === 'pool_hotspot');
    if (hPool) {
      audit.poolCreated = {
        status: 'success',
        message: `Pool '${hPool.name}' ativo com a faixa ${hPool.ranges}.`,
      };
    }

    // Item 6: DHCP Network Created
    const hNet = dhcpNets.find((n: any) => {
      const netParts = (n.address || '').split('/')[0].split('.');
      const gwParts = gatewayIp.split('.');
      return netParts.length >= 3 && gwParts.length >= 3 && netParts[0] === gwParts[0] && netParts[1] === gwParts[1] && netParts[2] === gwParts[2];
    });
    if (hNet) {
      audit.dhcpNetworkCreated = {
        status: 'success',
        message: `Rede DHCP ${hNet.address} ativa.`,
      };
    }

    // Item 7: DHCP Server Running
    const hDhcp = dhcps.find((d: any) => d.interface === targetBridgeName);
    if (hDhcp) {
      if (hDhcp.disabled !== 'true' && hDhcp.disabled !== 'yes') {
        audit.dhcpServerRunning = {
          status: 'success',
          message: `Servidor DHCP '${hDhcp.name}' ativo na bridge '${targetBridgeName}'.`,
        };
      } else {
        audit.dhcpServerRunning = {
          status: 'failed',
          message: `Servidor DHCP '${hDhcp.name}' está desativado na bridge '${targetBridgeName}'.`,
        };
      }
    }

    // Item 8 & 9 Check for Hotspot availability
    if (!hotspotDiag || !hotspotDiag.available) {
      const hint = `Pacote 'hotspot' não está ativo no RouterOS (${hotspotDiag?.version || 'v7'}).`;
      audit.hotspotProfileCreated = { status: 'failed', message: hint };
      audit.hotspotServerRunning = { status: 'failed', message: hint };
    } else {
      // Item 8: Hotspot Profile Created
      const hProf = hsProfiles.find((p: any) => p.name === 'hsprof_hotspot');
      if (hProf) {
        audit.hotspotProfileCreated = {
          status: 'success',
          message: `Perfil 'hsprof_hotspot' ativo. DNS: ${hProf['dns-name']}`,
        };
      }

      // Item 9: Hotspot Server Running
      const hHs = hotspots.find((h: any) => h.interface === targetBridgeName);
      if (hHs) {
        if (hHs.disabled !== 'true' && hHs.disabled !== 'yes') {
          audit.hotspotServerRunning = {
            status: 'success',
            message: `Servidor Hotspot '${hHs.name}' ativo na bridge '${targetBridgeName}'.`,
          };
        } else {
          audit.hotspotServerRunning = {
            status: 'failed',
            message: `Servidor Hotspot '${hHs.name}' está desabilitado na bridge '${targetBridgeName}'.`,
          };
        }
      }
    }

    // Item 10: NAT Enabled
    const hNat = natRules.find((r: any) => r.action === 'masquerade');
    if (hNat && hNat.disabled !== 'true' && hNat.disabled !== 'yes') {
      audit.natEnabled = {
        status: 'success',
        message: `NAT Masquerade ativo via interface ${hNat['out-interface'] || 'todas'}.`,
      };
    } else {
      audit.natEnabled = {
        status: 'success',
        message: 'NAT Masquerade gerenciado manualmente pelo usuário.',
      };
    }

    const hasFailures = Object.values(audit).some((item) => item.status === 'failed');

    mk.disconnect();

    const formattedInterfaces = interfaces.map((i: any) => {
      const ipObj = ips.find((ip: any) => ip.interface === i.name);
      return {
        name: i.name,
        type: i.type || 'ether',
        macAddress: i['mac-address'] || 'N/A',
        running: i.running === 'true' || i.running === true,
        disabled: i.disabled === 'true' || i.disabled === true,
        configuredIp: ipObj ? ipObj.address : null,
        hasIp: !!ipObj,
        hasDhcp: dhcps.some((d: any) => d.interface === i.name),
        hasHotspot: hotspots.some((h: any) => h.interface === i.name),
        isBridge: i.type === 'bridge',
        hasNat: natRules.some((r: any) => r['out-interface'] === i.name && r.action === 'masquerade'),
      };
    });

    return NextResponse.json({
      success: true,
      suggestedGateway: suggestedGateway,
      interfaces: formattedInterfaces,
      isProvisioned,
      hasFailures,
      audit,
      detectedWanInterface: targetBridgeName,
      detectedGatewayIp: gatewayIp,
    });
  } catch (error: any) {
    if (mk) mk.disconnect();
    return routerErrorResponse(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: Phased intelligent provisioning
// Reordered for safe building on an empty bridge, followed by ports move & reboot
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const body = await request.json();
  const interfaceName = body.interfaceName || body.wanInterface;
  let gatewayIp = body.gatewayIp;

  if (!interfaceName || !gatewayIp) {
    return NextResponse.json({ success: false, message: 'Interface e gatewayIp são obrigatórios.' }, { status: 400 });
  }

  const ipParts = gatewayIp.split('.');
  if (ipParts.length !== 4) {
    return NextResponse.json({ success: false, message: 'gatewayIp inválido.' }, { status: 400 });
  }

  let base = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
  let network = `${base}.0`;
  let networkCidr = `${network}/24`;
  let poolRanges = `${base}.10-${base}.254`;
  let fullIp = `${gatewayIp}/24`;
  
  let BRIDGE = interfaceName;
  let POOL = 'pool_hotspot';
  let DHCP = 'dhcp_hotspot';
  let HS_PROF = 'hsprof_hotspot';
  let HS = 'hs_hotspot';
  // adminIp is resolved after getMikrotikClient() inside try block
  // (declared with let here so steps below can reference it)

  // ── Step tracker ────────────────────────────────────────────────────────────
  type StepStatus = 'pending' | 'success' | 'failed' | 'skipped' | 'running';
  const steps: { name: string; label: string; status: StepStatus; message: string }[] = [
    { name: 'wan_dhcp',      label: '[ REDE ] WAN: Configurar cliente DHCP',               status: 'pending', message: '' },
    { name: 'bridge_create', label: '[ BRIDGE ] Criar/Verificar Bridge LAN',                  status: 'pending', message: '' },
    { name: 'admin_bypass',  label: '[ ACESSO ] ARP + Bypass do Sistema Administrador',       status: 'pending', message: '' },
    { name: 'set_ip',        label: '[ IP ] Definir IP no Gateway',                       status: 'pending', message: '' },
    { name: 'ip_pool',       label: '[ POOL ] Pool de IPs para Clientes',                   status: 'pending', message: '' },
    { name: 'dhcp_net',      label: '[ REDE ] Rede DHCP',                                   status: 'pending', message: '' },
    { name: 'dhcp_server',   label: '[ CONFIG ] Servidor DHCP',                              status: 'pending', message: '' },
    { name: 'hs_profile',    label: '[ FIREWALL ] Perfil do Servidor Hotspot',                 status: 'pending', message: '' },
    { name: 'hs_server',     label: '[ HOTSPOT ] Servidor Hotspot',                            status: 'pending', message: '' },
    { name: 'user_profile',  label: '[ PERFIL ] Perfil de Usuário Padrão',                   status: 'pending', message: '' },
    { name: 'walled_garden', label: '[ SEGURANÇA ] Walled Garden & SSL Bypass',                status: 'pending', message: '' },
    { name: 'anti_tethering', label: '[ FIREWALL ] Bloqueio contra Compartilhamento (TTL=1)',  status: 'pending', message: '' },
    { name: 'traffic_isolation', label: '[ SEGURANÇA ] Bloqueio IPv6 & FastTrack (Anti-Bypass)', status: 'pending', message: '' },
    { name: 'nat',           label: '[ NAT ] NAT Masquerade via WAN',                      status: 'pending', message: '' },
    { name: 'update_media_urls', label: '[ MÍDIA ] Atualizar IP do Servidor nos Templates', status: 'pending', message: '' },
    { name: 'provision_signature', label: '[ LOG ] Gravar Assinatura MikroGestor',        status: 'pending', message: '' },
    { name: 'bridge_ports',  label: '[ CONEXÃO ] Mover Portas LAN e Reiniciar Roteador',      status: 'pending', message: '' },
  ];

  const ok    = (name: string, msg: string) => { const s = steps.find(x => x.name === name); if (s) { s.status = 'success'; s.message = msg; } };
  const skip  = (name: string, msg: string) => { const s = steps.find(x => x.name === name); if (s) { s.status = 'skipped'; s.message = msg; } };
  const warn  = (name: string, msg: string) => { const s = steps.find(x => x.name === name); if (s) { s.status = 'failed'; s.message = msg; } };
  // fail() throws to stop execution for CRITICAL steps; for hotspot use warn() so other steps continue
  const fail  = (name: string, err: any): never => {
    const msg: string = err?.message || String(err);
    const s = steps.find(x => x.name === name); if (s) { s.status = 'failed'; s.message = msg; }
    throw new Error(msg);
  };

  let mk: MikrotikAPI | null = null;

  try {
    mk = await getMikrotikClient();

    // ── Safe Guard: Always ensure API and Winbox access is never blocked
    await mk.ensureApiAccessNotBlocked().catch((e) => {
      console.warn('API Safety Guard warning:', e);
    });

    // ── Detect admin/system IP and MAC from network interfaces ─────────────────
    let adminIp = '';
    let adminMac = '';
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        if (!iface) continue;
        for (const alias of iface) {
          if (alias.family === 'IPv4' && !alias.internal) {
            if (alias.address.startsWith('192.168.') || alias.address.startsWith('10.')) {
              adminIp = alias.address;
              adminMac = alias.mac;
              break;
            } else if (!adminIp) {
              adminIp = alias.address;
              adminMac = alias.mac;
            }
          }
        }
        if (adminIp && (adminIp.startsWith('192.168.') || adminIp.startsWith('10.'))) {
          break;
        }
      }
    } catch (e) {
      console.warn('Failed to detect system IP in provisioning:', e);
    }

    if (!adminIp) {
      // Fallback: request headers
      let headerIp = getAdminIp(request);
      if (headerIp) {
        adminIp = headerIp;
      } else {
        const hostHeader = request.headers.get('host') || '';
        const hostIp = hostHeader.split(':')[0];
        if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(hostIp)) {
          adminIp = hostIp;
        }
      }
    }

    // Passo 1: WAN DHCP client (Bypass - gerenciado manualmente pelo usuário)
    try {
      skip('wan_dhcp', 'WAN e DHCP Client da internet gerenciados manualmente.');
    } catch (e) { fail('wan_dhcp', e); }

    // Passo 2: Verificar se a bridge/interface existe e está ativa
    try {
      const bridges = await mk.getBridges();
      const existingBridge = bridges.find((b: any) => b.name === BRIDGE);
      if (existingBridge) {
        if (existingBridge.disabled === 'true' || existingBridge.disabled === 'yes') {
          await (mk as any).client?.menu('/interface/bridge').where('.id', existingBridge.id).update({ disabled: 'no' });
          ok('bridge_create', `Bridge "${BRIDGE}" reativada com sucesso.`);
        } else {
          ok('bridge_create', `Bridge "${BRIDGE}" já ativa.`);
        }
      } else {
        const allIfaces = await mk.getInterfaces();
        const ifaceExists = allIfaces.some((i: any) => i.name === BRIDGE);
        if (ifaceExists) {
          ok('bridge_create', `Interface "${BRIDGE}" ativa.`);
        } else {
          fail('bridge_create', new Error(`Interface/Bridge "${BRIDGE}" não encontrada no roteador. Por favor, crie-a manualmente.`));
        }
      }
    } catch (e) { fail('bridge_create', e); }

    // Passo de Whitelist: ARP + Admin Bypass (IP Binding) + Walled Garden no Hotspot
    // Executado IMEDIATAMENTE após a bridge ser confirmada para que o Node.js não perca a conexão.
    // MODO LOCAL: usa IP LAN como referência; MODO VPS: usa domínio público no Walled Garden.
    const deployMode = isVpsMode() ? 'vps' : 'local';
    const publicDomain = getPublicDomain() || '';
    const activeRouter = await getActiveRouterRecord();
    const routerSubdomain = activeRouter?.subdomain;
    const hsDnsName = routerSubdomain
      ? routerSubdomain
      : (deployMode === 'vps' ? 'hotspot.wifi' : 'hotspot.wifi.local');
    try {
      if (adminIp || deployMode === 'vps') {
        const arRes = await mk.ensureAdminArpAndBypass(
          adminIp || '0.0.0.0',
          BRIDGE,
          adminMac,
          { mode: deployMode, publicDomain }
        ).catch((e: any) => ({
          arp: `Erro ARP: ${e?.message}`,
          bypass: `Erro bypass: ${e?.message}`,
        }));
        const modeLabel = deployMode === 'vps' ? `VPS (domínio: ${publicDomain || 'NÃO CONFIGURADO'})` : `Local (IP: ${adminIp})`;
        ok('admin_bypass', `Bypass e Walled Garden liberados — Modo ${modeLabel}. ARP: ${arRes.arp} | IP-Binding: ${arRes.bypass}`);
      } else {
        skip('admin_bypass', 'IP do servidor Node.js não detectado e modo não é VPS. Bypass pulado.');
      }
    } catch (e: any) {
      warn('admin_bypass', `Erro ao adicionar bypass (não crítico): ${e.message}`);
    }

    // Passo 3: Definir IP na bridge selecionada
    try {
      const ips = await mk.getIpAddresses().catch(() => []) as any[];
      const existingIpsOnInterface = ips.filter((ip: any) => ip.interface === BRIDGE);
      const exactIpMatch = existingIpsOnInterface.find((ip: any) => ip.address === fullIp);
      
      if (exactIpMatch) {
        if (exactIpMatch.disabled === 'true' || exactIpMatch.disabled === 'yes') {
          await (mk as any).client?.menu('/ip/address').where('.id', exactIpMatch.id).update({ disabled: 'no' });
          ok('set_ip', `IP ${fullIp} reativado na interface "${BRIDGE}".`);
        } else {
          skip('set_ip', `IP ${fullIp} já está ativo na interface "${BRIDGE}".`);
        }
      } else if (existingIpsOnInterface.length > 0) {
        // Se a interface já tem outros IPs, usamos o primeiro como gateway e pulamos!
        const activeIp = existingIpsOnInterface.find((ip: any) => ip.disabled !== 'true' && ip.disabled !== 'yes') || existingIpsOnInterface[0];
        const detectedAddress = activeIp.address; // e.g. "192.168.88.1/24"
        const detectedIp = detectedAddress.split('/')[0];
        const detectedCidr = detectedAddress.split('/')[1] || '24';
        
        gatewayIp = detectedIp;
        fullIp = detectedAddress;
        
        const ipParts = gatewayIp.split('.');
        base = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
        network = `${base}.0`;
        networkCidr = `${network}/${detectedCidr}`;
        poolRanges = `${base}.10-${base}.254`;
        
        skip('set_ip', `Reutilizando IP existente ${detectedAddress} na interface "${BRIDGE}".`);
      } else {
        await mk.addIpAddress(fullIp, network, BRIDGE);
        ok('set_ip', `IP ${fullIp} configurado com sucesso na interface "${BRIDGE}".`);
      }
    } catch (e) { fail('set_ip', e); }

    // Passo 4: IP Pool
    try {
      const dhcps = await mk.getDhcpServers().catch(() => []) as any[];
      const existingDhcpOnInterface = dhcps.find((d: any) => d.interface === BRIDGE);
      
      if (existingDhcpOnInterface && existingDhcpOnInterface['address-pool'] && existingDhcpOnInterface['address-pool'] !== 'none') {
        POOL = existingDhcpOnInterface['address-pool'];
        skip('ip_pool', `Reutilizando Pool "${POOL}" do DHCP Server existente.`);
      } else {
        const pools = await mk.getIpPools().catch(() => []) as any[];
        const existingPool = pools.find((p: any) => p.name === POOL);
        if (existingPool) {
          if (existingPool.ranges !== poolRanges) {
            await (mk as any).client?.menu('/ip/pool').where('.id', existingPool.id).update({ ranges: poolRanges });
            ok('ip_pool', `Pool "${POOL}" atualizado para a faixa ${poolRanges}.`);
          } else {
            skip('ip_pool', `Pool "${POOL}" já existe com a faixa correta.`);
          }
        } else {
          await mk.addIpPool(POOL, poolRanges);
          ok('ip_pool', `Pool "${POOL}" criado com faixa ${poolRanges}.`);
        }
      }
    } catch (e) { fail('ip_pool', e); }

    // Passo 5: DHCP Network
    try {
      const nets = await mk.getDhcpNetworks().catch(() => []) as any[];
      const existingNet = nets.find((n: any) => n.address === networkCidr || n.address === network);
      if (existingNet) {
        const dnsServers = existingNet['dns-server'] || '';
        if (existingNet.gateway !== gatewayIp || !dnsServers.includes(gatewayIp)) {
          await (mk as any).client?.menu('/ip/dhcp-server/network').where('.id', existingNet.id).update({
            gateway: gatewayIp,
            'dns-server': `${gatewayIp},8.8.8.8`
          });
          ok('dhcp_net', `Rede DHCP ${networkCidr} atualizada (Gateway: ${gatewayIp}, DNS: ${gatewayIp},8.8.8.8).`);
        } else {
          skip('dhcp_net', `Rede DHCP ${networkCidr} já configurada corretamente.`);
        }
      } else {
        await mk.addDhcpServerNetwork(networkCidr, gatewayIp, `${gatewayIp},8.8.8.8`);
        ok('dhcp_net', `Rede ${networkCidr} criada. Gateway: ${gatewayIp}. DNS: ${gatewayIp}, 8.8.8.8`);
      }
    } catch (e) { fail('dhcp_net', e); }

    // Passo 6: DHCP Server na bridge
    try {
      const dhcps = await mk.getDhcpServers().catch(() => []) as any[];
      const existingDhcp = dhcps.find((d: any) => d.interface === BRIDGE);
      if (existingDhcp) {
        let needsUpdate = false;
        const updateParams: any = {};
        if (existingDhcp.disabled === 'true' || existingDhcp.disabled === 'yes') {
          updateParams.disabled = 'no';
          needsUpdate = true;
        }
        if (existingDhcp['address-pool'] !== POOL) {
          updateParams['address-pool'] = POOL;
          needsUpdate = true;
        }
        if (existingDhcp['add-arp'] !== 'yes' && existingDhcp['add-arp'] !== true) {
          updateParams['add-arp'] = 'yes';
          needsUpdate = true;
        }
        if (needsUpdate) {
          await (mk as any).client?.menu('/ip/dhcp-server').where('.id', existingDhcp.id).update(updateParams);
          ok('dhcp_server', `Servidor DHCP "${existingDhcp.name}" reativado/atualizado em "${BRIDGE}".`);
        } else {
          skip('dhcp_server', `Servidor DHCP "${existingDhcp.name}" já está ativo em "${BRIDGE}".`);
        }
        DHCP = existingDhcp.name;
      } else {
        await mk.addDhcpServer(DHCP, BRIDGE, POOL);
        ok('dhcp_server', `DHCP "${DHCP}" ativo em "${BRIDGE}".`);
      }
    } catch (e) { fail('dhcp_server', e); }

    // Verificar se o pacote hotspot está ativo antes de continuar passos de hotspot
    const hotspotDiag = await mk.checkHotspot();

    if (!hotspotDiag.available) {
      const hint = hotspotDiag.majorVersion >= 7
        ? `Hotspot não respondeu (RouterOS ${hotspotDiag.version}). Pacote 'hotspot' está integrado no 'routeros' v7. ` +
          `Verifique se a interface bridge está correta e reinicie o roteador. Erro: ${hotspotDiag.probeError}`
        : `Pacote 'hotspot' não instalado (RouterOS ${hotspotDiag.version}). ` +
          `Instale via Winbox → System → Packages. ` +
          (hotspotDiag.installedPackages.length
            ? `Pacotes ativos: ${hotspotDiag.installedPackages.join(', ')}.`
            : 'Não foi possível listar os pacotes instalados.');
      warn('hs_profile', hint);
      warn('hs_server', hint);
      warn('user_profile', hint);
    } else {

      // Passo 7: Perfil de Servidor Hotspot
      // Se o roteador possui subdomínio dedicado configurado (ex: mkroca.mikrogestor.com),
      // utiliza o subdomínio com certificado SSL para eliminar avisos e telas de segurança no Captive Portal!
      const routerSlug = routerSubdomain ? routerSubdomain.split('.')[0] : null;
      const certName = routerSlug ? `mg-ssl-${routerSlug}` : null;

      // Verifica se o certificado SSL já está importado no RouterOS
      // Busca certs com chave privada válida para o subdomínio ou nome base mg-ssl
      let hasSslCert = false;
      let matchedCertName: string | null = null;
      try {
        const certs = ((await (mk as any).client?.menu('/certificate').get()) || []) as any[];
        const found = certs.find((c: any) =>
          (c['private-key'] === 'true' || c['private-key'] === true || c.privateKey === true) &&
          (
            (certName && (c.name === certName || c.name.startsWith(certName))) ||
            (c.name && c.name.startsWith('mg-ssl')) ||
            (routerSubdomain && (c['common-name'] === routerSubdomain || c.commonName === routerSubdomain))
          )
        );
        if (found) {
          hasSslCert = true;
          matchedCertName = found.name;
        }
      } catch {}

      const effectiveCertName = matchedCertName || certName;

      try {
        const profiles = await mk.getHotspotServerProfiles().catch(() => []) as any[];
        const existing = profiles.find((p: any) => p.name === HS_PROF);

        if (!existing) {
          const profileData: any = {
            name: HS_PROF,
            'html-directory': 'hotspot',
            'dns-name': hsDnsName,
            'login-by': 'http-chap,http-pap,trial',
            'use-radius': 'no',
          };
          if (hasSslCert && effectiveCertName) {
            profileData['ssl-certificate'] = effectiveCertName;
          }
          await mk.addHotspotServerProfile(profileData);
          ok('hs_profile', `Perfil "${HS_PROF}" criado. DNS: ${hsDnsName}${hasSslCert ? ` [SSL ATIVO: ${effectiveCertName}]` : ''} (Modo ${deployMode})`);
        } else {
          let needsUpdate = false;
          const updateParams: any = {};
          if (existing['dns-name'] !== hsDnsName) {
            updateParams['dns-name'] = hsDnsName;
            needsUpdate = true;
          }
          const desiredLoginBy = 'http-chap,http-pap,trial';
          if (existing['login-by'] !== desiredLoginBy) {
            updateParams['login-by'] = desiredLoginBy;
            needsUpdate = true;
          }
          if (hasSslCert && effectiveCertName && existing['ssl-certificate'] !== effectiveCertName) {
            updateParams['ssl-certificate'] = effectiveCertName;
            needsUpdate = true;
          }

          if (needsUpdate) {
            const profId = existing['.id'] || existing.id;
            try {
              if ((mk as any).client?.rosApi?.write) {
                const cmdParams = [`=numbers=${profId}`];
                if (updateParams['dns-name']) cmdParams.push(`=dns-name=${updateParams['dns-name']}`);
                if (updateParams['login-by']) cmdParams.push(`=login-by=${updateParams['login-by']}`);
                if (updateParams['ssl-certificate']) cmdParams.push(`=ssl-certificate=${updateParams['ssl-certificate']}`);
                await (mk as any).client.rosApi.write('/ip/hotspot/profile/set', cmdParams);
              } else {
                await (mk as any).client?.menu('/ip/hotspot/profile').set(updateParams, profId);
              }
            } catch (errSet) {
              console.warn('Erro ao atualizar perfil hotspot via API:', errSet);
            }
            ok('hs_profile', `Perfil "${HS_PROF}" atualizado. DNS: ${hsDnsName}${hasSslCert ? ` [SSL ATIVO: ${effectiveCertName}]` : ''} (Modo ${deployMode})`);
          } else {
            skip('hs_profile', `Perfil "${HS_PROF}" já configurado corretamente (DNS: ${existing['dns-name']}).`);
          }
        }

        // Limpeza de outros perfis legados
        const toRemoveProfiles = profiles.filter(
          (p: any) => p.name !== HS_PROF && p.name !== 'default' && p.comment?.startsWith('MikroGestor')
        );
        for (const p of toRemoveProfiles) {
          if (p.id) {
            await (mk as any).client?.menu('/ip/hotspot/profile').remove(p.id).catch(() => null);
          }
        }
      } catch (e: any) {
        warn('hs_profile', e?.message || String(e));
      }

      // Passo 8: Servidor Hotspot na bridge
      try {
        const result = await mk.upsertHotspotServer({
          name: HS,
          interface: BRIDGE,
          'address-pool': POOL,
          profile: HS_PROF,
        });

        const statusMsg: Record<string, string> = {
          created:      `[ OK ] Servidor "${HS}" criado e ativo na interface "${BRIDGE}".`,
          enabled:      `[ RAPIDO ] Servidor "${HS}" encontrado (desabilitado) — habilitado com sucesso.`,
          already_active: `[ OK ] Servidor hotspot em "${BRIDGE}" já está ativo.`,
          updated:      `[ REINICIANDO ] Servidor "${HS}" atualizado e ativo.`,
        };

        // Limpeza de outros servidores hotspot antigos
        const servers = await mk.getHotspotServers().catch(() => []) as any[];
        const toRemoveServers = servers.filter((s: any) => s.name !== HS && s.interface === BRIDGE && s.comment?.startsWith('MikroGestor'));
        for (const s of toRemoveServers) {
          if (s.id) {
            await (mk as any).client?.menu('/ip/hotspot').remove(s.id).catch(() => null);
          }
        }

        ok('hs_server', statusMsg[result.action] || `Servidor ativo (${result.action}).`);
      } catch (e: any) { warn('hs_server', e?.message || String(e)); }

      // Passo 9: Perfil de Usuário Padrão
      try {
        const userProfiles = await mk.getHotspotProfiles().catch(() => []) as any[];
        const existing = userProfiles.find((p: any) => p.name === 'default');
        const onLoginCleanScript = '/ip firewall filter remove [find comment~("Temp WhatsApp.*" . $"mac-address")]; /ip hotspot walled-garden ip remove [find comment~("Temp WhatsApp.*" . $"mac-address")]; /ip hotspot walled-garden remove [find comment~("Temp WhatsApp.*" . $"mac-address")]';

        if (!existing) {
          await mk.addHotspotUserProfile({
            name: 'default',
            rateLimit: '5M/5M',
            sessionTimeout: '1d',
            sharedUsers: '1',
            onLogin: onLoginCleanScript
          });
          ok('user_profile', 'Perfil "default" criado: 5M/5M, 1 dia, 1 dispositivo, auto-limpeza de WhatsApp no login.');
        } else {
          const updateParams: any = {};
          if (existing.disabled === 'true' || existing.disabled === 'yes') updateParams.disabled = 'no';
          if (existing['shared-users'] !== '1') updateParams['shared-users'] = '1';
          if (existing['on-login'] !== onLoginCleanScript) updateParams['on-login'] = onLoginCleanScript;

          if (Object.keys(updateParams).length > 0) {
            await (mk as any).client?.menu('/ip/hotspot/user/profile').where('.id', existing.id).update(updateParams);
            ok('user_profile', 'Perfil "default" atualizado: 1 dispositivo, auto-limpeza de WhatsApp no login.');
          } else {
            skip('user_profile', `Perfil "default" já ativo com auto-limpeza de regras temporárias.`);
          }
        }
      } catch (e: any) { warn('user_profile', e?.message || String(e)); }

      // Passo 9.1: Walled Garden & SSL Bypass para Domínio e Subdomínio (Unificado e Deduplicado)
      try {
        const publicDomain = getPublicDomain();
        await mk.ensureWalledGardenRules({
          mode: deployMode,
          publicDomain: publicDomain || undefined,
          subdomain: routerSubdomain || undefined,
          adminIp,
        });
        ok('walled_garden', `Walled Garden configurado e deduplicado para ${publicDomain || 'VPS'}${routerSubdomain ? ' e ' + routerSubdomain : ''}.`);
      } catch (e: any) {
        warn('walled_garden', `Walled Garden: ${e?.message || e}`);
      }

      // Passo 9.2: Bloqueio contra Compartilhamento (Anti-Tethering Mangle TTL=1)
      try {
        const antiTetherRes = await mk.ensureAntiTetheringRule(BRIDGE);
        ok('anti_tethering', `Anti-Tethering ativo na interface "${BRIDGE}" (Mangle TTL=1: ${antiTetherRes.status}).`);
      } catch (e: any) {
        warn('anti_tethering', `Anti-Tethering: ${e?.message || e}`);
      }

      // Passo 9.3: Bloqueio contra Vazamento IPv6 & FastTrack (Google, WhatsApp, Telegram)
      try {
        const isoRes = await mk.ensureHotspotTrafficIsolation(BRIDGE);
        const details = [];
        if (isoRes.ipv6Disabled) details.push('IPv6 desativado');
        if (isoRes.fasttrackDisabled > 0) details.push(`${isoRes.fasttrackDisabled} regra(s) FastTrack desativada(s)`);
        ok('traffic_isolation', `Isolamento ativo (${details.join(', ') || 'regras já em conformidade'}).`);
      } catch (e: any) {
        warn('traffic_isolation', `Isolamento IPv6/FastTrack: ${e?.message || e}`);
      }
    }

    // Passo 10: NAT Masquerade (Bypass)
    try {
      skip('nat', 'NAT Masquerade e regras de WAN são gerenciados manualmente.');
    } catch (e) { fail('nat', e); }

    // Passo 11: Atualizar URL do Servidor com Mascaramento DNS MikroTik nos Templates
    // MODO LOCAL: usa IP LAN ou portal.wifi.local
    // MODO VPS:   usa https://domínio_público — NUNCA IP interno Docker
    try {
      const reqHost = request.headers.get('host');
      let serverBaseUrl = getMaskedPortalUrl('', reqHost);
      if (deployMode === 'vps' || serverBaseUrl.includes('portal.wifi.local')) {
        serverBaseUrl = getMaskedPortalUrl();
      }
      await prisma.systemConfig.upsert({
        where: { key: 'SYSTEM_URL' },
        update: { value: serverBaseUrl },
        create: { key: 'SYSTEM_URL', value: serverBaseUrl }
      });
      
      const hotspotDir = path.join(process.cwd(), 'hotspot');
      if (fs.existsSync(hotspotDir)) {
        const templates = fs.readdirSync(hotspotDir);
        for (const t of templates) {
          const cfgPath = path.join(hotspotDir, t, 'config.json');
          if (fs.existsSync(cfgPath)) {
            try {
              const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
              cfg.systemUrl = serverBaseUrl;
              fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
            } catch (err) {}
          }

          const loginHtmlPath = path.join(hotspotDir, t, 'login.html');
          if (fs.existsSync(loginHtmlPath)) {
            try {
              let html = fs.readFileSync(loginHtmlPath, 'utf8');
              html = html.replace(/https?:\/\/192\.168\.\d+\.\d+(:\d+)?/gi, serverBaseUrl);
              html = html.replace(/https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?/gi, serverBaseUrl);
              html = html.replace(/https?:\/\/portal\.wifi\.local(:\d+)?/gi, serverBaseUrl);
              fs.writeFileSync(loginHtmlPath, html, 'utf8');
            } catch (err) {}
          }
        }
      }
      ok('update_media_urls', `IP do servidor (${serverBaseUrl}) gravado e aplicado a todas as mídias dos templates.`);
    } catch (e: any) {
      warn('update_media_urls', `Falha ao atualizar IP de mídias: ${e?.message || e}`);
    }

    // Passo 12: Gravar Assinatura
    try {
      await mk.writeProvisioningSignature();
      ok('provision_signature', 'Assinatura MikroGestor gravada com sucesso no MikroTik.');
    } catch (e: any) {
      fail('provision_signature', `Falha ao gravar assinatura: ${e?.message || e}`);
    }

    // Passo 13: Mover Portas LAN e Reiniciar Roteador (Bypass)
    try {
      skip('bridge_ports', 'Bridges e portas físicas gerenciadas de forma manual pelo administrador (Sem Reboot).');
    } catch (e) { fail('bridge_ports', e); }

    mk.disconnect();

    return NextResponse.json({
      success: true,
      adminIp: adminIp || null,
      newIp: gatewayIp,
      hotspotAvailable: hotspotDiag.available,
      hotspotDiag: hotspotDiag.available ? null : {
        version: hotspotDiag.version,
        installedPackages: hotspotDiag.installedPackages,
        probeError: hotspotDiag.probeError,
      },
      summary: {
        wanInterface: interfaceName,
        lanBridge: BRIDGE,
        gatewayIp,
        network: networkCidr,
        poolRanges,
        dnsPortal: hsDnsName,
        hotspotServer: HS,
      },
      steps,
    });

  } catch (error: any) {
    if (mk) {
      try { mk.disconnect(); } catch { /* ignore */ }
    }

    if (error instanceof MikrotikSessionError) return routerErrorResponse(error);

    // Not a session error — return partial progress
    // The connection may have dropped because IP changed or reboot triggered (normal during provisioning)
    const isConnectionDrop =
      error?.message?.includes('ECONNRESET') ||
      error?.message?.includes('ECONNREFUSED') ||
      error?.message?.includes('ETIMEDOUT') ||
      error?.message?.includes('socket') ||
      error?.message?.includes('closed');

    return NextResponse.json({
      success: false,
      connectionDropped: isConnectionDrop || steps.find(s => s.name === 'bridge_ports')?.status === 'success',
      message: error.message,
      newIp: gatewayIp,  // Tell frontend which IP to reconnect to
      steps,
    });
  }
}
