import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { whatsappService } from '@/services/whatsapp';

export async function GET() {
  try {
    const instances = await prisma.whatsappInstance.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Enriquece com status e QR em tempo real da memória
    const enriched = instances.map(inst => {
      let liveStatus = inst.status;
      let liveQr = inst.qrCode;

      if (inst.engine === 'baileys') {
        const sessionStatus = whatsappService.getStatus(inst.id);
        const sessionQr = whatsappService.getQrCode(inst.id);
        if (sessionStatus) liveStatus = sessionStatus;
        if (sessionQr) liveQr = sessionQr;
      }

      return {
        ...inst,
        status: liveStatus,
        qrCode: liveQr
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error('[GET /api/whatsapp/instances]', error);
    return NextResponse.json({ success: false, error: 'Erro ao buscar instâncias' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, number, phoneId, token, engine = 'baileys' } = body;

    if (engine === 'meta') {
      if (!phoneId || !token) {
        return NextResponse.json({ success: false, error: 'Phone ID e Token são obrigatórios para a Meta' }, { status: 400 });
      }

      const instance = await prisma.whatsappInstance.create({
        data: {
          name: name || 'WhatsApp Meta Oficial',
          number: number || null,
          engine: 'meta',
          phoneId,
          token,
          status: 'connected',
          active: true
        }
      });
      return NextResponse.json({ success: true, data: instance });
    }

    // Engine: Baileys (Multi-Device - suporta de 2 até 8 números conectados)
    // Se já existir um grupo central configurado, herda automaticamente para o novo aparelho
    let inheritedGroupJid: string | null = null;
    let inheritedGroupName: string | null = null;
    try {
      const globalGroup = await prisma.systemConfig.findUnique({
        where: { key: 'WHATSAPP_MEDIA_LIBRARY_GROUP' }
      });
      if (globalGroup?.value) {
        inheritedGroupJid = globalGroup.value;
        const anyInst = await prisma.whatsappInstance.findFirst({
          where: { libraryGroupJid: inheritedGroupJid },
          select: { libraryGroupName: true }
        });
        inheritedGroupName = anyInst?.libraryGroupName || 'Grupo Central de Mídias';
      }
    } catch {}

    const instance = await prisma.whatsappInstance.create({
      data: {
        name: name || 'Novo WhatsApp Conectado',
        number: number || null,
        engine: 'baileys',
        status: 'waiting_qr',
        active: true,
        libraryGroupJid: inheritedGroupJid,
        libraryGroupName: inheritedGroupName,
      }
    });

    // Inicia imediatamente o socket da nova instância para gerar QR Code
    whatsappService.connectBaileysInstance(instance.id, instance.name).catch(err => {
      console.error(`[POST /api/whatsapp/instances] Falha ao iniciar socket para ${instance.id}:`, err);
    });

    return NextResponse.json({ success: true, data: instance });
  } catch (error) {
    console.error('[POST /api/whatsapp/instances]', error);
    return NextResponse.json({ success: false, error: 'Erro ao criar instância' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID não fornecido' }, { status: 400 });
    }

    const instance = await prisma.whatsappInstance.findUnique({ where: { id } });
    if (instance && instance.engine === 'baileys') {
      // Graceful shutdown com timeout de 2.5s para nunca travar requisição
      try {
        await Promise.race([
          whatsappService.logoutBaileys(id, true),
          new Promise(resolve => setTimeout(resolve, 2500))
        ]);
      } catch (err) {
        console.warn(`[DELETE /api/whatsapp/instances] Aviso no logoutBaileys para ${id}:`, err);
      }
    }

    // Remove roteamentos, histórico e autenticação vinculados
    await prisma.leadRouting.deleteMany({ where: { whatsappInstanceId: id } }).catch(() => {});
    await prisma.dailyConversation.deleteMany({ where: { whatsappInstanceId: id } }).catch(() => {});
    await prisma.baileysAuth.deleteMany({ where: { instanceId: id } }).catch(() => {});
    try {
      await (prisma as any).chatBotState?.deleteMany?.({ where: { instanceId: id } });
    } catch {}

    // Remove a instância
    await prisma.whatsappInstance.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Instância excluída com sucesso.' });
  } catch (error: any) {
    console.error('[DELETE /api/whatsapp/instances]', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Erro ao excluir instância'
    }, { status: 500 });
  }
}

