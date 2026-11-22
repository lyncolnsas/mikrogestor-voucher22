import { prisma } from '@/lib/prisma';
import { MikrotikAPI } from '@/lib/routeros';
import { parseRouterOSTime } from '@/lib/routeros-time';
import { getMaskedPortalDomain } from '@/lib/domain';
import {
  getCustomTemplate,
  applyTemplateTags,
  getTriggerSendOptions,
  getEffectiveWifiName,
  getFlowConfig
} from '@/services/whatsapp-custom-messages';

export class PlanExpirationService {
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  // Guarda timestamp do aviso de 10 minutos por usuário para não duplicar (TTL 60 min)
  private sentWarnings = new Map<string, number>();

  public start(intervalMs = 60000) {
    if (this.intervalTimer) return;
    console.log('[PlanExpirationService] Iniciando monitoramento de expirações e renovações (intervalo: 60s)...');
    
    // Executa a primeira checagem após 10s da subida do servidor
    setTimeout(() => {
      this.checkAll().catch(err => console.error('[PlanExpirationService] Erro inicial:', err));
    }, 10000);

    this.intervalTimer = setInterval(() => {
      this.checkAll().catch(err => console.error('[PlanExpirationService] Erro no loop periódico:', err));
    }, intervalMs);
  }

  public async checkAll(): Promise<{ expiredBlocked: number; warningsSent: number }> {
    if (this.isRunning) return { expiredBlocked: 0, warningsSent: 0 };
    this.isRunning = true;

    let expiredBlocked = 0;
    let warningsSent = 0;

    try {
      // 1. Limpeza de warnings antigos da memória (> 2 horas)
      const now = Date.now();
      for (const [user, timestamp] of this.sentWarnings.entries()) {
        if (now - timestamp > 2 * 60 * 60 * 1000) {
          this.sentWarnings.delete(user);
        }
      }

      // 2. Conectar ao MikroTik ativo
      const activeRouter = await prisma.router.findFirst({ where: { active: true } });
      if (!activeRouter) {
        this.isRunning = false;
        return { expiredBlocked, warningsSent };
      }

      const mk = new MikrotikAPI();
      const connected = await mk.connect(activeRouter.host, activeRouter.user, activeRouter.password, activeRouter.port);
      if (!connected) {
        this.isRunning = false;
        return { expiredBlocked, warningsSent };
      }

      // ──────────────────────────────────────────────────────────────────────────
      // FASE 1: Varredura de Inadimplentes (15 minutos de carência expirada)
      // ──────────────────────────────────────────────────────────────────────────
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const expiredPayments = await prisma.payment.findMany({
        where: {
          status: 'pending',
          isVoucher: false,
          createdAt: { lte: fifteenMinutesAgo }
        },
        include: { lead: true }
      });

      for (const payment of expiredPayments) {
        const lead = payment.lead;
        const username = lead?.hotspotUser;
        let mac = payment.macAddress ? payment.macAddress.trim().toUpperCase() : null;

        try {
          if (username) {
            // Se o MAC não estiver gravado no Payment, busca na sessão ativa do MikroTik antes de expulsar
            if (!mac) {
              try {
                const activeSessions = ((await mk.getHotspotActive()) as any[]) || [];
                const sess = activeSessions.find(s => String(s.user) === String(username));
                if (sess && (sess['mac-address'] || sess['macAddress'])) {
                  mac = String(sess['mac-address'] || sess['macAddress']).trim().toUpperCase();
                  await prisma.payment.update({
                    where: { id: payment.id },
                    data: { macAddress: mac }
                  }).catch(() => null);
                }
              } catch (_) {}
            }

            await mk.removeHotspotActiveByUser(username).catch(() => null);
            await mk.removeHotspotUserByName(username).catch(() => null);
          }

          if (mac) {
            await mk.blockHotspotMac(mac, 'Expirado 15m sem pagamento PIX').catch(() => null);
            await prisma.blockedClient.upsert({
              where: { mac },
              update: { active: true, reason: 'Expirado 15m sem pagamento PIX' },
              create: {
                mac,
                cpf: lead?.cpf || null,
                phone: lead?.phone || lead?.whatsappNumber || null,
                reason: 'Expirado 15m sem pagamento PIX'
              }
            }).catch(() => null);
          }

          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'expired' }
          }).catch(() => null);

          if (lead?.id) {
            await prisma.hotspotLead.update({
              where: { id: lead.id },
              data: { trialBlocked: true }
            }).catch(() => null);
          }

          expiredBlocked++;
          console.log(`[PlanExpirationService] Inadimplente bloqueado: ${username} (MAC: ${mac})`);
        } catch (e) {
          console.warn(`[PlanExpirationService] Erro ao bloquear ${username}:`, e);
        }
      }

      // ──────────────────────────────────────────────────────────────────────────
      // FASE 2: Aviso Prévio de 10 Minutos para Renovação (WhatsApp Baileys)
      // ──────────────────────────────────────────────────────────────────────────
      try {
        const activeSessions = ((await mk.getHotspotActive()) as any[]) || [];
        const flowMap = await getFlowConfig();
        const expirationWarningEnabled = flowMap.plan_expiration_10m?.enabled !== false;

        if (expirationWarningEnabled && activeSessions.length > 0) {
          const portalDomain = getMaskedPortalDomain();
          const wifiName = await getEffectiveWifiName();
          const rawTemplate = await getCustomTemplate('WA_MSG_PLAN_EXPIRATION_10M');
          const sendOpts = await getTriggerSendOptions('WA_MSG_PLAN_EXPIRATION_10M');

          for (const session of activeSessions) {
            const username = session.user || session['user'];
            if (!username || username.startsWith('T-')) continue;

            // Se já enviou aviso de 10m nos últimos 45 minutos para este usuário, pula
            const lastSent = this.sentWarnings.get(username);
            if (lastSent && now - lastSent < 45 * 60 * 1000) {
              continue;
            }

            // session-time-left retornado pelo RouterOS (ex: '00:09:40' ou '9m40s')
            const timeLeftRaw = session['session-time-left'] || session.sessionTimeLeft;
            if (!timeLeftRaw) continue;

            const secondsLeft = parseRouterOSTime(timeLeftRaw);

            // Avisar quando faltar entre 1 minuto e 10 minutos (60 a 600 segundos)
            if (secondsLeft > 60 && secondsLeft <= 600) {
              const lead = await prisma.hotspotLead.findUnique({
                where: { hotspotUser: username },
                include: {
                  payments: {
                    where: { status: 'approved' },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                  }
                }
              });

              const targetPhone = lead?.phone || lead?.whatsappNumber;
              if (targetPhone) {
                const lastApproved = lead?.payments?.[0];
                const planTitle = lastApproved?.profile || 'Plano Hotspot';
                const renewProto = isVpsMode() ? 'https' : 'http';
                const renewLink = `${renewProto}://${portalDomain}/portal/renovar?user=${encodeURIComponent(username)}`;
                const minutesLeftStr = `${Math.ceil(secondsLeft / 60)} minutos`;

                const msgBody = applyTemplateTags(rawTemplate, {
                  cliente: lead?.name || username,
                  plano: planTitle,
                  tempo_restante: minutesLeftStr,
                  link_portal: renewLink,
                  link_renovacao: renewLink,
                  rede_wifi: wifiName,
                });

                const { whatsappService } = await import('@/services/whatsapp');
                whatsappService.sendWhatsAppMessage('admin', targetPhone, msgBody, {
                  skipStandby: true,
                  media: sendOpts.media,
                  forwardLibraryId: sendOpts.forwardLibraryId
                }).catch(err => {
                  console.warn(`[PlanExpirationService] Falha ao enviar aviso 10m para ${username}:`, err);
                });

                this.sentWarnings.set(username, now);
                warningsSent++;
                console.log(`[PlanExpirationService] Aviso de 10m enviado para ${username} (${targetPhone}). Restam: ${minutesLeftStr}`);
              }
            }
          }
        }
      } catch (warnErr) {
        console.warn('[PlanExpirationService] Erro ao varrer sessões para aviso 10m:', warnErr);
      }

      mk.disconnect();
    } catch (err) {
      console.error('[PlanExpirationService] Erro na execução:', err);
    } finally {
      this.isRunning = false;
    }

    return { expiredBlocked, warningsSent };
  }
}

export const planExpirationService = new PlanExpirationService();
