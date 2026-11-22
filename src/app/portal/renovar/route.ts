import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signCustomerJwt } from '@/lib/jwt';
import { isVpsMode } from '@/lib/domain';

export const dynamic = 'force-dynamic';

function getPublicRedirectUrl(path: string, request: Request, isHttps: boolean) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const reqHost = request.headers.get('host') || '';
  const host = forwardedHost || (reqHost && !reqHost.startsWith('0.0.0.0') && !reqHost.startsWith('127.0.0.1') ? reqHost : 'mikrogestor.com');
  const cleanHost = host.replace(/:80$/, '').replace(/:443$/, '');
  const protocol = isHttps || request.headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  return new URL(path, `${protocol}://${cleanHost}`);
}

export async function GET(request: Request) {
  const isHttps =
    request.url.startsWith('https://') ||
    request.headers.get('x-forwarded-proto') === 'https' ||
    isVpsMode();

  const url = new URL(request.url);
  const user = url.searchParams.get('user')?.trim();
  const phone = url.searchParams.get('phone')?.trim();

  if (!user && !phone) {
    return NextResponse.redirect(getPublicRedirectUrl('/portal/planos', request, isHttps));
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
    return NextResponse.redirect(getPublicRedirectUrl('/portal/planos', request, isHttps));
  }

  const customerToken = await signCustomerJwt({
    leadId: lead.id,
    phone: lead.whatsappNumber || lead.phone,
    hotspotUser: lead.hotspotUser,
  });

  const redirectUrl = getPublicRedirectUrl('/portal/planos', request, isHttps);
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
