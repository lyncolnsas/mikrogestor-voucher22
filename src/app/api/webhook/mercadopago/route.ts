import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MikrotikAPI } from '@/lib/routeros';
import { whatsappService } from '@/services/whatsapp';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getMaskedPortalDomain } from '@/lib/domain';
import { getCustomTemplate, applyTemplateTags, getTriggerSendOptions, getEffectiveWifiName } from '@/services/whatsapp-custom-messages';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    let body: any = {};
    try { body = await request.json(); } catch (e) {}
    
    const id = url.searchParams.get('data.id') || body?.data?.id;
    const action = body?.action || url.searchParams.get('action');

    // MP sometimes sends data in query parameters or in body
    if (action === 'payment.created' || action === 'payment.updated' || url.searchParams.get('type') === 'payment' || url.searchParams.get('topic') === 'payment') {
       if (!id) return NextResponse.json({ success: true });
       
       const payments = await prisma.payment.findMany({
          where: { pixId: String(id) },
          include: { lead: true }
       });
       
       const pendingPayments = payments.filter((p: any) => p.status !== 'approved');
       if (pendingPayments.length > 0) {
          
          // Verify with MercadoPago API if it's actually approved
          const config = await prisma.systemConfig.findFirst({
            where: {
              key: { in: ['MERCADOPAGO_TOKEN', 'mercadoPagoToken', 'mercadopago_token'] }
            }
          });
          if (config?.value) {
            const client = new MercadoPagoConfig({ accessToken: config.value });
            const mpPayment = new Payment(client);
            try {
              const paymentInfo = await mpPayment.get({ id: String(id) });
              
              if (paymentInfo.status === 'approved') {
                // Update DB for all grouped payments
                await prisma.payment.updateMany({
                   where: { pixId: String(id) },
                   data: { status: 'approved' }
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
                          const pass = lead.password || lead.hotspotUser; // But if voucherCode is generated, we should use that
                          // Wait, if it's a stand-alone voucher, the username is the voucherCode
                          msg += `🔑 *Credenciais do Voucher ${index + 1}:*\n• *Usuário:* ${vCode}\n• *Senha:* ${vCode}\n`;
                          if (index < voucherPayments.length - 1) msg += `------------------------\n`;
                      });
                      
                      msg += `\nObrigado pela preferência e bom uso!\n\n📄 Termos de Uso e Isenção de Responsabilidade: http://${getMaskedPortalDomain()}/portal/termos/pago`;
                      whatsappService.sendWhatsAppMessage('admin', contactPhone, msg);
                   }
                }

                // If any payment is NOT a voucher (regular Hotspot flow)
                const hotspotPayments = pendingPayments.filter((p: any) => !p.isVoucher);
                if (hotspotPayments.length > 0) {
                   const payment = hotspotPayments[0]; // Process the first one since it's the same lead
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
                             console.log(`[Unblock MAC] MAC ${clientMac} desbloqueado no MikroTik após pagamento aprovado.`);
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
                               comment: `PIX Aprovado: ${payment.pixId} | ${planTitle}`
                             });
                             console.log(`[Hot-Upgrade] Usuário ${finalUsername} atualizado para profile ${profileName} e uptime ${targetUptime} sem interrupções.`);
                           } else {
                             await mk.addHotspotUser({
                               name: finalUsername,
                               password: finalPassword,
                               profile: profileName,
                               'limit-uptime': targetUptime,
                               comment: `Venda PIX MP: ${payment.pixId} | ${planTitle}`,
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
                            
                            const rawTemplate = await getCustomTemplate('WA_MSG_PAYMENT_APPROVED_HOTSPOT');
                            const msg = applyTemplateTags(rawTemplate, {
                                cliente: payment.lead.name || finalUsername,
                                plano: planTitle,
                                usuario: finalUsername,
                                senha: finalPassword,
                                link_portal: `http://${portalDomain}/portal/planos`,
                                rede_wifi: wifiName,
                            });
                            const finalMsg = msg + `\n\n📄 Termos de Uso e Isenção de Responsabilidade: http://${portalDomain}/portal/termos/pago`;
                            const sendOpts = await getTriggerSendOptions('WA_MSG_PAYMENT_APPROVED_HOTSPOT');
                            whatsappService.sendWhatsAppMessage('admin', contactPhone, finalMsg, {
                                media: sendOpts.media,
                                forwardLibraryId: sendOpts.forwardLibraryId,
                            });
                         }
                      }
                   }
                }
              }
            } catch (mpErr) {
              console.error('Error fetching payment from MP', mpErr);
            }
          }
       }
    }
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
