import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/jwt';
import { MikrotikAPI } from '@/lib/routeros';
import { whatsappService } from '@/services/whatsapp';
import { getMaskedPortalDomain } from '@/lib/domain';
import { getEffectiveWifiName } from '@/services/whatsapp-custom-messages';

export async function POST(request: Request) {
  try {
    // 1. Verify admin auth
    const cookieStore = await cookies();
    const token = cookieStore.get('system_auth')?.value;
    
    if (!token) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    }

    const { paymentId, action } = await request.json();

    if (!paymentId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { lead: true }
    });

    if (!payment || payment.status !== 'pending' || !payment.pixId?.startsWith('MANUAL_')) {
      return NextResponse.json({ success: false, message: 'Pagamento inválido ou já processado.' }, { status: 400 });
    }

    const pixId = payment.pixId;

    if (action === 'reject') {
      await prisma.payment.updateMany({
        where: { pixId },
        data: { status: 'rejected' }
      });

      // ── Regra 14: Bloqueio categórico de inadimplentes ──────────────────
      // Admin rejeitou o pagamento → mesmo comportamento do check-expirations:
      // derruba sessão, remove usuário, bloqueia MAC no MikroTik e no banco.
      const lead = payment.lead;
      const username = lead?.hotspotUser;
      const mac = payment.macAddress ? payment.macAddress.trim().toUpperCase() : null;

      // 1. Operações no MikroTik
      try {
        const activeRouter = await prisma.router.findFirst({ where: { active: true } });
        if (activeRouter) {
          const mk = new MikrotikAPI();
          const connected = await mk.connect(activeRouter.host, activeRouter.user, activeRouter.password, activeRouter.port);
          if (connected) {
            if (username) {
              await mk.removeHotspotActiveByUser(username).catch(() => null);
              await mk.removeHotspotUserByName(username).catch(() => null);
            }
            if (mac) {
              await mk.blockHotspotMac(mac, 'Pagamento rejeitado pelo admin').catch(() => null);
            }
            mk.disconnect();
          }
        }
      } catch (mkErr) {
        console.warn('[approve-pix/reject] Erro no MikroTik:', mkErr);
      }

      // 2. Persistência de bloqueio no banco
      if (mac) {
        await prisma.blockedClient.upsert({
          where: { mac },
          update: {
            active: true,
            cpf: lead?.cpf || undefined,
            phone: lead?.phone || lead?.whatsappNumber || undefined,
            reason: 'Pagamento PIX rejeitado pelo administrador'
          },
          create: {
            mac,
            cpf: lead?.cpf || null,
            phone: lead?.phone || lead?.whatsappNumber || null,
            reason: 'Pagamento PIX rejeitado pelo administrador'
          }
        }).catch(() => null);
      }

      if (lead?.id) {
        await prisma.hotspotLead.update({
          where: { id: lead.id },
          data: { trialBlocked: true }
        }).catch(() => null);
      }

      // 3. Notificar cliente via WhatsApp
      const contactPhone = lead?.phone || lead?.whatsappNumber;
      if (contactPhone) {
        const planTitle = payment.profile || 'Plano de Acesso';
        const rejMsg = `❌ *Pagamento não confirmado*\n\nInfelizmente seu pagamento do plano *${planTitle}* não foi identificado em nosso sistema.\n\nSua sessão foi encerrada.\n\n_Se acredita que houve um engano, entre em contato com o suporte e apresente o comprovante de pagamento._`;
        whatsappService.sendWhatsAppMessage('admin', contactPhone, rejMsg).catch(() => null);
      }

      return NextResponse.json({ success: true, message: 'Pagamento rejeitado. Cliente bloqueado e sessão encerrada.' });
    }


    // --- APPROVE ---
    await prisma.payment.updateMany({
      where: { pixId },
      data: { status: 'approved' }
    });

    const pendingPayments = await prisma.payment.findMany({
      where: { pixId },
      include: { lead: true }
    });

    const voucherPayments = pendingPayments.filter((p: any) => p.isVoucher);
    if (voucherPayments.length > 0) {
      const lead = pendingPayments[0].lead;
      const contactPhone = lead.phone || lead.whatsappNumber;
      if (contactPhone) {
        const plan = await (prisma.whatsappPlan as any).findFirst({ where: { profile: pendingPayments[0].profile } });
        const planTitle = plan?.title || pendingPayments[0].profile || 'Plano de Acesso';
        
        let msg = `🎉 *Pagamento Confirmado!*\n\nSeu pedido de *${voucherPayments.length}x ${planTitle}* foi processado com sucesso!\n\n`;
        
        voucherPayments.forEach((vp: any, index: number) => {
            const vCode = vp.voucherCode || lead.hotspotUser || '';
            const username = lead.hotspotUser; // For voucher mode, user/pass is the code
            const pass = lead.password || lead.hotspotUser; 
            msg += `🔑 *Credenciais do Voucher ${index + 1}:*\n• *Usuário:* ${vCode}\n• *Senha:* ${vCode}\n`;
            if (index < voucherPayments.length - 1) msg += `------------------------\n`;
        });
        
        msg += `\nObrigado pela preferência e bom uso!`;
        whatsappService.sendWhatsAppMessage('admin', contactPhone, msg);
      }
    }

    const hotspotPayments = pendingPayments.filter((p: any) => !p.isVoucher);
    if (hotspotPayments.length > 0) {
      // Liberar no MikroTik
      const activeRouter = await prisma.router.findFirst({ where: { active: true } });
      if (activeRouter) {
        const mk = new MikrotikAPI();
        const connected = await mk.connect(activeRouter.host, activeRouter.user, activeRouter.password, activeRouter.port);
        if (connected) {
          const finalUsername = payment.lead.hotspotUser;
          const finalPassword = payment.lead.password || payment.lead.hotspotUser;
          
          const clientMac = payment.macAddress ? payment.macAddress.trim().toUpperCase() : null;

          // 1. Desbloquear MAC no MikroTik e no banco caso estivesse bloqueado por expiração
          if (clientMac) {
            try {
              await mk.unblockHotspotMac(clientMac);
              console.log(`[Unblock MAC] MAC ${clientMac} desbloqueado no MikroTik após aprovação manual.`);
            } catch (e) { console.error('Erro ao desbloquear MAC no MikroTik:', e); }

            try {
              await prisma.blockedClient.updateMany({
                where: { mac: clientMac },
                data: { active: false }
              });
            } catch (e) { console.error('Erro ao desativar registro BlockedClient:', e); }

            if (payment.leadId) {
              try {
                await prisma.hotspotLead.update({
                  where: { id: payment.leadId },
                  data: { trialBlocked: false }
                });
              } catch (e) {}
            }

            // 1.1. Remover a sessão ativa e o usuário temporário Trial (T-MAC)
            try {
              const trialUser = `T-${clientMac}`;
              await mk.removeHotspotActiveByUser(trialUser);
              await mk.removeHotspotUserByName(trialUser);
              console.log(`Trial do MAC: ${clientMac} derrubado.`);
            } catch(e) { console.error('Erro ao remover trial', e); }
            
            // 1.2. Remover o IP Binding Bypassed
            try {
                const bindings = await mk.getHotspotIpBindings() as any[];
                for (const b of bindings) {
                    if (b['mac-address'] === clientMac && b.type === 'bypassed') {
                        await mk.removeHotspotIpBinding(b['.id'] || b.id);
                    }
                }
            } catch(e) { console.error('Erro ao remover binding', e); }
          }

          // 2. Localizar e atualizar o usuário oficial no MikroTik com o Profile e Uptime Comprado
          try {
            const profileName = payment.profile || 'default';
            
            // Buscar plano no banco para saber o limit-uptime correto
            const plan = await (prisma.whatsappPlan as any).findFirst({
              where: { profile: profileName }
            });
            const targetUptime = plan?.uptimeLimit || 'none';
            const planTitle = plan?.title || profileName;
            
            // Check if user already exists
            const existingUsers = (await mk.getHotspotUsers()) as any[];
            const found = existingUsers.find(u => String(u['name']) === String(finalUsername));
            
            if (found) {
              const foundId = found['.id'] || found['id'];
              // HOT-UPGRADE SEM QUEDA: Atualiza o usuário sem derrubar a sessão ativa (/ip/hotspot/active)
              await mk.updateHotspotUser(foundId, { 
                profile: profileName, 
                'limit-uptime': targetUptime,
                comment: `PIX Manual: ${payment.pixId} | ${planTitle}`
              });
              console.log(`[Hot-Upgrade] Usuário ${finalUsername} atualizado para profile ${profileName} e uptime ${targetUptime} sem interrupções.`);
            } else {
              await mk.addHotspotUser({
                name: finalUsername,
                password: finalPassword,
                profile: profileName,
                'limit-uptime': targetUptime,
                comment: `Venda PIX Manual: ${payment.pixId} | ${planTitle}`,
                server: 'all'
              });
            }
          } catch(e) { console.error('Erro ao criar/atualizar usuário mk', e); }

          // 3. Regra de Firewall Temporária para WhatsApp:
          // Se o cliente NÃO estiver com sessão ativa oficial (ex: estava bloqueado ou desconectado),
          // liberamos SOMENTE o tráfego do WhatsApp para o IP dele, para que ele receba a mensagem com usuário e senha.
          // Assim que ele logar no Hotspot, a regra é automaticamente deletada pelo script on-login do profile ou pelo backend.
          if (clientMac) {
            try {
              const activeSessions = (await mk.getHotspotActive()) as any[];
              const isUserActive = activeSessions.some(a => String(a.user) === String(finalUsername));
              
              if (!isUserActive) {
                const clientIp = await mk.getClientIpByMac(clientMac);
                if (clientIp) {
                  await mk.addTempWhatsAppAccess(clientIp, clientMac);
                  console.log(`[Temp WhatsApp] Acesso liberado para IP ${clientIp} (MAC: ${clientMac}) receber credenciais.`);
                } else {
                  console.warn(`[Temp WhatsApp] IP não localizado para MAC ${clientMac}.`);
                }
              } else {
                console.log(`[Temp WhatsApp] Usuário ${finalUsername} já ativo. Nenhuma regra temporária necessária.`);
              }
            } catch (waErr) {
              console.error('[Temp WhatsApp] Erro ao aplicar regra temporária de WhatsApp:', waErr);
            }
          }
          
          mk.disconnect();
          
          // Enviar WhatsApp Final
          const contactPhone = payment.lead.phone || payment.lead.whatsappNumber;
          if (contactPhone) {
            const plan = await (prisma.whatsappPlan as any).findFirst({ where: { profile: payment.profile } });
            const planTitle = plan?.title || payment.profile || 'Plano de Acesso';
            const wifiName = await getEffectiveWifiName();
            const portalDomain = getMaskedPortalDomain();
            
            const msg = `🎉 *Pagamento Confirmado!*\n\nSeu plano *${planTitle}* foi ativado com sucesso após verificação manual!\n\n🌐 *Status da Conexão:* Ativa\n👤 *Usuário:* ${finalUsername}\n🔑 *Senha:* ${finalPassword}\n\nVocê pode acompanhar o seu plano através do portal:\n👉 http://${portalDomain}/portal/planos\n\n⚠️ *Atenção:* Este link só funciona se você estiver conectado(a) ao Wi-Fi ${wifiName}.\n\nObrigado pela paciência e bom uso!`;
            whatsappService.sendWhatsAppMessage('admin', contactPhone, msg);
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Pagamento aprovado e voucher habilitado.' });
  } catch (error: any) {
    console.error('[portal/admin/approve-pix] Error:', error);
    return NextResponse.json({ success: false, message: 'Erro interno ao processar PIX' }, { status: 500 });
  }
}
