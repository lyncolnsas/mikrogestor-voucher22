import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJwt } from '@/lib/jwt';

// Rotas públicas explícitas sob /api/portal/ permitidas para clientes e Hotspot
const PUBLIC_PORTAL_API_PREFIXES = [
  '/api/portal/register',
  '/api/portal/customer/',
  '/api/portal/status',
  '/api/portal/payment-status',
  '/api/portal/safari-bypass',
  '/api/portal/whatsapp-flow/',
  '/api/portal/whatsapp-redirect',
  '/api/portal/whatsapp-support',
  '/api/portal/waiting-list',
  '/api/portal/asset',
  '/api/portal/bg',
  '/api/portal/logo',
  '/api/portal/preview',
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  const isPublicPortalApi = PUBLIC_PORTAL_API_PREFIXES.some((prefix) => path.startsWith(prefix));

  // Define rotas públicas
  const isPublicRoute = 
    path === '/' || 
    path === '/login' ||
    path.startsWith('/api/auth') || 
    path.startsWith('/portal') || 
    isPublicPortalApi || 
    path.startsWith('/api/webhook') ||
    path.startsWith('/uploads/') ||
    path.startsWith('/fonts') ||
    path === '/icon.png' ||
    (path.startsWith('/api/vpn/router/') && path.includes('/cert-file'));

  
  const token = request.cookies.get('system_auth')?.value;
  
  // Se não estiver logado e tentar acessar rota protegida, redireciona
  if (!isPublicRoute && !token) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Valida o token se ele existir
  if (token) {
    const payload = await verifyJwt(token);
    
    // Se o token for inválido, limpa o cookie e redireciona/rejeita
    if (!payload) {
      if (path.startsWith('/api/')) {
        const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        response.cookies.delete('system_auth');
        return response;
      }
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.delete('system_auth');
      return response;
    }
    
    // Se estiver logado e tentar acessar a página de login, manda pro dashboard
    if (path === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

// Configura quais rotas o middleware deve rodar
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|fonts|uploads).*)'],
};
