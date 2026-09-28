import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { whatsappService } from '@/services/whatsapp';

export async function POST(req: Request) {
  try {
    const { whatsapp } = await req.json();

    if (!whatsapp) {
      return NextResponse.json({ success: false, message: 'WhatsApp é obrigatório.' }, { status: 400 });
    }

    // format whatsapp (digits only)
    const formattedPhone = whatsapp.replace(/\D/g, '');

    // check if already in list and pending
    const existing = await prisma.waitingList.findFirst({
      where: {
        whatsapp: formattedPhone,
        status: 'pending',
      }
    });

    if (existing) {
      return NextResponse.json({ success: true, message: 'Você já está na fila de espera!' });
    }

    await prisma.waitingList.create({
      data: {
        whatsapp: formattedPhone,
        status: 'pending',
      }
    });

    // Notify user via WhatsApp that they are in the queue
    try {
      const msg = `⏳ *Fila de Espera - Wi-Fi*\n\nOlá! Agradecemos o seu interesse.\n\nNo momento, nossa rede Wi-Fi está operando na capacidade máxima para garantir a melhor qualidade a todos os usuários conectados.\n\nVocê foi adicionado(a) à nossa fila de espera! Assim que uma vaga for liberada, nós te avisaremos por aqui.`;
      
      const adminNumbers = await whatsappService.getOnlineOfficialNumbers();
      if (adminNumbers.length > 0) {
          await whatsappService.sendWhatsAppMessage('admin', formattedPhone, msg);
      }
    } catch (waErr) {
      console.warn('[portal/waiting-list] Erro ao enviar mensagem de fila no WhatsApp:', waErr);
    }

    return NextResponse.json({ success: true, message: 'Adicionado à fila com sucesso! Avisaremos via WhatsApp.' });
  } catch (error: any) {
    console.error('[portal/waiting-list] Error:', error);
    return NextResponse.json({ success: false, message: 'Erro ao entrar na fila de espera.' }, { status: 500 });
  }
}
