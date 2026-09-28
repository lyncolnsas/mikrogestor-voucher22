import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MercadoPagoService } from '@/services/mercadopago';
import { cookies } from 'next/headers';
import { verifyCustomerJwt } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function getLeadId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('portal_session')?.value;
    if (!token) return null;

    const payload = await verifyCustomerJwt(token);
    return payload?.leadId ?? null;
  } catch {
    return null;
  }
}


export async function POST(request: Request) {
  try {
    const leadId = await getLeadId();
    if (!leadId) {
      return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
    }

    const lead = await prisma.hotspotLead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ success: false, message: 'Sessão inválida.' }, { status: 401 });
    }

    const body = await request.json();
    const { planId, forFriend, friendName, qty = 1 } = body;

    const voucherQty = Math.max(1, Math.min(10, parseInt(String(qty), 10)));

    if (!planId) {
      return NextResponse.json({ success: false, message: 'planId é obrigatório.' }, { status: 400 });
    }

    const plan = await prisma.whatsappPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.active) {
      return NextResponse.json({ success: false, message: 'Plano não encontrado ou inativo.' }, { status: 404 });
    }

    const sysConfig = await prisma.systemConfig.findMany();
    const configMap = sysConfig.reduce((acc: Record<string, string>, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    const mpToken = configMap['MERCADOPAGO_TOKEN'] || configMap['mercadopago_token'] || configMap['mercadopago_access_token'] || '';
    const isTestMode = !mpToken || mpToken.startsWith('TEST-') || mpToken === 'test';
    const isFreeWifiMode = configMap['free_wifi_mode'] === 'true';

    // Verificação de Limite de Capacidade (Fila de Espera)
    const maxUsersLimit = parseInt(configMap['MAX_HOTSPOT_USERS'] || '0', 10);
    if (maxUsersLimit > 0) {
      try {
        const { getMikrotikClient } = await import('@/lib/session');
        const mkSession = await getMikrotikClient();
        const activeUsers = await mkSession.getHotspotActive();
        mkSession.disconnect();
        if (activeUsers.length >= maxUsersLimit) {
          return NextResponse.json({
            success: false,
            limitReached: true,
            message: 'Capacidade máxima de conexões atingida. Entre na fila de espera para ser notificado assim que uma vaga for liberada.'
          }, { status: 429 });
        }
      } catch (err) {
        console.warn('[buy-voucher] Erro ao checar capacidade:', err);
      }
    }

    let pixId: string | null = null;
    let pixPayload: string | null = null;
    let pixQrCodeBase64: string | null = null;
    let isManualPix = false;

    if (isFreeWifiMode) {
       // Free mode bypasses PIX creation
       pixId = `FREE_${Date.now()}`;
       pixPayload = 'FREE_WIFI';
    } else if (!isTestMode && mpToken && mpToken.trim()) {
      const mpService = await MercadoPagoService.init(mpToken.trim());
      const payerEmail = lead.email || `${lead.hotspotUser}@wifi.local`;

      const mpResult = await mpService.createPixPayment({
        transaction_amount: plan.price * voucherQty,
        description: `${voucherQty}x Voucher ${plan.title}${forFriend && friendName ? ` para ${friendName}` : ''}`,
        payer: {
          email: payerEmail,
          first_name: lead.name || lead.hotspotUser,
        },
      });

      pixId = String(mpResult.id ?? '');
      pixPayload = mpResult.point_of_interaction?.transaction_data?.qr_code ?? null;
      pixQrCodeBase64 = mpResult.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
    } else {
      // Check for Manual PIX Key fallback — only if key is actually configured
      const { getEffectivePixKey, generatePixPayload } = await import('@/lib/pix');
      const manualPixKey = await getEffectivePixKey();
      if (manualPixKey && manualPixKey.trim()) {
        pixId = `MANUAL_${Date.now()}`;
        pixPayload = generatePixPayload(manualPixKey.trim(), plan.price * voucherQty, 'MIKROGESTOR', 'SAO PAULO');
        pixQrCodeBase64 = null;
        isManualPix = true;
      } else {
        return NextResponse.json({ 
          success: false, 
          message: 'Nenhum meio de pagamento PIX (Mercado Pago ou Chave Manual) configurado no momento. Contate o administrador.' 
        }, { status: 400 });
      }
    }

    const payments = [];
    let firstPaymentId = '';

    for (let i = 0; i < voucherQty; i++) {
      const voucherCode = generateVoucherCode();
      const pId = pixId; // Remove append for multiple quantities to group by pixId

      const payment = await prisma.payment.create({
        data: {
          leadId: lead.id,
          pixId: pId,
          pixPayload,
          pixQrCodeBase64,
          status: isFreeWifiMode ? 'approved' : 'pending',
          amount: isFreeWifiMode ? 0 : plan.price,
          profile: plan.profile,
          uptimeLimit: plan.uptimeLimit,
          voucherCode,
          isVoucher: true,
          giftTo: forFriend && friendName ? friendName : null,
        },
      });
      payments.push(payment);
      if (i === 0) firstPaymentId = payment.id;
    }

    // Auto provision se for GRÁTIS
    if (isFreeWifiMode) {
      const { MikrotikAPI } = await import('@/lib/routeros');
      const activeRouter = await prisma.router.findFirst({ where: { active: true } });
      if (activeRouter) {
        const mk = new MikrotikAPI();
        const connected = await mk.connect(activeRouter.host, activeRouter.user, activeRouter.password, activeRouter.port);
        if (connected) {
           for (const pay of payments) {
              const username = pay.voucherCode || lead.hotspotUser;
              await mk.addHotspotUser({
                name: username,
                password: username, // voucher mode = user/pass are the same code
                profile: plan.profile,
                'limit-uptime': plan.uptimeLimit || 'none',
                comment: `Wi-Fi Gratis (Evento) | Lead: ${lead.hotspotUser}`,
                server: 'all'
              }).catch(() => {});
           }
           mk.disconnect();
        }
      }
    } else if (pixPayload) {
      // Disparo de mensagem PIX via WhatsApp (tanto Mercado Pago quanto PIX Manual)
      const contactPhone = lead.phone || lead.whatsappNumber;
      if (contactPhone) {
        const { whatsappService } = await import('@/services/whatsapp');
        const { getCustomTemplate, applyTemplateTags, getTriggerSendOptions } = await import('@/services/whatsapp-custom-messages');
        const codesStr = payments.map((p, idx) => `🎟️ *Voucher ${idx+1}:*\nUsuário: ${p.voucherCode}\nSenha: ${p.voucherCode}`).join('\n\n');
        const giftLine = forFriend && friendName ? `\n👤 *Para:* ${friendName}` : '';
        const totalValor = `R$ ${(plan.price * voucherQty).toFixed(2).replace('.', ',')}`;

        try {
          const rawPixTemplate = await getCustomTemplate('WA_MSG_PIX_GENERATED');
          const pixSendOpts = await getTriggerSendOptions('WA_MSG_PIX_GENERATED');
          const pixMsg = applyTemplateTags(rawPixTemplate, {
            cliente: lead.name || lead.hotspotUser,
            plano: `${plan.title}${voucherQty > 1 ? ` (${voucherQty}x)` : ''}${giftLine}`,
            valor: totalValor,
            cortesia: '15 minutos',
            pix_copia_cola: pixPayload,
            usuario: payments[0]?.voucherCode || lead.hotspotUser,
            senha: payments[0]?.voucherCode || lead.hotspotUser,
            rede_wifi: process.env.HOTSPOT_WIFI_NAME || 'nossa rede Wi-Fi'
          });

          // 1. Envia mensagem do PIX
          await whatsappService.sendWhatsAppMessage('admin', contactPhone, pixMsg, {
            skipStandby: true,
            media: pixSendOpts.media,
            forwardLibraryId: pixSendOpts.forwardLibraryId
          });

          // 2. Aguarda um intervalo humano de 2.5 a 4 segundos antes de disparar o balão isolado com o Copia e Cola puro
          const copyPasteDelay = Math.floor(Math.random() * (4000 - 2500 + 1)) + 2500;
          await new Promise(r => setTimeout(r, copyPasteDelay));

          await whatsappService.sendWhatsAppMessage('admin', contactPhone, pixPayload, {
            skipStandby: true
          });
        } catch (msgErr) {
          console.error('[BuyVoucher] Erro ao enviar mensagem PIX para o cliente:', msgErr);
        }

        // Notificação para o ADMIN caso seja PIX Manual
        if (isManualPix) {
          (async () => {
            try {
              const adminNumbers = await whatsappService.getOnlineOfficialNumbers();
              if (adminNumbers.length > 0) {
                const adminMsg = `🔔 *Novo Pedido de Voucher PIX Manual!*\n\n👤 *Cliente:* ${lead.name || lead.hotspotUser}\n📱 *WhatsApp:* ${contactPhone}\n🎟️ *Plano:* ${plan.title}${giftLine}\n📦 *Quantidade:* ${voucherQty}x\n💰 *Valor Total:* ${totalValor}\n🆔 *PIX ID:* ${pixId}\n\n🔑 *Chave PIX enviada ao cliente:*\n\`${pixPayload}\`\n\n➡️ Acesse /dashboard/finance para *Aprovar* ou *Rejeitar*.`;
                await whatsappService.sendWhatsAppMessage('admin', adminNumbers[0], adminMsg).catch(() => {});
              }
            } catch (e) { console.warn('[PIX Manual Voucher] Erro ao notificar admin:', e); }
          })();
        }
      }
    }


    return NextResponse.json({
      success: true,
      data: {
        paymentId: firstPaymentId,
        pixId: pixId,
        pixPayload: pixPayload,
        pixQrCodeBase64: pixQrCodeBase64,
        amount: isFreeWifiMode ? 0 : (plan.price * voucherQty),
        isManualPix,
        voucherCode: payments[0]?.voucherCode,
        plan: {
          title: plan.title,
          uptimeLimit: plan.uptimeLimit,
        },
        isTestMode,
        giftTo: friendName,
      },
    });
  } catch (error: any) {
    console.error('[portal/customer/buy-voucher] Error:', error);
    return NextResponse.json({ success: false, message: 'Erro ao criar voucher.' }, { status: 500 });
  }
}
