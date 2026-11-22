import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MikrotikAPI } from '@/lib/routeros';
import { checkManagerAuth } from '@/lib/manager-auth';
import { whatsappService } from '@/services/whatsapp';
import { getCustomTemplate, applyTemplateTags, getTriggerSendOptions, getEffectiveWifiName } from '@/services/whatsapp-custom-messages';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await checkManagerAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { id, mac, routerId, note, notifyWhatsApp = true } = body;

    if (!id && !mac) {
      return NextResponse.json(
        { success: false, message: 'Informe o ID ou o MAC do cliente para desbloquear.' },
        { status: 400 }
      );
    }

    // 1. Localiza o registro de bloqueio
    let blockedRecord = null;
    if (id) {
      blockedRecord = await prisma.blockedClient.findUnique({ where: { id } });
    } else if (mac) {
      const cleanMac = String(mac).trim().toUpperCase();
      blockedRecord = await prisma.blockedClient.findFirst({
        where: { mac: cleanMac, active: true },
        orderBy: { blockedAt: 'desc' },
      });
    }

    const targetMac = (blockedRecord?.mac || (mac ? String(mac).trim() : '')).toUpperCase();
    if (!targetMac) {
      return NextResponse.json(
        { success: false, message: 'Endereço MAC não encontrado para este registro.' },
        { status: 400 }
      );
    }

    // 2. Busca o roteador ativo ou especificado
    let router = null;
    if (routerId) {
      router = await prisma.router.findUnique({ where: { id: routerId } });
    }
    if (!router) {
      router = await prisma.router.findFirst({ where: { active: true } });
    }

    let mkUnblocked = false;
    let userRecreated = false;
    let autoLoginLink = '';

    // 3. Busca lead e pagamento associados para obter usuário e senha
    const lead = await prisma.hotspotLead.findFirst({
      where: {
        OR: [
          ...(blockedRecord?.cpf ? [{ cpf: blockedRecord.cpf }] : []),
          ...(blockedRecord?.phone ? [{ phone: blockedRecord.phone }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    const payment = lead
      ? await prisma.payment.findFirst({
          where: { leadId: lead.id },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    const username = lead?.hotspotUser || targetMac.replace(/[^A-Za-z0-9]/g, '').slice(-8).toLowerCase();
    const password = lead?.password || '123456';
    const profile = payment?.profile || 'hsprof_hotspot';

    // 4. Executa desbloqueio no MikroTik
    if (router) {
      try {
        const mk = new MikrotikAPI();
        if (await mk.connect(router.host, router.user, router.password, router.port)) {
          // Remove do IP-Binding bloqueado
          mkUnblocked = await mk.unblockHotspotMac(targetMac);

          // Verifica se o usuário existe; se não, recria com tempo liberado
          try {
            const users = await mk.getHotspotUsers();
            const existingUser = users.find((u: any) => u.name === username);
            if (!existingUser) {
              await mk.addHotspotUser({
                name: username,
                password: password,
                profile: profile,
                comment: `MikroGestor: Desbloqueado manualmente pelo App Manager (${note || 'Painel'})`,
              });
              userRecreated = true;
            }
          } catch (userErr) {
            console.warn('[Manager API] Aviso ao garantir usuário no MikroTik:', userErr);
          }

          mk.disconnect();
        }
      } catch (mkErr) {
        console.error('[Manager API] Erro ao conectar ao MikroTik:', mkErr);
      }
    }

    // 5. Atualiza registro na tabela BlockedClient
    if (blockedRecord) {
      await prisma.blockedClient.update({
        where: { id: blockedRecord.id },
        data: { active: false },
      });
    } else if (targetMac) {
      await prisma.blockedClient.updateMany({
        where: { mac: targetMac },
        data: { active: false },
      });
    }

    // 6. Monta Link de Auto-Login
    const domain = router?.subdomain || 'fap.mikrogestor.com';
    autoLoginLink = `https://${domain}/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    // 7. Notifica via WhatsApp se solicitado e houver telefone
    let waSent = false;
    const phone = blockedRecord?.phone || lead?.phone;
    if (notifyWhatsApp && phone) {
      try {
        const wifiName = await getEffectiveWifiName();
        const baseMsg = await getCustomTemplate('WA_MSG_PAYMENT_APPROVED_HOTSPOT');
        const customMsg = applyTemplateTags(baseMsg, {
          nome: lead?.name || 'Cliente',
          wifi: wifiName,
          usuario: username,
          senha: password,
          link_autologin: autoLoginLink,
          tempo: 'Acesso Liberado',
          valor: '0,00',
        });

        const triggerOptions = await getTriggerSendOptions('WA_MSG_PAYMENT_APPROVED_HOTSPOT');
        const waResult = await whatsappService.sendWhatsAppMessage(
          'admin',
          phone,
          customMsg,
          triggerOptions
        );
        waSent = !!waResult?.success;
      } catch (waErr) {
        console.warn('[Manager API] Falha ao enviar WhatsApp de desbloqueio:', waErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cliente desbloqueado com sucesso!',
      data: {
        mac: targetMac,
        username,
        mkUnblocked,
        userRecreated,
        autoLoginLink,
        whatsappSent: waSent,
      },
    });
  } catch (error: any) {
    console.error('[Manager API] Erro ao desbloquear cliente:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Erro ao processar desbloqueio.' },
      { status: 500 }
    );
  }
}
