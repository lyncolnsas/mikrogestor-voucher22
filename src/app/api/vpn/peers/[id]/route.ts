/**
 * /api/vpn/peers/[id]
 * GET: Retorna dados do peer e a configuração (.conf) pronta para QR Code ou download.
 * DELETE: Revoga o peer no WireGuard da VPS e remove do banco de dados.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureVpnColumns } from "@/lib/prisma";
import { wireguardService, isWireGuardAvailable } from "@/services/wireguard";

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
      return NextResponse.json({ error: "Dispositivo VPN não encontrado." }, { status: 404 });
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

    return NextResponse.json({
      success: true,
      peer: {
        id: peer.id,
        name: peer.name,
        deviceType: peer.deviceType,
        vpnIp: peer.vpnIp,
        publicKey: peer.publicKey,
        fullTunnel: !!(peer as any).fullTunnel,
        status: peer.status,
        createdAt: peer.createdAt,
      },
      clientConfig,
      vpsIp,
    });
  } catch (err: any) {
    console.error("[API /api/vpn/peers/[id] GET]", err);
    return NextResponse.json(
      { error: err?.message || "Erro ao obter detalhes do peer VPN" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureVpnColumns();
    const { id } = await params;
    const body = await req.json();

    const peer = await prisma.vpnPeer.findUnique({
      where: { id },
    });

    if (!peer) {
      return NextResponse.json({ error: "Dispositivo VPN não encontrado." }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (typeof body.fullTunnel === "boolean") {
      dataToUpdate.fullTunnel = body.fullTunnel;
    }
    if (typeof body.name === "string" && body.name.trim()) {
      dataToUpdate.name = body.name.trim();
    }

    const updatedPeer = await prisma.vpnPeer.update({
      where: { id },
      data: dataToUpdate,
    });

    const vpsPublicKey = process.env.VPS_WG_PUBLIC_KEY ?? "CONFIGURE_VPS_WG_PUBLIC_KEY_NO_ENV";
    const vpsIp = process.env.VPS_PUBLIC_IP ?? "2.25.168.82";

    const clientConfig = wireguardService.generateClientConfig({
      name: updatedPeer.name,
      privateKey: updatedPeer.privateKey,
      vpnIp: updatedPeer.vpnIp,
      vpsPublicKey,
      vpsIp,
      vpsPort: 51820,
      fullTunnel: (updatedPeer as any).fullTunnel,
    });

    return NextResponse.json({
      success: true,
      peer: {
        id: updatedPeer.id,
        name: updatedPeer.name,
        deviceType: updatedPeer.deviceType,
        vpnIp: updatedPeer.vpnIp,
        publicKey: updatedPeer.publicKey,
        fullTunnel: !!(updatedPeer as any).fullTunnel,
        status: updatedPeer.status,
        createdAt: updatedPeer.createdAt,
      },
      clientConfig,
      vpsIp,
    });
  } catch (err: any) {
    console.error("[API /api/vpn/peers/[id] PATCH]", err);
    return NextResponse.json(
      { error: err?.message || "Erro ao atualizar dispositivo VPN" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
      return NextResponse.json({ error: "Dispositivo VPN não encontrado." }, { status: 404 });
    }

    // Remove do daemon WireGuard na VPS
    const wgAvailable = await isWireGuardAvailable();
    if (wgAvailable && peer.publicKey) {
      await wireguardService.removePeer(peer.publicKey).catch((e) => {
        console.warn("[VPN] Erro ao remover peer do daemon:", e);
      });
    }

    // Remove do banco
    await prisma.vpnPeer.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Acesso VPN de '${peer.name}' revogado com sucesso.`,
    });
  } catch (err: any) {
    console.error("[API /api/vpn/peers/[id] DELETE]", err);
    return NextResponse.json(
      { error: err?.message || "Erro ao revogar peer VPN" },
      { status: 500 }
    );
  }
}
