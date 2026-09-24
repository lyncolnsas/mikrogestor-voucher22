import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrSeedDefaultPlans } from '@/lib/plans';

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
    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
  }
}
