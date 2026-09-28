import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  WHATSAPP_TRIGGERS,
  MessageTriggerDefinition,
  getFlowConfig,
  saveFlowConfig,
  SystemFlowMap,
  getEffectiveWifiName
} from '@/services/whatsapp-custom-messages';

export async function GET() {
  try {
    const keys = WHATSAPP_TRIGGERS.map(t => t.key);
    const mediaKeys = keys.map(k => `${k}_MEDIA`);
    const forwardKeys = keys.map(k => `${k}_FORWARD_ID`);
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: [...keys, ...mediaKeys, ...forwardKeys, 'PORTAL_SALES_MODE'] } }
    });

    const configMap = configs.reduce((acc: Record<string, string>, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    const activeSystemMode = configMap['PORTAL_SALES_MODE'] === 'free' ? 'free' : 'paid';
    const flowConfig = await getFlowConfig();

    const triggers = WHATSAPP_TRIGGERS.map(t => {
      let mediaUrl = '';
      let mediaType = 'image';
      try {
        const mediaConfig = configMap[`${t.key}_MEDIA`];
        if (mediaConfig) {
          const m = JSON.parse(mediaConfig);
          mediaUrl = m.url || '';
          mediaType = m.type || 'image';
        }
      } catch {}

      const forwardLibraryId = configMap[`${t.key}_FORWARD_ID`] || '';

      return {
        ...t,
        currentTemplate: configMap[t.key] || t.defaultTemplate,
        isCustomized: Boolean(configMap[t.key] && configMap[t.key] !== t.defaultTemplate),
        mediaUrl,
        mediaType,
        forwardLibraryId
      };
    });

    const wifiName = await getEffectiveWifiName();

    return NextResponse.json({ success: true, triggers, activeSystemMode, flowConfig, wifiName });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Erro ao carregar templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, template, action, mode, flowConfig, mediaUrl, mediaType, forwardLibraryId, wifiName } = body;

    // Ação para configurar o nome exato da rede Wi-Fi (SSID)
    if (action === 'setWifiName') {
      const newWifiName = (wifiName || '').trim();
      if (!newWifiName) {
        return NextResponse.json({ success: false, message: 'O nome da rede Wi-Fi não pode ser vazio' }, { status: 400 });
      }

      await Promise.all([
        prisma.systemConfig.upsert({
          where: { key: 'HOTSPOT_WIFI_NAME' },
          update: { value: newWifiName },
          create: { key: 'HOTSPOT_WIFI_NAME', value: newWifiName }
        }),
        prisma.systemConfig.upsert({
          where: { key: 'HOTSPOT_NETWORK_NAME' },
          update: { value: newWifiName },
          create: { key: 'HOTSPOT_NETWORK_NAME', value: newWifiName }
        })
      ]);

      return NextResponse.json({
        success: true,
        message: `Nome da rede Wi-Fi configurado para: "${newWifiName}"`,
        wifiName: newWifiName
      });
    }

    // Ação para salvar o fluxograma completo
    if (action === 'saveFlow') {
      if (!flowConfig) {
        return NextResponse.json({ success: false, message: 'Dados de fluxo ausentes' }, { status: 400 });
      }
      const ok = await saveFlowConfig(flowConfig as SystemFlowMap);
      return NextResponse.json({
        success: ok,
        message: ok ? 'Fluxograma e réguas de mensagens atualizados com sucesso!' : 'Erro ao salvar fluxograma'
      });
    }

    // Ação para definir o modo global de operação (Pago ou Free)
    if (action === 'setActiveMode') {
      if (mode !== 'free' && mode !== 'paid') {
        return NextResponse.json({ success: false, message: 'Modo inválido' }, { status: 400 });
      }

      // Sincroniza tanto PORTAL_SALES_MODE quanto free_wifi_mode para manter 100% de coerência
      const isFree = mode === 'free';
      await Promise.all([
        prisma.systemConfig.upsert({
          where: { key: 'PORTAL_SALES_MODE' },
          update: { value: mode },
          create: { key: 'PORTAL_SALES_MODE', value: mode }
        }),
        prisma.systemConfig.upsert({
          where: { key: 'free_wifi_mode' },
          update: { value: isFree ? 'true' : 'false' },
          create: { key: 'free_wifi_mode', value: isFree ? 'true' : 'false' }
        })
      ]);

      return NextResponse.json({
        success: true,
        message: `Modo do sistema alterado para: ${mode === 'paid' ? 'Modelos Pagos (Venda)' : 'Modelos Free (Gratuito)'}`,
        activeSystemMode: mode
      });
    }

    if (!key) {
      return NextResponse.json({ success: false, message: 'Chave obrigatória' }, { status: 400 });
    }

    const triggerDef = WHATSAPP_TRIGGERS.find(t => t.key === key);
    if (!triggerDef) {
      return NextResponse.json({ success: false, message: 'Gatilho não reconhecido' }, { status: 404 });
    }

    const mediaKey = `${key}_MEDIA`;

    if (action === 'reset') {
      // Remove do banco para restaurar padrão (texto + mídia + forward)
      await prisma.systemConfig.deleteMany({
        where: { key: { in: [key, mediaKey, `${key}_FORWARD_ID`] } }
      });
      return NextResponse.json({
        success: true,
        message: 'Mensagem restaurada para o padrão de fábrica.',
        template: triggerDef.defaultTemplate,
        isCustomized: false,
        mediaUrl: '',
        mediaType: 'image',
        forwardLibraryId: ''
      });
    }

    // Salva personalização de texto
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value: String(template) },
      create: { key, value: String(template) }
    });

    const forwardKey = `${key}_FORWARD_ID`;

    // Forward nativo (biblioteca) tem precedência sobre URL
    if (forwardLibraryId && forwardLibraryId.trim().length > 0) {
      // Salva forward ID e limpa media URL (são mutuamente exclusivos)
      await prisma.systemConfig.upsert({
        where: { key: forwardKey },
        update: { value: forwardLibraryId.trim() },
        create: { key: forwardKey, value: forwardLibraryId.trim() }
      });
      await prisma.systemConfig.deleteMany({ where: { key: mediaKey } });
    } else {
      // Remove forward ID
      await prisma.systemConfig.deleteMany({ where: { key: forwardKey } });

      // Salva ou remove personalização de mídia via URL
      if (mediaUrl && mediaUrl.trim().length > 0) {
        const mediaValue = JSON.stringify({ url: mediaUrl.trim(), type: mediaType || 'image' });
        await prisma.systemConfig.upsert({
          where: { key: mediaKey },
          update: { value: mediaValue },
          create: { key: mediaKey, value: mediaValue }
        });
      } else {
        await prisma.systemConfig.deleteMany({ where: { key: mediaKey } });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Modelo de mensagem salvo com sucesso!',
      template,
      isCustomized: template !== triggerDef.defaultTemplate,
      mediaUrl: forwardLibraryId ? '' : (mediaUrl?.trim() || ''),
      mediaType: mediaType || 'image',
      forwardLibraryId: forwardLibraryId?.trim() || ''
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Erro ao salvar modelo' }, { status: 500 });
  }
}
