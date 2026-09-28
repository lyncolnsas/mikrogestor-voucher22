import { cookies } from 'next/headers';
import { MikrotikAPI } from './routeros';
import { decryptData, encryptData } from './jwt';
import { prisma } from './prisma';

export class MikrotikSessionError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_SESSION' | 'INVALID_SESSION' | 'CONNECTION_FAILED'
  ) {
    super(message);
    this.name = 'MikrotikSessionError';
  }
}

/** Returns raw credentials from cookie or active database router without establishing a connection */
export async function getSessionCredentials(): Promise<{ ip: string; user: string; pass: string }> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('mikro_session');
    
    if (sessionCookie) {
      try {
        const decrypted = await decryptData(sessionCookie.value);
        if (decrypted?.ip && decrypted?.user) {
          return decrypted as { ip: string; user: string; pass: string };
        }
      } catch (err) {
        // Fallback to database if cookie decryption fails
      }
    }
  } catch {
    // cookies() unavailable outside request scope (background cron/tasks)
  }

  // Fallback to Database: find the active router (prefer VPN enabled with valid vpnIp)
  try {
    const activeRouter = await prisma.router.findFirst({
      where: {
        OR: [
          { active: true, vpnEnabled: true, vpnIp: { not: null } },
          { active: true },
        ],
      },
      orderBy: [
        { vpnEnabled: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (activeRouter && (activeRouter.vpnIp || activeRouter.host) && activeRouter.user) {
      return {
        ip: activeRouter.vpnEnabled && activeRouter.vpnIp ? activeRouter.vpnIp : activeRouter.host,
        user: activeRouter.user,
        pass: activeRouter.password || ''
      };
    }
  } catch (err) {
    // Silently ignore DB errors and fall through to throw
  }

  throw new MikrotikSessionError('Sessão não encontrada e nenhum roteador ativo configurado.', 'NO_SESSION');
}

/** Retorna o registro completo do roteador ativo no banco */
export async function getActiveRouterRecord() {
  try {
    return await prisma.router.findFirst({
      where: {
        OR: [
          { active: true, vpnEnabled: true, vpnIp: { not: null } },
          { active: true },
        ],
      },
      orderBy: [
        { vpnEnabled: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  } catch {
    return null;
  }
}

/** Connect to MikroTik — optionally override the IP (for reconnection to new IP) */
export async function getMikrotikClient(overrideIp?: string) {
  const credentials = await getSessionCredentials();

  if (overrideIp) {
    const mk = new MikrotikAPI();
    const connected = await mk.connect(overrideIp, credentials.user, credentials.pass);
    if (!connected) {
      throw new MikrotikSessionError(
        `Não foi possível conectar ao MikroTik em ${overrideIp}.`,
        'CONNECTION_FAILED'
      );
    }
    return mk;
  }

  // 1. Monta lista de roteadores candidatos a conexão
  const candidates: Array<{ id?: string; ip: string; user: string; pass: string }> = [];

  try {
    const routers = await prisma.router.findMany({
      where: {
        OR: [
          { vpnEnabled: true, vpnIp: { not: null } },
          { active: true },
        ],
      },
      orderBy: [
        { vpnEnabled: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    for (const r of routers) {
      const ip = (r.vpnEnabled && r.vpnIp) ? r.vpnIp : r.host;
      if (ip && !candidates.some(c => c.ip === ip)) {
        candidates.push({
          id: r.id,
          ip,
          user: r.user || credentials.user,
          pass: r.password !== null && r.password !== undefined && r.password !== '' ? r.password : credentials.pass,
        });
      }
    }
  } catch {}

  // Se o cookie tiver um IP diferente, adiciona como alternativa
  if (credentials.ip && !candidates.some(c => c.ip === credentials.ip)) {
    candidates.push({
      ip: credentials.ip,
      user: credentials.user,
      pass: credentials.pass,
    });
  }

  if (candidates.length === 0) {
    throw new MikrotikSessionError('Nenhum roteador configurado.', 'NO_SESSION');
  }

  // 2. Tenta conectar a todos os candidatos em PARALELO — o mais rápido a responder vence.
  // Isso elimina a lentidão de esperar N×timeout se houver IPs mortos na lista.
  const winner = await new Promise<{ mk: MikrotikAPI; cand: typeof candidates[0] } | null>((resolve) => {
    let resolved = false;
    let pending = candidates.length;

    candidates.forEach(async (cand) => {
      const mk = new MikrotikAPI();
      try {
        const connected = await mk.connect(cand.ip, cand.user, cand.pass);
        if (connected && !resolved) {
          resolved = true;
          resolve({ mk, cand });
        } else {
          mk.disconnect?.();
        }
      } catch {
        // ignore
      } finally {
        pending--;
        if (pending === 0 && !resolved) resolve(null);
      }
    });
  });

  if (winner) {
    const { mk, cand } = winner;
    if (cand.id) {
      prisma.router.update({
        where: { id: cand.id },
        data: { active: true, vpnStatus: 'connected', vpnLastSeen: new Date() },
      }).catch(() => {});
    }
    return mk;
  }

  throw new MikrotikSessionError(
    `Não foi possível conectar ao MikroTik (${candidates.map(c => c.ip).join(', ')}).`,
    'CONNECTION_FAILED'
  );
}


/** Update the session cookie with a new IP after provisioning changes the router IP */
export async function updateSessionIp(newIp: string): Promise<void> {
  const cookieStore = await cookies();
  const creds = await getSessionCredentials();
  const newToken = await encryptData({ ...creds, ip: newIp });
  cookieStore.set('mikro_session', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  });
}

