/**
 * POST /api/vpn/router/generate
 * Gera chaves WireGuard + aloca IP VPN + adiciona peer no servidor + persiste no banco.
 * Body: { routerId?: string, routerName?: string, user?: string, password?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureVpnColumns } from "@/lib/prisma";
import { wireguardService, isWireGuardAvailable } from "@/services/wireguard";
import { generateUniqueSubdomain } from "@/lib/subdomain";

export async function POST(req: NextRequest) {
  try {
    await ensureVpnColumns();
    const body = await req.json();
    const { routerId, routerName, user = "admin", password = "" } = body;

    let targetRouter: any = null;

    if (routerId) {
      targetRouter = await prisma.router.findUnique({ where: { id: routerId } });
      if (!targetRouter) {
        return NextResponse.json({ error: "Roteador não encontrado." }, { status: 404 });
      }
      if (targetRouter.vpnEnabled && targetRouter.vpnIp) {
        return NextResponse.json(
          { error: "VPN já configurada para este roteador. Revogue antes de reconfigurar." },
          { status: 409 }
        );
      }
    } else if (routerName && routerName.trim()) {
      // Cria um novo roteador diretamente com IP provisório que será a VPN
      const vpnIpTemp = await wireguardService.allocateVpnIp();
      targetRouter = await prisma.router.create({
        data: {
          name: routerName.trim(),
          host: vpnIpTemp,
          user: user.trim() || "admin",
          password: password || "",
          active: true,
          vpnEnabled: false,
        },
      });
    } else {
      return NextResponse.json(
        { error: "Informe o ID do roteador existente ou o nome para cadastrar um novo." },
        { status: 400 }
      );
    }

    const wgAvailable = await isWireGuardAvailable();

    // Gerar chaves via daemon (ou placeholder seguro)
    const keyPair = await wireguardService.generateKeyPair();

    // Alocar IP VPN único (10.8.0.X)
    const vpnIp = await wireguardService.allocateVpnIp();

    // Adicionar peer no WireGuard server
    if (wgAvailable) {
      await wireguardService.addPeer(keyPair.publicKey, vpnIp);
    }

    // 1. Gera subdomínio dedicado único (ex: mkroca.mikrogestor.com)
    const { subdomain, slug } = await generateUniqueSubdomain(targetRouter.name, targetRouter.id);

    // 2. Registra proxy reverso no Traefik na VPS (Coolify)
    if (wgAvailable) {
      await wireguardService.addSubdomainProxy(subdomain, vpnIp, slug);
    }

    // Persistir no banco — host passa a ser o IP VPN (10.8.0.X) e salva o subdomínio
    const updatedRouter = await prisma.router.update({
      where: { id: targetRouter.id },
      data: {
        vpnEnabled:   true,
        vpnIp,
        vpnPublicKey: keyPair.publicKey,
        vpnPrivKey:   keyPair.privateKey,
        vpnStatus:    "pending",
        host:         vpnIp,
        subdomain,
        active:       true,
      },
    });

    // Gerar script RouterOS (.rsc) com automação de SSL
    const script = wireguardService.generateRouterOSScript({
      routerName:     updatedRouter.name,
      vpnIp,
      mikrotikPrivKey: keyPair.privateKey,
      vpsPublicKey:   process.env.VPS_WG_PUBLIC_KEY ?? "CONFIGURE_VPS_WG_PUBLIC_KEY_NO_ENV",
      vpsIp:          process.env.VPS_PUBLIC_IP ?? "2.25.168.82",
      vpsPort:        51820,
      subdomain,
      routerId:       updatedRouter.id,
      slug,
      user:           updatedRouter.user || "admin",
    });

    return NextResponse.json({
      success: true,
      routerId: updatedRouter.id,
      routerName: updatedRouter.name,
      vpnIp,
      subdomain,
      script,
      message: `VPN configurada com sucesso. Subdomínio criado: ${subdomain}. Execute o script no MikroTik para ativar o túnel e o SSL.`,
    });
  } catch (err) {
    console.error("[VPN GENERATE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao gerar configuração VPN" },
      { status: 500 }
    );
  }
}