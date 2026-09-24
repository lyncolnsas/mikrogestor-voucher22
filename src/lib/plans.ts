import { prisma } from '@/lib/prisma';

export const DEFAULT_PLANS = [
  { title: '1 Hora', profile: 'default', price: 3.00, uptimeLimit: '01:00:00', active: true },
  { title: '1 Dia', profile: 'default', price: 5.00, uptimeLimit: '1d 00:00:00', active: true },
  { title: '7 Dias', profile: 'default', price: 15.00, uptimeLimit: '7d 00:00:00', active: true },
  { title: '30 Dias', profile: 'default', price: 35.00, uptimeLimit: '30d 00:00:00', active: true },
];

/**
 * Retorna os planos ativos do sistema ou semeia os planos padrão de fábrica se a tabela estiver vazia
 */
export async function getOrSeedDefaultPlans() {
  try {
    let plans = await prisma.whatsappPlan.findMany({
      where: { active: true },
      orderBy: { price: 'asc' }
    });

    if (plans.length === 0) {
      const totalCount = await prisma.whatsappPlan.count();
      if (totalCount === 0) {
        for (const p of DEFAULT_PLANS) {
          await prisma.whatsappPlan.create({ data: p });
        }
        plans = await prisma.whatsappPlan.findMany({
          where: { active: true },
          orderBy: { price: 'asc' }
        });
      }
    }

    return plans;
  } catch (err) {
    console.error('[Plans] Erro ao carregar ou semear planos:', err);
    return [];
  }
}
