import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const configMp = await prisma.systemConfig.findUnique({ where: { key: 'MERCADOPAGO_TOKEN' } });
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ['MANUAL_PIX_KEY', 'manual_pix_key', 'PIX_MANUAL_KEY'] } }
    });
    const manualKey = configs.find(c => Boolean(c.value?.trim()))?.value || '';
    
    return NextResponse.json({ 
      success: true, 
      token: configMp?.value ? '***' + configMp.value.slice(-4) : '',
      manualPixKey: manualKey
    });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { token, manualPixKey } = await request.json();
    
    if (token !== undefined && !token.includes('***')) {
      await prisma.systemConfig.upsert({
        where: { key: 'MERCADOPAGO_TOKEN' },
        update: { value: token.trim() },
        create: { key: 'MERCADOPAGO_TOKEN', value: token.trim() }
      });
    }

    if (manualPixKey !== undefined) {
      const cleanKey = String(manualPixKey).trim();
      await Promise.all([
        prisma.systemConfig.upsert({
          where: { key: 'MANUAL_PIX_KEY' },
          update: { value: cleanKey },
          create: { key: 'MANUAL_PIX_KEY', value: cleanKey }
        }),
        prisma.systemConfig.upsert({
          where: { key: 'manual_pix_key' },
          update: { value: cleanKey },
          create: { key: 'manual_pix_key', value: cleanKey }
        }),
        prisma.systemConfig.upsert({
          where: { key: 'PIX_MANUAL_KEY' },
          update: { value: cleanKey },
          create: { key: 'PIX_MANUAL_KEY', value: cleanKey }
        })
      ]);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
