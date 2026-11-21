import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MikrotikAPI } from '@/lib/routeros';

// Next.js 15: params is now a Promise
type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const { title, profile, price, active, uptimeLimit } = await request.json();
    const cleanProfile = typeof profile === 'string' ? profile.trim() || 'default' : undefined;
    const plan = await (prisma.whatsappPlan as any).update({
      where: { id },
      data: { 
        title, 
        ...(cleanProfile ? { profile: cleanProfile } : {}), 
        price: Number(price), 
        active,
        ...(uptimeLimit !== undefined ? { uptimeLimit } : {})
      }
    });

    // Se o profile foi alterado, garante a existência do novo perfil no MikroTik
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
        console.warn('[PlansAPI] Aviso ao sincronizar edição de profile no MikroTik:', mkErr);
      }
    }

    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const existingPlan = await (prisma.whatsappPlan as any).findUnique({ where: { id } });
    if (!existingPlan) {
      return NextResponse.json({ success: true });
    }

    await prisma.whatsappPlan.delete({
      where: { id }
    });

    // Se deletado do banco, verifica se mais algum plano usa este perfil; se não, deleta também do MikroTik
    const targetProfile = existingPlan.profile;
    if (targetProfile && targetProfile !== 'default' && targetProfile !== 'default-encryption') {
      try {
        const remainingCount = await (prisma.whatsappPlan as any).count({
          where: { profile: targetProfile }
        });

        if (remainingCount === 0) {
          const activeRouter = await prisma.router.findFirst({ where: { active: true } });
          if (activeRouter) {
            const mk = new MikrotikAPI();
            const connected = await mk.connect(activeRouter.host, activeRouter.user, activeRouter.password, activeRouter.port);
            if (connected) {
              await mk.removeHotspotProfile(targetProfile);
              console.log(`[PlansAPI] Profile "${targetProfile}" deletado do MikroTik após exclusão do plano.`);
              mk.disconnect();
            }
          }
        }
      } catch (mkErr) {
        console.warn('[PlansAPI] Aviso ao tentar remover profile do MikroTik após exclusão:', mkErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 });
  }
}
