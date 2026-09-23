/**
 * GET /api/vpn/router/[id]/script
 * Retorna o script RouterOS (.rsc) para o roteador especificado.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { wireguardService } from "@/services/wireguard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const router = await prisma.router.findUnique({ where: { id } });
    if (!router) {
      return NextResponse.json({ error: "Roteador nao encontrado" }, { status: 404 });
    }

    if (!router.vpnEnabled || !router.vpnIp || !router.vpnPrivKey) {
      return NextResponse.json(
        { error: "VPN nao configurada para este roteador. Gere a configuracao primeiro." },
        { status: 400 }
      );
    }

    const slug = router.subdomain ? router.subdomain.split(".")[0] : undefined;

    const script = wireguardService.generateRouterOSScript({
      routerName: router.name,
      vpnIp: router.vpnIp,
      mikrotikPrivKey: router.vpnPrivKey,
      vpsPublicKey: process.env.VPS_WG_PUBLIC_KEY ?? "CONFIGURE_VPS_WG_PUBLIC_KEY",
      vpsIp: process.env.VPS_PUBLIC_IP ?? "2.25.168.82",
      vpsPort: 51820,
      subdomain: router.subdomain ?? undefined,
      routerId: router.id,
      slug,
      user: router.user || "admin",
    });

    const filename = ("mikrogestor-vpn-" + router.name.replace(/\s+/g, "-").toLowerCase() + ".rsc");

    return new NextResponse(script, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": ('attachment; filename="' + filename + '"'),
      },
    });
  } catch (err) {
    console.error("[VPN SCRIPT]", err);
    return NextResponse.json({ error: "Erro ao gerar script" }, { status: 500 });
  }
}