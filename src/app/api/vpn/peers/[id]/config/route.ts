/**
 * GET /api/vpn/peers/[id]/config
 * Retorna o arquivo .conf pronto para download e importação no WireGuard client.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureVpnColumns } from "@/lib/prisma";
import { wireguardService } from "@/services/wireguard";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureVpnColumns();
    const { id } = await params;

    const peer = await prisma.vpnPeer.findUnique({
      where: { id },
    });

    if (!peer) {
      return new NextResponse("Dispositivo VPN não encontrado", { status: 404 });
    }

    const vpsPublicKey = process.env.VPS_WG_PUBLIC_KEY ?? "CONFIGURE_VPS_WG_PUBLIC_KEY_NO_ENV";
    const vpsIp = process.env.VPS_PUBLIC_IP ?? "2.25.168.82";

    const clientConfig = wireguardService.generateClientConfig({
      name: peer.name,
      privateKey: peer.privateKey,
      vpnIp: peer.vpnIp,
      vpsPublicKey,
      vpsIp,
      vpsPort: 51820,
      fullTunnel: (peer as any).fullTunnel,
    });

    const safeFilename = peer.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return new NextResponse(clientConfig, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="mikrogestor-vpn-${safeFilename || "client"}.conf"`,
      },
    });
  } catch (err: any) {
    console.error("[API /api/vpn/peers/[id]/config GET]", err);
    return new NextResponse("Erro ao gerar arquivo de configuração VPN", { status: 500 });
  }
}
