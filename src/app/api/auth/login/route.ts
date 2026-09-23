import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { signJwt } from '@/lib/jwt';
import { hashPassword, verifyPassword, dummyVerifyPassword } from '@/lib/auth-crypto';
import { loginRateLimiter } from '@/lib/rate-limiter';
import { isVpsMode } from '@/lib/domain';

export async function POST(request: Request) {
  const clientIp = loginRateLimiter.getClientIp(request);

  try {
    // 1. Extração e validação prévia do corpo da requisição
    const body = await request.json().catch(() => null);
    if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Usuário e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    const { username, password } = body;
    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      return NextResponse.json(
        { success: false, message: 'Usuário e senha não podem estar em branco.' },
        { status: 400 }
      );
    }

    // 2. Verificação de Rate Limiting Composto (Protege contra força bruta no IP e Password Spraying na conta)
    const rateStatus = loginRateLimiter.checkCompound(clientIp, cleanUsername);
    if (!rateStatus.allowed) {
      console.warn(
        `[AUTH BLOCKED] IP: ${clientIp} ou Conta: '${cleanUsername}' bloqueados temporariamente por excesso de tentativas.`
      );
      return NextResponse.json(
        {
          success: false,
          message: `Muitas tentativas incorretas. Acesso bloqueado temporariamente. Tente novamente em ${Math.ceil(
            rateStatus.retryAfterSeconds / 60
          )} minuto(s).`,
          retryAfter: rateStatus.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateStatus.retryAfterSeconds),
          },
        }
      );
    }

    // 3. Salvaguarda contra lockout em ambiente novo (zero usuários no banco)
    const totalUsers = await prisma.user.count();
    if (totalUsers === 0) {
      // [SECURITY FIX CRIT-01] Gera senha aleatória segura em vez de '123'
      const tempPass = crypto.randomBytes(8).toString('hex'); // 16 chars hex (128 bits)
      console.warn(
        `\n\n⚠️  ══════════════════════════════════════════════════════════` +
        `\n⚠️   PRIMEIRO ACESSO — MikroGestor` +
        `\n⚠️   Usuário:  admin` +
        `\n⚠️   Senha:    ${tempPass}` +
        `\n⚠️   TROQUE IMEDIATAMENTE em: Dashboard → Configurações → Segurança` +
        `\n⚠️  ══════════════════════════════════════════════════════════\n`
      );
      await prisma.user.create({
        data: {
          username: 'admin',
          password: hashPassword(tempPass),
          name: 'Administrador',
          role: 'ADMIN',
        },
      });
    }

    // 4. Busca do usuário no banco SQLite
    const user = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    // 5. Verificação da senha com tempo constante e auto-migração para hash seguro
    if (user) {
      const { isValid, needsUpgrade } = verifyPassword(password, user.password);

      if (isValid) {
        // Se a senha estiver em texto claro herdado, atualiza imediatamente para hash scrypt com salt
        if (needsUpgrade) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { password: hashPassword(password) },
            });
            console.log(
              `[AUTH MIGRATION] Senha do usuário '${user.username}' migrada com sucesso para hash seguro (scrypt).`
            );
          } catch (migrationError) {
            console.error(
              '[AUTH MIGRATION ERROR] Falha ao persistir hash atualizado:',
              migrationError
            );
          }
        }

        // Reseta o histórico de falhas do IP e da conta
        loginRateLimiter.recordSuccess(clientIp, cleanUsername);
        console.log(
          `[AUTH SUCCESS] Usuário '${user.username}' autenticado com sucesso a partir do IP: ${clientIp}.`
        );

        const isHttps =
          request.url.startsWith('https://') ||
          request.headers.get('x-forwarded-proto') === 'https' ||
          isVpsMode();

        const token = await signJwt({
          username: user.username,
          name: user.name || 'Admin',
          role: user.role || 'ADMIN',
        });

        const response = NextResponse.json({
          success: true,
          name: user.name || user.username,
        });

        response.cookies.set('system_auth', token, {
          httpOnly: true,
          secure: isHttps,
          sameSite: 'lax',
          maxAge: 8 * 60 * 60, // 8 hours
          path: '/',
        });

        return response;
      }
    } else {
      // Mitigação de timing attack: consome os mesmos ciclos de CPU que um usuário existente (CWE-208 / CWE-204)
      dummyVerifyPassword(password);
    }

    // 6. Registro de falha no Rate Limiter (IP e conta) e resposta segura
    const failureResult = loginRateLimiter.recordFailure(clientIp, cleanUsername);
    console.warn(
      `[AUTH FAILED] Tentativa inválida para usuário '${cleanUsername}' a partir do IP: ${clientIp}. Tentativas restantes: ${failureResult.remainingAttempts}`
    );

    if (failureResult.blocked) {
      return NextResponse.json(
        {
          success: false,
          message: `Muitas tentativas incorretas. Acesso bloqueado temporariamente por ${Math.ceil(
            failureResult.retryAfterSeconds / 60
          )} minuto(s).`,
          retryAfter: failureResult.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(failureResult.retryAfterSeconds),
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Usuário ou senha incorretos.',
        remainingAttempts: failureResult.remainingAttempts,
      },
      { status: 401 }
    );
  } catch (error) {
    console.error('[AUTH LOGIN UNHANDLED ERROR]', {
      clientIp,
      error: error instanceof Error ? error.stack || error.message : error,
    });
    return NextResponse.json(
      {
        success: false,
        message: 'Erro interno ao processar autenticação. Tente novamente mais tarde.',
      },
      { status: 500 }
    );
  }
}
