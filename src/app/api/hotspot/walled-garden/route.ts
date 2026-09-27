import { NextResponse } from 'next/server';
import { getSessionCredentials } from '@/lib/session';
import { MikrotikAPI } from '@/lib/routeros';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const api = new MikrotikAPI();
  try {
    let creds;
    try {
      creds = await getSessionCredentials();
    } catch {
      const activeRouter = await prisma.router.findFirst({ where: { active: true } });
      if (activeRouter) {
        creds = { ip: activeRouter.host, user: activeRouter.user, pass: activeRouter.password };
      }
    }

    if (!creds) {
      return NextResponse.json({ success: false, message: 'Roteador não conectado', entries: [] }, { status: 401 });
    }

    const connected = await api.connect(creds.ip, creds.user, creds.pass);
    if (!connected) {
      return NextResponse.json({ success: false, message: 'Falha ao conectar no MikroTik', entries: [] });
    }

    const rawEntries = await api.getWalledGarden();
    await api.close();

    const entries = (rawEntries || []).filter((e: any) => {
      const host = (e['dst-host'] || e.dstHost || '').toLowerCase();
      const comment = (e.comment || '').toLowerCase();
      return !host.includes('place hotspot rules here') && !comment.includes('place hotspot rules here');
    });

    return NextResponse.json({ success: true, entries });
  } catch (err: any) {
    await api.close().catch(() => {});
    return NextResponse.json({ success: false, message: err?.message || 'Erro', entries: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const api = new MikrotikAPI();
  try {
    const body = await request.json();
    const { dstHost, comment } = body;

    if (!dstHost) {
      return NextResponse.json({ success: false, message: 'dstHost é obrigatório' }, { status: 400 });
    }

    let creds;
    try {
      creds = await getSessionCredentials();
    } catch {
      const activeRouter = await prisma.router.findFirst({ where: { active: true } });
      if (activeRouter) {
        creds = { ip: activeRouter.host, user: activeRouter.user, pass: activeRouter.password };
      }
    }

    if (!creds) {
      return NextResponse.json({ success: false, message: 'Roteador não conectado' }, { status: 401 });
    }

    const connected = await api.connect(creds.ip, creds.user, creds.pass);
    if (!connected) {
      return NextResponse.json({ success: false, message: 'Falha ao conectar no MikroTik' });
    }

    await api.addWalledGarden('allow', dstHost, comment || 'Portal MikroStudio');
    try {
      await api.addWalledGardenIp('accept', dstHost, comment || 'Portal MikroStudio (HTTPS)');
    } catch (e) {}
    await api.close();

    return NextResponse.json({ success: true, message: 'Domínio adicionado ao Walled Garden' });
  } catch (err: any) {
    await api.close().catch(() => {});
    return NextResponse.json({ success: false, message: err?.message || 'Erro' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const api = new MikrotikAPI();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID é obrigatório' }, { status: 400 });
    }

    let creds;
    try {
      creds = await getSessionCredentials();
    } catch {
      const activeRouter = await prisma.router.findFirst({ where: { active: true } });
      if (activeRouter) {
        creds = { ip: activeRouter.host, user: activeRouter.user, pass: activeRouter.password };
      }
    }

    if (!creds) {
      return NextResponse.json({ success: false, message: 'Roteador não conectado' }, { status: 401 });
    }

    const connected = await api.connect(creds.ip, creds.user, creds.pass);
    if (!connected) {
      return NextResponse.json({ success: false, message: 'Falha ao conectar no MikroTik' });
    }

    await api.removeWalledGarden(id);
    await api.close();

    return NextResponse.json({ success: true, message: 'Entrada removida do Walled Garden' });
  } catch (err: any) {
    await api.close().catch(() => {});
    return NextResponse.json({ success: false, message: err?.message || 'Erro' }, { status: 500 });
  }
}
