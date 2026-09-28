import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { whatsappService } from "@/services/whatsapp";
import fs from "fs";
import path from "path";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const instanceIdFilter = searchParams.get("instanceId");

    // 1. Auto-sanitização de gatilhos órfãos:
    // Se alguma mídia vinculada a um gatilho tiver sido deletada da biblioteca,
    // remove a referência em SystemConfig para que os envios não fiquem travados ou offline.
    try {
      const forwardConfigs = await prisma.systemConfig.findMany({
        where: { key: { endsWith: '_FORWARD_ID' } }
      });
      for (const fc of forwardConfigs) {
        if (fc.value) {
          const exists = await prisma.mediaLibrary.findUnique({
            where: { id: fc.value },
            select: { id: true }
          });
          if (!exists) {
            console.log(`[MediaLibrary][Sanitização] Limpando gatilho órfão ${fc.key} (mídia ${fc.value} foi deletada).`);
            await prisma.systemConfig.delete({ where: { key: fc.key } }).catch(() => {});
          }
        }
      }
    } catch (cleanErr) {
      console.warn('[MediaLibrary] Aviso ao sanitizar gatilhos órfãos:', cleanErr);
    }

    // Se solicitado parâmetro sync=true, dispara busca ativa de histórico no WhatsApp
    const shouldSync = searchParams.get("sync") === "true";
    if (shouldSync) {
      try {
        console.log('[MediaLibrary][API] Parâmetro sync=true recebido. Sincronizando com WhatsApp...');
        await whatsappService.syncMediaLibraryFromGroup();
      } catch (syncErr: any) {
        console.warn('[MediaLibrary] Aviso ao executar syncMediaLibraryFromGroup:', syncErr?.message || syncErr);
      }
    }

    const whereClause: any = {};
    if (instanceIdFilter) {
      whereClause.instanceId = instanceIdFilter;
    }

    const [items, instances, globalGroup] = await Promise.all([
      prisma.mediaLibrary.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          caption: true,
          mediaType: true,
          mimeType: true,
          thumbnailUrl: true,
          sourceJid: true,
          messageId: true,
          instanceId: true,
          createdAt: true,
        }
      }),
      prisma.whatsappInstance.findMany({
        where: { engine: "baileys", libraryGroupJid: { not: null } },
        select: {
          id: true,
          name: true,
          number: true,
          libraryGroupJid: true,
          libraryGroupName: true,
          status: true,
        }
      }),
      prisma.systemConfig.findUnique({
        where: { key: "WHATSAPP_MEDIA_LIBRARY_GROUP" }
      }).then(r => r?.value || null)
    ]);

    return NextResponse.json({
      success: true,
      items,
      configuredGroups: instances.map(inst => ({
        instanceId: inst.id,
        instanceName: inst.name,
        number: inst.number,
        groupJid: inst.libraryGroupJid,
        groupName: inst.libraryGroupName || "Grupo Sem Nome",
        status: inst.status,
      })),
      globalGroupJid: globalGroup,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "Erro ao listar biblioteca" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      if (body.action === 'sync') {
        const syncResult = await whatsappService.syncMediaLibraryFromGroup(body.groupJid);
        const items = await prisma.mediaLibrary.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            caption: true,
            mediaType: true,
            mimeType: true,
            thumbnailUrl: true,
            sourceJid: true,
            messageId: true,
            instanceId: true,
            createdAt: true,
          }
        });
        return NextResponse.json({ success: true, syncResult, items });
      }
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const caption = (formData.get('caption') as string) || '';
    const instanceId = (formData.get('instanceId') as string) || null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Diretório persistente de uploads de mídia
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'media-library');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const originalName = file.name || 'midia';
    const ext = path.extname(originalName) || '.jpg';
    const safeName = `lib-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`;
    const filePath = path.join(uploadDir, safeName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/media-library/${safeName}`;
    const mime = file.type || 'image/jpeg';
    let mediaType = 'image';
    if (mime.startsWith('video/')) mediaType = 'video';
    else if (mime.startsWith('audio/')) mediaType = 'audio';
    else if (mime.startsWith('application/') || mime.includes('pdf')) mediaType = 'document';

    // Gera thumbnail se for imagem
    let thumbnailUrl = publicUrl;
    if (mediaType === 'image' && buffer.length < 600000) {
      thumbnailUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    }

    const cleanCaption = caption.trim() || originalName;
    const dummyMsgId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const created = await prisma.mediaLibrary.create({
      data: {
        caption: cleanCaption,
        mediaType,
        mimeType: mime,
        thumbnailUrl,
        messageJson: JSON.stringify({
          key: { id: dummyMsgId, fromMe: true },
          message: {
            [`${mediaType}Message`]: {
              url: publicUrl,
              mimetype: mime,
              caption: cleanCaption
            }
          }
        }),
        sourceJid: 'manual-upload',
        messageId: dummyMsgId,
        instanceId: instanceId || null,
      }
    });

    // Se houver algum WhatsApp online com grupo vinculado, transmite ao grupo em background
    whatsappService.broadcastMediaToLibraryGroup(created.id, filePath, mediaType, mime, cleanCaption).catch(() => {});

    return NextResponse.json({
      success: true,
      item: created,
      message: 'Mídia adicionada com sucesso à Biblioteca Central!'
    });
  } catch (error: any) {
    console.error('[POST /api/admin/media-library]', error);
    return NextResponse.json({ success: false, message: error?.message || 'Erro ao fazer upload da mídia' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, caption } = await request.json();
    if (!id) return NextResponse.json({ success: false, message: "ID obrigatorio" }, { status: 400 });
    const updated = await prisma.mediaLibrary.update({
      where: { id },
      data: { caption },
      select: { id: true, caption: true }
    });
    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "Erro ao atualizar" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ success: false, message: "ID obrigatorio" }, { status: 400 });

    const item = await prisma.mediaLibrary.findUnique({ where: { id } });

    // 1. Remove da tabela MediaLibrary
    await prisma.mediaLibrary.deleteMany({ where: { id } });

    // 2. Limpa qualquer arquivo físico se foi upload local
    if (item?.thumbnailUrl?.startsWith('/uploads/media-library/')) {
      try {
        const localPath = path.join(process.cwd(), 'public', item.thumbnailUrl);
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      } catch {}
    }

    // 3. CRÍTICO: Limpa todas as referências em gatilhos (SystemConfig) vinculadas a esta mídia
    // Isso garante que nenhuma mensagem de boas-vindas / pendência / voucher fique 'offline' ou travada
    const cleanedTriggers = await prisma.systemConfig.deleteMany({
      where: {
        key: { endsWith: '_FORWARD_ID' },
        value: id,
      }
    });

    console.log(`[MediaLibrary] Mídia ${id} removida. ${cleanedTriggers.count} gatilho(s) limpo(s) para evitar falhas.`);

    return NextResponse.json({
      success: true,
      message: "Item removido da biblioteca e gatilhos atualizados com sucesso."
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "Erro ao remover" }, { status: 500 });
  }
}
