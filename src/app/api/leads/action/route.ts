import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MikrotikAPI } from '@/lib/routeros';
import { whatsappService } from '@/services/whatsapp';

export async function POST(request: Request) {
  try {
    const { paymentId, action } = await request.json();

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { lead: true }
    });

    if (!payment) return NextResponse.json({ success: false, error: 'Pagamento não encontrado.' }, { status: 404 });

    const activeRouter = await prisma.router.findFirst({ where: { active: true } });
    if (!activeRouter) return NextResponse.json({ success: false, error: 'Sem roteador ativo.' }, { status: 500 });

    const mk = new MikrotikAPI();
    const connected = await mk.connect(activeRouter.host, activeRouter.user, activeRouter.password, activeRouter.port);
    if (!connected) return NextResponse.json({ success: false, error: 'Falha na conexão com roteador.' }, { status: 500 });

    const hotspotUser = payment.isVoucher && payment.voucherCode ? payment.voucherCode : payment.lead.hotspotUser;

    if (action === 'approve') {
      // Atualiza banco
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'approved' }
      });

      // Ativa no MikroTik caso estivesse desativado, ou cria se for voucher e nao existir
      const users = await mk.getHotspotUsers() as any[];
      const found = users.find(u => u['name'] === hotspotUser);
      if (found) {
        const id = found['.id'] || found['id'];
        await mk.enableHotspotUser(id);
      } else if (payment.isVoucher) {
        // Se for voucher e nao ta no mk, cria
        await mk.addHotspotUser({
          name: hotspotUser,
          password: hotspotUser,
          profile: payment.profile,
          'limit-uptime': payment.uptimeLimit || 'none',
          comment: `Voucher Aprovado | Lead: ${payment.lead.hotspotUser}`,
          server: 'all'
        }).catch(() => {});
      }

      // Manda mensagem de agradecimento
      if (payment.lead.whatsappNumber) {
        const msg = payment.isVoucher 
          ? `🎉 *Voucher Aprovado!*\n\nSeu pagamento foi confirmado.\nCredenciais prontas para uso!\n\nUsuário: ${hotspotUser}\nSenha: ${hotspotUser}` 
          : `🎉 *Pagamento Confirmado!*\n\nMuito obrigado! O seu acesso já está validado e liberado permanentemente no sistema.`;
        whatsappService.sendWhatsAppMessage('admin', payment.lead.whatsappNumber, msg);
      }

    } else if (action === 'block') {
      // Atualiza banco
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'blocked' }
      });

      // Bloqueia no MikroTik
      const users = await mk.getHotspotUsers() as any[];
      const found = users.find(u => u['name'] === hotspotUser);
      if (found) {
        const id = found['.id'] || found['id'];
        await mk.disableHotspotUser(id);
        
        // Remove active session
        try {
          const actives = await mk.getActiveHotspotUsers() as any[];
          const activeSess = actives.find(a => a.user === hotspotUser);
          if (activeSess) {
             const activeId = activeSess['.id'] || activeSess['id'];
             await mk.removeActiveHotspotUser(activeId);
          }
        } catch(e) {}
      }

      // Manda mensagem de cobrança
      if (payment.lead.whatsappNumber) {
        const { getEffectivePixKey } = await import('@/lib/pix');
        const pixKey = await getEffectivePixKey();
        const pixSection = pixKey
          ? `\n\nPor favor, faça o PIX de *R$ ${payment.amount.toFixed(2)}* para a chave: *${pixKey}* e envie o comprovante para reativarmos.`
          : '\n\nPor favor, entre em contato com o suporte para regularizar seu acesso.';

        whatsappService.sendWhatsAppMessage('admin', payment.lead.whatsappNumber, 
          `⚠️ *Aviso de Bloqueio*\n\nNotamos que o pagamento do seu voucher não foi confirmado e o seu acesso foi suspenso.${pixSection}`
        );
      }
    }

    mk.disconnect();
    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
