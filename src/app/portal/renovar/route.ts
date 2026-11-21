import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signCustomerJwt } from '@/lib/jwt';
import { isVpsMode } from '@/lib/domain';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = url.searchParams.get('user')?.trim();
  const phone = url.searchParams.get('phone')?.trim();

  if (!user && !phone) {
    return NextResponse.redirect(new URL('/portal/planos', request.url));
  }

  const orConditions: any[] = [];
  if (user) orConditions.push({ hotspotUser: user });
  if (phone) {
    const raw = phone.replace(/\D/g, '');
    if (raw) {
      orConditions.push({ phone: { contains: raw } });
      orConditions.push({ whatsappNumber: { contains: raw } });
    }
  }

  const lead = await prisma.hotspotLead.findFirst({
    where: { OR: orConditions },
    orderBy: { createdAt: 'desc' }
  });

  if (!lead) {
    return NextResponse.redirect(new URL('/portal/planos', request.url));
  }

  const customerToken = await signCustomerJwt({
    leadId: lead.id,
    phone: lead.whatsappNumber || lead.phone,
    hotspotUser: lead.hotspotUser,
  });

  const isHttps =
    request.url.startsWith('https://') ||
    request.headers.get('x-forwarded-proto') === 'https' ||
    isVpsMode();

  const redirectUrl = new URL('/portal/planos', request.url);
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set('portal_session', customerToken, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 dias
    path: '/',
  });

  return response;
}
