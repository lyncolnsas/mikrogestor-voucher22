import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMikrotikClient } from '@/lib/session';
import { getOrSeedDefaultPlans } from '@/lib/plans';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let plans = await prisma.whatsappPlan.findMany({
      where: { active: true, price: { gt: 0 } },
      orderBy: { price: 'asc' },
      select: {
        id: true,
        title: true,
        profile: true,
        price: true,
        uptimeLimit: true,
      },
    });

    if (plans.length === 0) {
      await getOrSeedDefaultPlans();
      plans = await prisma.whatsappPlan.findMany({
        where: { active: true, price: { gt: 0 } },
        orderBy: { price: 'asc' },
        select: {
          id: true,
          title: true,
          profile: true,
          price: true,
          uptimeLimit: true,
        },
      });
    }
    
    const configFreeWifi = await prisma.systemConfig.findUnique({ where: { key: 'free_wifi_mode' } });
    const freeWifiMode = configFreeWifi?.value === 'true';

    const configMaxUsers = await prisma.systemConfig.findUnique({ where: { key: 'MAX_HOTSPOT_USERS' } });
    const maxUsersLimit = parseInt(configMaxUsers?.value || '0', 10);
    
    let limitReached = false;
    
    if (maxUsersLimit > 0) {
      try {
        const mk = await getMikrotikClient();
        const activeUsers = await mk.getHotspotActive();
        if (activeUsers.length >= maxUsersLimit) {
          limitReached = true;
        }
        mk.disconnect();
      } catch (err) {
        console.error('[portal/customer/plans] Error fetching active users:', err);
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: plans, 
      freeWifiMode,
      limitReached,
      maxUsersLimit
    });
  } catch (error: any) {
    console.error('[portal/customer/plans] Error:', error);
    return NextResponse.json({ success: false, message: 'Erro ao buscar planos.' }, { status: 500 });
  }
}
