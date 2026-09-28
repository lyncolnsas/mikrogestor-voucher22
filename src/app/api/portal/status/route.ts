import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMikrotikClient } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const configMaxUsers = await prisma.systemConfig.findUnique({ where: { key: 'MAX_HOTSPOT_USERS' } });
    const maxUsersLimit = parseInt(configMaxUsers?.value || '0', 10);
    
    let limitReached = false;
    let currentUsers = 0;
    
    if (maxUsersLimit > 0) {
      try {
        const mk = await getMikrotikClient();
        const activeUsers = await mk.getHotspotActive();
        currentUsers = activeUsers.length;
        if (currentUsers >= maxUsersLimit) {
          limitReached = true;
        }
        mk.disconnect();
      } catch (err) {
        console.error('[portal/status] Error fetching active users:', err);
      }
    }

    const pendingQueueCount = await prisma.waitingList.count({ where: { status: 'pending' } });

    return NextResponse.json({ 
      success: true, 
      limitReached,
      maxUsersLimit,
      currentUsers,
      pendingQueueCount
    });
  } catch (error: any) {
    console.error('[portal/status] Error:', error);
    return NextResponse.json({ success: false, message: 'Erro ao verificar status do portal.' }, { status: 500 });
  }
}
