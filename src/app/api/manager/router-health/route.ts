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
          routerId: router.id,
          routerName: router.name,
          host: router.host,
          online: false,
          message: 'MikroTik offline ou inacessível no momento.',
        },
      });
    }

    let resources: any = {};
    let board: any = {};
    let activeHotspotCount = 0;
    let health: any = {};

    try {
      const resList = await mk.getSystemResources();
      if (Array.isArray(resList) && resList.length > 0) resources = resList[0];

      const boardList = await mk.getRouterboard();
      if (Array.isArray(boardList) && boardList.length > 0) board = boardList[0];

      const activeList = await mk.getHotspotActive();
      activeHotspotCount = Array.isArray(activeList) ? activeList.length : 0;

      // Tenta obter /system/health (temperatura / voltagem)
      try {
        const client = (mk as any).client;
        if (client) {
          const healthData = await client.menu('/system/health').get();
          if (Array.isArray(healthData) && healthData.length > 0) health = healthData[0];
        }
      } catch {
        // Alguns modelos RB de entrada (ex: hEX lite / hAP mini) não possuem sensor de hardware
      }
    } finally {
      mk.disconnect();
    }

    const cpu = parseInt(resources['cpu-load'] || '0', 10);
    const freeMemory = parseInt(resources['free-memory'] || '0', 10);
    const totalMemory = parseInt(resources['total-memory'] || '0', 10);
    const usedMemory = totalMemory - freeMemory;
    const memoryPercent = totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        routerId: router.id,
        routerName: router.name,
        host: router.host,
        online: true,
        model: board.model || resources['board-name'] || 'MikroTik RouterBoard',
        serialNumber: board['serial-number'] || 'N/A',
        version: resources.version || 'RouterOS v7',
        uptime: resources.uptime || 'N/A',
        cpu: {
          loadPercent: cpu,
          frequencyMhz: resources['cpu-frequency'] || 0,
          count: resources['cpu-count'] || 1,
        },
        memory: {
          freeBytes: freeMemory,
          totalBytes: totalMemory,
          usedBytes: usedMemory,
          usedPercent: memoryPercent,
        },
        storage: {
          freeHdd: parseInt(resources['free-hdd-space'] || '0', 10),
          totalHdd: parseInt(resources['total-hdd-space'] || '0', 10),
        },
        health: {
          temperature: health.temperature || null,
          voltage: health.voltage || null,
        },
        activeHotspotCount,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Manager API] Erro ao obter saúde da RB:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Erro ao consultar métricas da RouterBoard.' },
      { status: 500 }
    );
  }
}
