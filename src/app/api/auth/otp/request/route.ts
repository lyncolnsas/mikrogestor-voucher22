/**
 * POST /api/auth/otp/request
 * Etapa 1 do 2FA: valida usuário + senha, gera OTP e envia via WhatsApp.
 * Não emite o cookie JWT ainda — apenas confirma que as credenciais são válidas.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, dummyVerifyPassword } from '@/lib/auth-crypto';
import { loginRateLimiter } from '@/lib/rate-limiter';
import { createAdminOtp } from '@/lib/admin-otp';

import { signJwt } from '@/lib/jwt';
import { isVpsMode } from '@/lib/domain';

// Importa o serviço de WhatsApp via dynamic import para evitar problemas de inicialização
async function getWhatsappService() {
  const mod = await import('@/services/whatsapp');
  return mod.whatsappService;
}

export async function POST(request: Request) {
  const clientIp = loginRateLimiter.getClientIp(request);

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Usuário e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    const { username, password } = body;
    const cleanUsername = username.trim();

    // Rate limiting partilhado com o endpoint de login normal
    const rateStatus = loginRateLimiter.checkCompound(clientIp, cleanUsername);
    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Muitas tentativas incorretas. Tente novamente em ${Math.ceil(rateStatus.retryAfterSeconds / 60)} minuto(s).`,
        },
        { status: 429, headers: { 'Retry-After': String(rateStatus.retryAfterSeconds) } }
      );
    }

    // Busca o usuário
    const user = await prisma.user.findUnique({ where: { username: cleanUsername } });

    let credentialsValid = false;
    if (user) {
      const { isValid } = verifyPassword(password, user.password);
      credentialsValid = isValid;
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[AUTH DEBUG] Password check failed for '${cleanUsername}'. Provided length: ${password.length}, Stored hash starts with: ${user.password.slice(0, 15)}`);
      }
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[AUTH DEBUG] User not found in DB: '${cleanUsername}'`);
      }  // Timing attack mitigation
      dummyVerifyPassword(password);
    }

    if (!credentialsValid) {
      const failureResult = loginRateLimiter.recordFailure(clientIp, cleanUsername);
      console.warn(`[OTP REQUEST FAILED] Credenciais inválidas para '${cleanUsername}' do IP: ${clientIp}`);


      // Módulo 3: alerta de brute-force quando o bloqueio é atingido
      if (failureResult.blocked) {
        try {
          const waSvc = await getWhatsappService();
          const adminPhone = await prisma.systemConfig.findUnique({ where: { key: 'ADMIN_WHATSAPP_PHONE' } });
          if (adminPhone?.value) {
            const phone = adminPhone.value.replace(/\D/g, '');
            await waSvc.sendWhatsAppMessage(
              'admin',
              `${phone}@s.whatsapp.net`,
              `⚠️ *ALERTA DE SEGURANÇA — MikroGestor*\n\n` +
              `Foram detectadas múltiplas tentativas de login inválidas.\n\n` +
              `👤 Usuário alvo: *${cleanUsername}*\n` +
              `🌐 IP do atacante: *${clientIp}*\n` +
              `🕒 Horário: ${new Date().toLocaleString('pt-BR')}\n\n` +
              `O acesso desse IP foi bloqueado automaticamente por 15 minutos.`
            );
          }
        } catch (alertErr) {
          console.warn('[OTP] Falha ao enviar alerta de brute-force via WhatsApp:', alertErr);
        }

        return NextResponse.json(
          {
            success: false,
            message: `Muitas tentativas incorretas. Acesso bloqueado por ${Math.ceil(failureResult.retryAfterSeconds / 60)} minuto(s).`,
          },
          { status: 429 }
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
    }

    // Helper para emitir login direto
    const issueDirectLogin = async () => {
      loginRateLimiter.recordSuccess(clientIp, cleanUsername);
      const isHttps =
        request.url.startsWith('https://') ||
        request.headers.get('x-forwarded-proto') === 'https' ||
        isVpsMode();

      const token = await signJwt({
        username: user!.username,
        name: user!.name || 'Admin',
        role: user!.role || 'ADMIN',
      });

      const response = NextResponse.json({
        success: true,
        otpRequired: false,
        username: cleanUsername,
        name: user!.name || user!.username,
      });

      response.cookies.set('system_auth', token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60,
        path: '/',
      });

      return response;
    };

    // Credenciais válidas: verifica se 2FA está configurado
    const adminPhoneConfig = await prisma.systemConfig.findUnique({
      where: { key: 'ADMIN_WHATSAPP_PHONE' },
    });

    const adminPhone = adminPhoneConfig?.value?.replace(/\D/g, '');

    // Verifica se existem tokens de emergência cadastrados
    const emergencyTokensCount = await prisma.emergencyToken.count({ where: { used: false } });

    if (!adminPhone) {
      // 2FA não configurado → login direto autorizado com emissão do cookie
      console.log(`[OTP REQUEST] 2FA não configurado. Usuário '${cleanUsername}' logado diretamente.`);
      return await issueDirectLogin();
    }

    // Verifica se há algum chip WhatsApp conectado para enviar o OTP
    const connectedInstance = await prisma.whatsappInstance.findFirst({
      where: { status: 'connected', active: true },
    });

    if (!connectedInstance) {
      console.warn('[OTP REQUEST] Nenhum chip WhatsApp conectado.');
      // Se não há chip mas existem tokens de emergência cadastrados,
      // podemos oferecer o login com token offline de emergência para segurança máxima
      if (emergencyTokensCount > 0) {
        return NextResponse.json({
          success: true,
          otpRequired: false,
          emergencyFallback: true,
          message: 'WhatsApp desconectado. Utilize um Token de Emergência Offline.',
          username: cleanUsername,
        });
      }

      // Caso não haja chip nem tokens de emergência configurados, cai no login direto
      return await issueDirectLogin();
    }

    // Gera e envia o OTP
    const otpCode = await createAdminOtp(clientIp);
    const maskedPhone = adminPhone.slice(0, 4) + '****' + adminPhone.slice(-2);

    try {
      const waSvc = await getWhatsappService();
      await waSvc.sendWhatsAppMessage(
        'admin',
        `${adminPhone}@s.whatsapp.net`,
        `🔐 *Código de Acesso — MikroGestor*\n\n` +
        `Seu código de verificação é:\n\n` +
        `*${otpCode}*\n\n` +
        `⏱️ Este código expira em *5 minutos* e é de uso único.\n` +
        `Se não foi você, ignore esta mensagem e troque sua senha imediatamente.`
      );
    } catch (sendErr) {
      console.error('[OTP REQUEST] Falha ao enviar OTP via WhatsApp:', sendErr);
      if (emergencyTokensCount > 0) {
        return NextResponse.json({
          success: true,
          otpRequired: false,
          emergencyFallback: true,
          message: 'Erro no WhatsApp. Utilize um Token de Emergência Offline.',
          username: cleanUsername,
        });
      }
      return await issueDirectLogin();
    }

    console.log(`[OTP REQUEST] Código enviado para ${maskedPhone} para o usuário '${cleanUsername}'.`);

    return NextResponse.json({
      success: true,
      otpRequired: true,
      emergencyAvailable: emergencyTokensCount > 0,
      maskedPhone,
      username: cleanUsername,
    });
  } catch (error: any) {
    console.error('[OTP REQUEST UNHANDLED ERROR]', error?.stack || error);
    const detail = error?.message ? `: ${error.message}` : '';
    return NextResponse.json(
      { success: false, message: `Erro interno ao autenticar${process.env.NODE_ENV !== 'production' ? detail : '. Tente novamente.'}` },
      { status: 500 }
    );
  }
}

