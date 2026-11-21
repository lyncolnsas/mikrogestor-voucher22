import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrSeedDefaultPlans } from '@/lib/plans';
import { MikrotikAPI } from '@/lib/routeros';

export async function GET() {
  try {
    let plans = await prisma.whatsappPlan.findMany({
      orderBy: { price: 'asc' }
    });
    if (plans.length === 0) {
      plans = await getOrSeedDefaultPlans();
    }
    return NextResponse.json(plans);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, profile, price, active, uptimeLimit } = await request.json();
    const cleanProfile = typeof profile === 'string' ? profile.trim() || 'default' : 'default';
    const plan = await (prisma.whatsappPlan as any).create({
      data: { 
        title, 
        profile: cleanProfile, 
        price: Number(price), 
        active: active !== undefined ? Boolean(active) : true,
        uptimeLimit: uptimeLimit || 'none'
      }
    });

    // Sincroniza automaticamente o perfil no MikroTik sem necessidade de criar manualmente no Winbox
    if (cleanProfile && cleanProfile !== 'default') {
      try {
        const activeRouter = await prisma.router.findFirst({ where: { active: true } });
        if (activeRouter) {
          const mk = new MikrotikAPI();
          const connected = await mk.connect(activeRouter.host, activeRouter.user, activeRouter.password, activeRouter.port);
          if (connected) {
            await mk.ensureHotspotProfile(cleanProfile, `MikroGestor: Plano ${title} (R$ ${price})`);
            mk.disconnect();
          }
        }
      } catch (mkErr) {
        console.warn('[PlansAPI] Aviso: plano salvo no banco, mas erro ao sincronizar perfil no MikroTik:', mkErr);
      }
    }

    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
  }
}
