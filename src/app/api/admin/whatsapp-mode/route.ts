import { NextRequest, NextResponse } from 'next/server';
import { whatsappService } from '@/services/whatsapp';
import { prisma } from '@/lib/prisma';

/** GET /api/admin/whatsapp-mode — Retorna status do Hub Dual-Engine e instâncias */
export async function GET() {
  try {
    const info = await whatsappService.getModeInfo();
    const [metaCount, baileysCount] = await Promise.all([
      prisma.whatsappInstance.count({ where: { engine: 'meta', active: true } }),
      prisma.whatsappInstance.count({ where: { engine: 'baileys', active: true } })
    ]);

    return NextResponse.json({
      ...info,
      metaCount,
      baileysCount
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro desconhecido' }, { status: 500 });
  }
}

/** 
 * POST /api/admin/whatsapp-mode
 * Suporta:
 * - { engine: 'meta' | 'baileys', enabled: boolean } -> Toggle independente
 * - { mode: 'meta' | 'baileys' | 'hybrid' } -> Alternância predefinida
 * - { action: 'restart', instanceId?: string } -> Reinicia sessão Baileys
 * - { action: 'logout' | 'disconnect', instanceId?: string, deleteData?: boolean } -> Graceful shutdown
 * - { action: 'connect', instanceId: string, name?: string } -> Conecta e gera QR code
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { engine, enabled, mode, action, instanceId, deleteData, name } = body;

    // Toggle independente de motor
    if (engine === 'meta' || engine === 'baileys') {
      await whatsappService.setEngineState(engine, Boolean(enabled));
      const info = await whatsappService.getModeInfo();
      return NextResponse.json({
        success: true,
        message: engine === 'meta'
          ? (enabled ? 'API Oficial da Meta ativada!' : 'API Oficial da Meta suspensa. Dados confidenciais preservados!')
          : (enabled ? 'WhatsApp Baileys ativado com sucesso!' : 'WhatsApp Baileys desconectado com sucesso.'),
        ...info
      });
    }

    // Ações de instância
    if (action === 'restart') {
      const forcePair = Boolean(body.forceNewPairing);
      await whatsappService.restartBaileys(instanceId, forcePair);
      const info = await whatsappService.getModeInfo();
      return NextResponse.json({
        success: true,
        message: 'Conexão reiniciada. Novo QR Code em geração...',
        ...info
      });
    }

    if (action === 'logout' || action === 'disconnect') {
      await whatsappService.logoutBaileys(instanceId, Boolean(deleteData));
      const info = await whatsappService.getModeInfo();
      return NextResponse.json({
        success: true,
        message: 'Aparelho desconectado com segurança (Graceful Shutdown).',
        ...info
      });
    }

    if (action === 'connect' && instanceId) {
      const forcePair = body.forceNewPairing !== false;
      await whatsappService.connectBaileysInstance(instanceId, name, forcePair);
      const info = await whatsappService.getModeInfo();
      return NextResponse.json({
        success: true,
        message: 'Conexão iniciada. Escaneie o QR Code para sincronizar.',
        ...info
      });
    }

    if (action === 'restart_server') {
      setTimeout(() => process.exit(0), 400);
      return NextResponse.json({
        success: true,
        message: 'Servidor reiniciando processo...'
      });
    }

    // Preset de modo
    if (mode === 'meta') {
      await whatsappService.setEngineState('meta', true);
      await whatsappService.setEngineState('baileys', false);
      const info = await whatsappService.getModeInfo();
      return NextResponse.json({
        success: true,
        message: 'Modo Meta Oficial ativado com sucesso.',
        ...info
      });
    }

    if (mode === 'baileys') {
      await whatsappService.setEngineState('meta', false);
      await whatsappService.setEngineState('baileys', true);
      const info = await whatsappService.getModeInfo();
      return NextResponse.json({
        success: true,
        message: 'Modo Baileys ativado com sucesso.',
        ...info
      });
    }

    if (mode === 'hybrid') {
      await whatsappService.setEngineState('meta', true);
      await whatsappService.setEngineState('baileys', true);
      const info = await whatsappService.getModeInfo();
      return NextResponse.json({
        success: true,
        message: 'Modo Híbrido Concorrente ativado! Ambos motores operando em paralelo.',
        ...info
      });
    }

    return NextResponse.json(
      { error: 'Parâmetro inválido. Envie engine/enabled, mode ou action.' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro desconhecido' }, { status: 500 });
  }
}

