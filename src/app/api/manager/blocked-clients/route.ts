import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkManagerAuth } from '@/lib/manager-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await checkManagerAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const blockedList = await prisma.blockedClient.findMany({
      where: { active: true },
      orderBy: { blockedAt: 'desc' },
      take: 100,
    });

    // Enriquecer registros com informações dos Leads/Pagamentos correspondentes
    const enriched = await Promise.all(
      blockedList.map(async (item) => {
        let lead = null;
        let payment = null;

        if (item.cpf || item.phone) {
          lead = await prisma.hotspotLead.findFirst({
            where: {
              OR: [
                ...(item.cpf ? [{ cpf: item.cpf }] : []),
                ...(item.phone ? [{ phone: item.phone }] : []),
              ],
            },
            orderBy: { createdAt: 'desc' },
          });
        }

        if (lead) {
          payment = await prisma.payment.findFirst({
            where: { leadId: lead.id },
            orderBy: { createdAt: 'desc' },
          });
        } else if (item.mac) {
          payment = await prisma.payment.findFirst({
            where: { macAddress: item.mac },
            orderBy: { createdAt: 'desc' },
            include: { lead: true },
          });
          if (payment?.lead) lead = payment.lead;
        }

        return {
          id: item.id,
          mac: item.mac,
          cpf: item.cpf,
          phone: item.phone || lead?.phone,
          name: lead?.name || 'Cliente Bloqueado',
          reason: item.reason || 'Tempo de cortesia expirado (15 min)',
          blockedAt: item.blockedAt,
          routerId: null,
          paymentId: payment?.id || null,
          paymentStatus: payment?.status || 'pending',
          hotspotUser: lead?.hotspotUser || null,
          profile: payment?.profile || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enriched,
      total: enriched.length,
    });
  } catch (error: any) {
    console.error('[Manager API] Erro ao listar bloqueados:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Erro ao carregar lista de bloqueados.' },
      { status: 500 }
    );
  }
}
