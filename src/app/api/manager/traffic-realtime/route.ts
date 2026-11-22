import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MikrotikAPI } from '@/lib/routeros';
import { checkManagerAuth } from '@/lib/manager-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await checkManagerAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const routerId = searchParams.get('routerId');

    let router = null;
    if (routerId) {
      router = await prisma.router.findUnique({ where: { id: routerId } });
    }
    if (!router) {
      router = await prisma.router.findFirst({ where: { active: true } });
    }

    if (!router) {
      return NextResponse.json({ success: false, message: 'Nenhum roteador encontrado.' }, { status: 404 });
    }

    const mk = new MikrotikAPI();
    const connected = await mk.connect(router.host, router.user, router.password, router.port);
    if (!connected) {
      return NextResponse.json({
        success: true,
        data: {
          online: false,
          interfaces: [],
          message: 'MikroTik offline.',
        },
      });
    }

    let interfaceTraffic: any[] = [];
    try {
      const ifaces = await mk.getInterfaces();
      const activeIfaces = (Array.isArray(ifaces) ? ifaces : []).filter(
        (i: any) => i.running === 'true' && !i.disabled
      );

      // Coleta o tráfego instantâneo das interfaces principais (WAN, Bridge, WLAN)
      for (const iface of activeIfaces.slice(0, 6)) {
        try {
          const traffic = await mk.getTraffic(iface.name);
          const tData = Array.isArray(traffic) && traffic.length > 0 ? traffic[0] : null;
          interfaceTraffic.push({
            name: iface.name,
            type: iface.type,
            macAddress: iface['mac-address'] || null,
            rxBps: parseInt(tData?.['rx-bits-per-second'] || '0', 10),
            txBps: parseInt(tData?.['tx-bits-per-second'] || '0', 10),
            rxPackets: parseInt(tData?.['rx-packets-per-second'] || '0', 10),
            txPackets: parseInt(tData?.['tx-packets-per-second'] || '0', 10),
          });
        } catch {
          interfaceTraffic.push({
            name: iface.name,
            type: iface.type,
            rxBps: 0,
            txBps: 0,
          });
        }
      }
    } finally {
      mk.disconnect();
    }

    // Calcula taxas totais somadas
    const totalRxBps = interfaceTraffic.reduce((acc, curr) => acc + (curr.rxBps || 0), 0);
    const totalTxBps = interfaceTraffic.reduce((acc, curr) => acc + (curr.txBps || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        online: true,
        timestamp: new Date().toISOString(),
        totalRxBps,
        totalTxBps,
        interfaces: interfaceTraffic,
      },
    });
  } catch (error: any) {
    console.error('[Manager API] Erro ao consultar tráfego em tempo real:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Erro ao consultar tráfego do roteador.' },
      { status: 500 }
    );
  }
}
