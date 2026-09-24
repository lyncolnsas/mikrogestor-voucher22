/**
 * /api/vpn/router/[id]/verify-connection
 * Verifica em tempo real se o MikroTik executou o script, conectou à VPN e
 * se o usuário de API gerado autentica com sucesso.
 * Se autenticar, ativa o roteador no banco e cria a sessão mikro_session automaticamente.
 */
import { NextRequest, NextResponse } from "next/server";
import net from "net";
import { prisma, ensureVpnColumns } from "@/lib/prisma";
import { MikrotikAPI } from "@/lib/routeros";
import { encryptData } from "@/lib/jwt";
import { isVpsMode } from "@/lib/domain";

function checkTcpPort(host: string, port = 8728, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      done = true;
      socket.destroy();
      resolve(true);
    });

    socket.once("timeout", () => {
      if (!done) {
        done = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.once("error", () => {
      if (!done) {
        done = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureVpnColumns();
    const { id } = await params;

    const router = await prisma.router.findUnique({ where: { id } });
    if (!router) {
      return NextResponse.json({ success: false, message: "Roteador não encontrado." }, { status: 404 });
    }

    const targetIp = router.vpnIp || router.host;
    const targetPort = router.port || 8728;

    // 1. Testa conectividade TCP na porta 8728 através do túnel WireGuard
    const isReachable = await checkTcpPort(targetIp, targetPort, 1500);

    if (!isReachable) {
      return NextResponse.json({
        success: true,
        connected: false,
        authenticated: false,
        pending: true,
        message: `Aguardando conexão WireGuard do MikroTik em ${targetIp}...`,
      });
    }

    // 2. Testa autenticação direta com o usuário e senha gerados
    const mk = new MikrotikAPI();
    const canAuth = await mk.connect(targetIp, router.user, router.password, targetPort);

    if (!canAuth) {
      return NextResponse.json({
        success: true,
        connected: true,
        authenticated: false,
        pending: true,
        message: "Túnel WireGuard conectado! Finalizando aplicação das credenciais de API no MikroTik...",
      });
    }

    // 3. Sucesso! Obtém identidade do MikroTik
    const identityRes = await mk.getIdentity().catch(() => null);
    const identity = identityRes ? identityRes[0]?.name || router.name : router.name;
    mk.disconnect();

    // 4. Marca como roteador ativo no sistema e atualiza status
    await prisma.$transaction(async (tx) => {
      await tx.router.updateMany({
        where: { id: { not: router.id } },
        data: { active: false },
      });
      await tx.router.update({
        where: { id: router.id },
        data: {
          active: true,
          vpnStatus: "connected",
          vpnLastSeen: new Date(),
        },
      });
    });

    // 5. Gera cookie mikro_session para conexão automática no dashboard
    const jweToken = await encryptData({
      ip: targetIp,
      user: router.user,
      pass: router.password,
    });

    const isHttps =
      req.url.startsWith("https://") ||
      req.headers.get("x-forwarded-proto") === "https" ||
      isVpsMode();

    const response = NextResponse.json({
      success: true,
      connected: true,
      authenticated: true,
      identity,
      router: {
        id: router.id,
        name: router.name,
        vpnIp: targetIp,
        subdomain: router.subdomain,
        user: router.user,
        active: true,
      },
      message: `MikroTik '${identity}' conectado e autenticado com sucesso! A integração do sistema foi concluída.`,
    });

    response.cookies.set({
      name: "mikro_session",
      value: jweToken,
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: 8 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("[VERIFY CONNECTION ERROR]", err);
    return NextResponse.json(
      { success: false, message: `Erro ao verificar conexão: ${err.message}` },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return GET(req, context);
}
