import { NextResponse } from 'next/server';
import { whatsappService } from '@/services/whatsapp';
import { prisma } from '@/lib/prisma';
import { getCustomTemplate, applyTemplateTags, getTriggerSendOptions, getEffectiveWifiName } from '@/services/whatsapp-custom-messages';

export async function GET() {
  try {
    const instances = await prisma.whatsappInstance.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    const results = instances.map(inst => {
      let status = inst.status;
      let qr = inst.qrCode;

      if (inst.engine === 'baileys') {
        const liveStatus = whatsappService.getStatus(inst.id);
        const liveQr = whatsappService.getQrCode(inst.id);
        if (liveStatus) status = liveStatus;
        if (liveQr) qr = liveQr;
      }

      // Atualiza banco silenciosamente se divergir
      if (status !== inst.status) {
        prisma.whatsappInstance.update({
          where: { id: inst.id },
          data: { status }
        }).catch(() => {});
      }

      return {
        id: inst.id,
        name: inst.name,
        number: inst.number,
        engine: inst.engine,
        profilePicUrl: inst.profilePicUrl,
        status,
        qr
      };
    });

    return NextResponse.json({ success: true, instances: results });
  } catch (error) {
    return NextResponse.json({ success: false, status: 'error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, id, name, phone, message, voucherCode, timeLimit } = body;
    
    if (action === 'create') {
      const newInst = await prisma.whatsappInstance.create({
        data: { name: name || 'Novo WhatsApp', engine: 'baileys', status: 'waiting_qr' }
      });
      whatsappService.connectBaileysInstance(newInst.id, newInst.name).catch(() => {});
      return NextResponse.json({ success: true, instance: newInst });
    } else if (action === 'delete' && id) {
      await whatsappService.logoutBaileys(id, true);
      await prisma.whatsappInstance.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Deleted' });
    } else if (action === 'connect' && id) {
      await whatsappService.connectBaileysInstance(id);
      return NextResponse.json({ success: true, message: 'Conectando...' });
    } else if (action === 'logout' && id) {
      await whatsappService.logoutBaileys(id, false);
      return NextResponse.json({ success: true, message: 'Logged out.' });
    } else if (action === 'test_message') {
      if (!phone) {
        return NextResponse.json({ success: false, message: 'Número de telefone é obrigatório.' }, { status: 400 });
      }
      
      const text = message || '🤖 *MikroGestor Hotspot*\nEsta é uma mensagem de teste do sistema de atendimento via WhatsApp!';
      const res = await whatsappService.sendWhatsAppMessage('admin', phone, text, { pinnedInstanceId: id });
      
      if (res.success) {
        return NextResponse.json({ success: true, message: 'Mensagem enviada com sucesso para o WhatsApp!' });
      } else {
        return NextResponse.json({ success: false, message: res.error || 'Aparelho não conectado ou falha no disparo.' }, { status: 500 });
      }
    } else if (action === 'send_voucher') {
      if (!phone || !voucherCode) {
        return NextResponse.json({ success: false, message: 'Telefone e código do voucher são obrigatórios.' }, { status: 400 });
      }
      
      const isFree = (await prisma.systemConfig.findUnique({ where: { key: 'free_wifi_mode' } }))?.value === 'true' ||
                     (await prisma.systemConfig.findUnique({ where: { key: 'PORTAL_SALES_MODE' } }))?.value === 'free';
      const triggerKey = isFree ? 'WA_MSG_VOUCHER_DELIVERY_FREE' : 'WA_MSG_VOUCHER_DELIVERY';
      const rawTemplate = await getCustomTemplate(triggerKey);
      const wifiName = await getEffectiveWifiName();
      const text = applyTemplateTags(rawTemplate, {
        cliente: 'Cliente',
        codigo_voucher: voucherCode,
        validade: timeLimit || (isFree ? 'Dia Todo' : '15 minutos'),
        rede_wifi: wifiName,
      });
      const sendOpts = await getTriggerSendOptions(triggerKey);
      const res = await whatsappService.sendWhatsAppMessage('admin', phone, text, {
        pinnedInstanceId: id,
        media: sendOpts.media,
        forwardLibraryId: sendOpts.forwardLibraryId,
      });
      
      return NextResponse.json({ success: res.success, message: res.success ? 'Voucher disparado com sucesso!' : (res.error || 'Falha ao enviar voucher via WhatsApp.') });
    }

    return NextResponse.json({ success: false, message: 'Ação inválida ou parâmetros ausentes.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Erro interno' }, { status: 500 });
  }
}

