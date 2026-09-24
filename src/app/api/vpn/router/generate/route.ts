/**
 * POST /api/vpn/router/generate
 * Gera chaves WireGuard + aloca IP VPN + adiciona peer no servidor + persiste no banco.
 * Cria/atualiza o usuário e senha dedicados da API MikroTik automaticamente para
 * garantir integração 100% plug & play e segura.
 * Body: { routerId?: string, routerName?: string, user?: string, password?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma, ensureVpnColumns } from "@/lib/prisma";
import { wireguardService, isWireGuardAvailable } from "@/services/wireguard";
import { generateUniqueSubdomain, slugifyRouterName } from "@/lib/subdomain";

function generateSecurePassword(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let pass = "";
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    pass += chars[randomBytes[i] % chars.length];
  }
  return pass;
}

export async function POST(req: NextRequest) {
  try {
    await ensureVpnColumns();
    const body = await req.json();
    const { routerId, routerName, user, password } = body;

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
    } else if (!routerName || !routerName.trim()) {
      return NextResponse.json(
        { error: "Informe o ID do roteador existente ou o nome para cadastrar um novo." },
        { status: 400 }
      );
    }

    const rawName = (routerName || targetRouter?.name || "mikrotik").trim();
    const cleanSlug = slugifyRouterName(rawName);

    // 1. Gera subdomínio dedicado único (ex: fap.mikrogestor.com)
    const { subdomain, slug } = await generateUniqueSubdomain(rawName, targetRouter?.id);

    // 2. Define usuário e senha de API automaticamente ou respeita os informados
    const apiUser = user && user.trim() && user.trim().toLowerCase() !== "admin"
      ? user.trim().replace(/[^a-zA-Z0-9_-]/g, "")
      : (cleanSlug.startsWith("mikrogestor-") ? cleanSlug : `mg-${cleanSlug}`).slice(0, 30);

    const apiPassword = password && password.trim()
      ? password.trim()
      : (targetRouter?.password && targetRouter.password.trim() ? targetRouter.password.trim() : generateSecurePassword(16));

    const wgAvailable = await isWireGuardAvailable();

    // 3. Gera par de chaves WireGuard X25519 nativo
    const keyPair = await wireguardService.generateKeyPair();

    // 4. Aloca IP VPN único (10.8.0.X)
    const vpnIp = await wireguardService.allocateVpnIp();

    // 5. Adiciona peer no WireGuard server da VPS
    if (wgAvailable) {
      await wireguardService.addPeer(keyPair.publicKey, vpnIp);
    }

    // 6. Registra proxy reverso no Traefik na VPS (Coolify)
    if (wgAvailable) {
      await wireguardService.addSubdomainProxy(subdomain, vpnIp, slug);
    }

    // 7. Persiste no banco de dados e ativa o roteador como o roteador principal do sistema
    let updatedRouter: any;
    await prisma.$transaction(async (tx) => {
      // Marca outros roteadores como inativos para este ser o prioritário
      await tx.router.updateMany({ data: { active: false } });

      if (targetRouter) {
        updatedRouter = await tx.router.update({
          where: { id: targetRouter.id },
          data: {
            user: apiUser,
            password: apiPassword,
            vpnEnabled: true,
            vpnIp,
            vpnPublicKey: keyPair.publicKey,
            vpnPrivKey: keyPair.privateKey,
            vpnStatus: "pending",
            host: vpnIp,
            port: targetRouter.port || 8728,
            subdomain,
            active: true,
          },
        });
      } else {
        updatedRouter = await tx.router.create({
          data: {
            name: rawName,
            host: vpnIp,
            user: apiUser,
            password: apiPassword,
            port: 8728,
            active: true,
            vpnEnabled: true,
            vpnIp,
            vpnPublicKey: keyPair.publicKey,
            vpnPrivKey: keyPair.privateKey,
            vpnStatus: "pending",
            subdomain,
          },
        });
      }
    });

    // 8. Gera script RouterOS (.rsc) com criação automática de usuário, API 8728 e automação de SSL
    const script = wireguardService.generateRouterOSScript({
      routerName: updatedRouter.name,
      vpnIp,
      mikrotikPrivKey: keyPair.privateKey,
      vpsPublicKey: process.env.VPS_WG_PUBLIC_KEY ?? "CONFIGURE_VPS_WG_PUBLIC_KEY_NO_ENV",
      vpsIp: process.env.VPS_PUBLIC_IP ?? "2.25.168.82",
      vpsPort: 51820,
      subdomain,
      routerId: updatedRouter.id,
      slug,
      user: apiUser,
      password: apiPassword,
    });

    return NextResponse.json({
      success: true,
      routerId: updatedRouter.id,
      routerName: updatedRouter.name,
      vpnIp,
      subdomain,
      user: apiUser,
      password: apiPassword,
      script,
      message: `VPN e credenciais configuradas com sucesso! O usuário de API '${apiUser}' foi cadastrado no sistema. Ao executar o script no MikroTik, o roteador conectará e autenticará automaticamente.`,
    });
  } catch (err) {
    console.error("[VPN GENERATE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao gerar configuração VPN" },
      { status: 500 }
    );
  }
}