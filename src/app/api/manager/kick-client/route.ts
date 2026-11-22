import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MikrotikAPI } from '@/lib/routeros';
import { checkManagerAuth } from '@/lib/manager-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await checkManagerAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { username, mac, routerId } = body;

    if (!username && !mac) {
      return NextResponse.json(
        { success: false, message: 'Informe o nome de usuário ou o MAC do cliente para derrubar a sessão.' },
        { status: 400 }
      );
    }

    let router = null;
    if (routerId) {
      router = await prisma.router.findUnique({ where: { id: routerId } });
    }
    if (!router) {
      router = await prisma.router.findFirst({ where: { active: true } });
    }

    if (!router) {
      return NextResponse.json({ success: false, message: 'Nenhum roteador ativo encontrado.' }, { status: 404 });
    }

    const mk = new MikrotikAPI();
    if (!(await mk.connect(router.host, router.user, router.password, router.port))) {
      return NextResponse.json({ success: false, message: 'Não foi possível conectar ao MikroTik.' }, { status: 502 });
    }

    try {
      if (username) {
        await mk.removeHotspotActiveByUser(username);
      }
      if (mac) {
        await mk.removeHotspotActiveByMac(mac.trim().toUpperCase());
      }
    } finally {
      mk.disconnect();
    }

    return NextResponse.json({
      success: true,
      message: `Sessão do cliente (${username || mac}) encerrada com sucesso no MikroTik.`,
    });
  } catch (error: any) {
    console.error('[Manager API] Erro ao kickar cliente:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Erro ao derrubar sessão do cliente.' },
      { status: 500 }
    );
  }
}
