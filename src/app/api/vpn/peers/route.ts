/**
 * /api/vpn/peers
 * GET: Lista todos os peers de administração (Windows, Celular, etc.) com status em tempo real.
 * POST: Cria um novo peer para dispositivo cliente (gera chaves, aloca IP, cadastra no WireGuard e retorna .conf).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureVpnColumns } from "@/lib/prisma";
import { wireguardService, isWireGuardAvailable } from "@/services/wireguard";

export async function GET() {
  try {
    await ensureVpnColumns();
    const peers = await prisma.vpnPeer.findMany({
      orderBy: { createdAt: "desc" },
    });

    const wgAvailable = await isWireGuardAvailable();
    const daemonPeers = wgAvailable ? await wireguardService.getPeersStatus() : {};

    const enriched = peers.map((p) => {
      const daemonInfo = daemonPeers[p.publicKey] || null;
      const connected = !!daemonInfo?.connected;
      const lastSeen = daemonInfo?.lastHandshake ?? p.lastSeen;

      return {
        id: p.id,
        name: p.name,
        deviceType: p.deviceType,
        vpnIp: p.vpnIp,
        publicKey: p.publicKey,
        fullTunnel: !!(p as any).fullTunnel,
        status: connected ? "connected" : "disconnected",
        lastSeen,
        createdAt: p.createdAt,
        transferRx: daemonInfo?.transferRx ?? 0,
        transferTx: daemonInfo?.transferTx ?? 0,
        endpoint: daemonInfo?.endpoint ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      peers: enriched,
    });
  } catch (err: any) {
    console.error("[API /api/vpn/peers GET]", err);
    return NextResponse.json(
      { error: err?.message || "Erro ao listar peers VPN" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureVpnColumns();
    const body = await req.json();
    const { name, deviceType = "windows", fullTunnel = false } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "O nome do dispositivo é obrigatório (ex: 'Meu Notebook', 'iPhone Suporte')." },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const validDeviceTypes = ["windows", "android", "ios", "macos", "linux"];
    const normalizedDeviceType = validDeviceTypes.includes(deviceType.toLowerCase())
      ? deviceType.toLowerCase()
      : "windows";

    // 1. Gera par de chaves Curve25519 (X25519)
    const keyPair = await wireguardService.generateKeyPair();

    // 2. Aloca próximo IP disponível na subnet 10.8.0.0/24
    const vpnIp = await wireguardService.allocateVpnIp();

    // 3. Cadastra peer no WireGuard da VPS se o daemon estiver ativo
    const wgAvailable = await isWireGuardAvailable();
    if (wgAvailable) {
      await wireguardService.addPeer(keyPair.publicKey, vpnIp);
    }

    // 4. Salva no banco de dados SQLite
    const createdPeer = await prisma.vpnPeer.create({
      data: {
        name: trimmedName,
        deviceType: normalizedDeviceType,
        vpnIp,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        fullTunnel: Boolean(fullTunnel),
        status: "pending",
      },
    });

    // 5. Gera a configuração (.conf) pronta para Windows ou Mobile (QR Code)
    const vpsPublicKey = process.env.VPS_WG_PUBLIC_KEY ?? "CONFIGURE_VPS_WG_PUBLIC_KEY_NO_ENV";
    const vpsIp = process.env.VPS_PUBLIC_IP ?? "2.25.168.82";

    const clientConfig = wireguardService.generateClientConfig({
      name: createdPeer.name,
      privateKey: keyPair.privateKey,
      vpnIp,
      vpsPublicKey,
      vpsIp,
      vpsPort: 51820,
      fullTunnel: (createdPeer as any).fullTunnel,
    });

    return NextResponse.json({
      success: true,
      peer: {
        id: createdPeer.id,
        name: createdPeer.name,
        deviceType: createdPeer.deviceType,
        vpnIp: createdPeer.vpnIp,
        publicKey: createdPeer.publicKey,
        fullTunnel: (createdPeer as any).fullTunnel,
        status: createdPeer.status,
        createdAt: createdPeer.createdAt,
      },
      clientConfig,
      vpsIp,
      vpsPublicKey,
    });
  } catch (err: any) {
    console.error("[API /api/vpn/peers POST]", err);
    return NextResponse.json(
      { error: err?.message || "Erro ao criar peer VPN" },
      { status: 500 }
    );
  }
}
