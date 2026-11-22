import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/jwt';

export interface ManagerAuthUser {
  username: string;
  name: string;
  role?: string;
}

/**
 * Valida a autenticação de chamadas ao MikroGestor Manager (App mobile ou Web).
 * Suporta header 'Authorization: Bearer <token>' ou cookie 'system_auth'.
 */
export async function checkManagerAuth(request?: Request): Promise<ManagerAuthUser | null> {
  try {
    // 1. Tenta extrair Bearer token do header Authorization
    if (request) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.substring(7).trim();
        const payload = await verifyJwt(token);
        if (payload) {
          return {
            username: payload.username,
            name: payload.name,
            role: payload.role,
          };
        }
      }
    }

    // 2. Fallback para cookie system_auth
    const cookieStore = await cookies();
    const token = cookieStore.get('system_auth')?.value;
    if (token) {
      const payload = await verifyJwt(token);
      if (payload) {
        return {
          username: payload.username,
          name: payload.name,
          role: payload.role,
        };
      }
    }

    return null;
  } catch (err) {
    console.warn('[ManagerAuth] Falha na validação de token:', err);
    return null;
  }
}
