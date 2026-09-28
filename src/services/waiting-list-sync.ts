import { prisma } from '@/lib/prisma';
import { getMikrotikClient } from '@/lib/session';
import { whatsappService } from '@/services/whatsapp';
import { spinText } from '@/utils/spintax';

export class WaitingListService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isChecking = false;

  public startAutoCheck(intervalMs = 30 * 1000) {
    if (this.syncInterval) return;
    this.syncInterval = setInterval(() => {
      this.checkWaitingList().catch((err) => {
        console.error('[WaitingList] Check error:', err);
      });
    }, intervalMs);
  }

  public async checkWaitingList(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      // 1. Check if we have capacity configured
      const configMaxUsers = await prisma.systemConfig.findUnique({ where: { key: 'MAX_HOTSPOT_USERS' } });
      const maxUsersLimit = parseInt(configMaxUsers?.value || '0', 10);

      if (maxUsersLimit === 0) return; // No limit configured

      // 2. Query current active users from MikroTik
      let currentUsers = 0;
      let mk;
      try {
        mk = await getMikrotikClient();
        const activeUsers = await mk.getHotspotActive();
        currentUsers = activeUsers.length;
        mk.disconnect();
      } catch (err) {
        console.error('[WaitingList] Error getting active users from Mikrotik', err);
        return;
      }

      // 3. Check if there are available slots
      const availableSlots = maxUsersLimit - currentUsers;
      if (availableSlots <= 0) {
        return; // Full capacity, nobody to notify
      }

      // 4. Fetch pending users according to available slots (up to 5 per cycle)
      const usersToNotify = await prisma.waitingList.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: Math.min(availableSlots, 5),
      });

      if (usersToNotify.length === 0) {
        return; // No one in queue
      }

      const networkName = process.env.HOTSPOT_NETWORK_NAME || 'nossa rede Wi-Fi';

      for (const nextUser of usersToNotify) {
        try {
          await whatsappService.sendWhatsAppTemplate(
            'admin',
            nextUser.whatsapp,
            'liberacao_wifi',
            'pt_BR',
            [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: 'Cliente' },       // {{cliente}}
                  { type: 'text', text: networkName }      // {{nome_produto}}
                ]
              }
            ]
          );
        } catch (waErr) {
          console.error(`[WaitingList] Error sending WA notification to ${nextUser.whatsapp}`, waErr);
        }

        // Update status to notified
        await prisma.waitingList.update({
          where: { id: nextUser.id },
          data: { 
            status: 'notified',
            notifiedAt: new Date()
          }
        });

        console.log(`[WaitingList] Notified user ${nextUser.whatsapp} (Current Active: ${currentUsers}/${maxUsersLimit})`);

        if (usersToNotify.length > 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } catch (e) {
      console.error('[WaitingList] Critical error:', e);
    } finally {
      this.isChecking = false;
    }
  }
}

const globalForWaitingList = globalThis as unknown as {
  waitingListService: WaitingListService | undefined;
};

export const waitingListService: WaitingListService =
  globalForWaitingList.waitingListService || new WaitingListService();

if (process.env.NODE_ENV !== 'production') {
  globalForWaitingList.waitingListService = waitingListService;
}
