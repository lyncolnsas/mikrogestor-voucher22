import { NextResponse } from 'next/server';
import { planExpirationService } from '@/services/plan-expiration-service';

export const dynamic = 'force-dynamic';

/**
 * Endpoint de Varredura e Bloqueio Categórico de Inadimplentes (15 minutos)
 * e Disparo de Aviso Prévio de Renovação (10 minutos antes de vencer o plano).
 */
export async function GET() {
  try {
    const result = await planExpirationService.checkAll();
    return NextResponse.json({
      success: true,
      processed: result
    });
  } catch (error: any) {
    console.error('[Check-Expirations] Erro:', error);
    return NextResponse.json({
      success: false,
      message: error?.message || 'Erro ao processar expirações e renovações.'
    }, { status: 500 });
  }
}
