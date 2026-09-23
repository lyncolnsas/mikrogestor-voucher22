/**
 * Helpers de OTP (One-Time Password) para autenticação em dois fatores do painel admin.
 * - Gera código de 6 dígitos
 * - Persiste no banco AdminOtp com expiração de 5 minutos
 * - Valida e consome o OTP (uso único)
 * - Deleta OTPs expirados automaticamente
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';


const OTP_TTL_MINUTES = 5;
const OTP_LENGTH = 6;

/** Gera um código numérico de 6 dígitos com CSPRNG (crypto.randomInt) */
function generateNumericCode(): string {
  // [SECURITY FIX MED-02] Usa crypto.randomInt (CSPRNG) em vez de Math.random (PRNG fraco)
  const num = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return String(num).padStart(OTP_LENGTH, '0');
}


/** Cria um novo OTP no banco e retorna o código gerado */
export async function createAdminOtp(clientIp?: string): Promise<string> {
  // Limpa OTPs antigos expirados (janitor passivo)
  await prisma.adminOtp.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  const code = generateNumericCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.adminOtp.create({
    data: { code, expiresAt, clientIp: clientIp ?? null, used: false },
  });

  return code;
}

export type OtpValidationResult =
  | { valid: true }
  | { valid: false; reason: 'not_found' | 'expired' | 'already_used' };

/** Verifica o código informado, marca como usado e retorna o resultado */
export async function validateAdminOtp(code: string): Promise<OtpValidationResult> {
  const trimmed = code.trim();

  const otp = await prisma.adminOtp.findFirst({
    where: { code: trimmed },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) return { valid: false, reason: 'not_found' };
  if (otp.used) return { valid: false, reason: 'already_used' };
  if (otp.expiresAt < new Date()) {
    // Marca como usado para evitar tentativas repetidas de expirado
    await prisma.adminOtp.update({ where: { id: otp.id }, data: { used: true } });
    return { valid: false, reason: 'expired' };
  }

  // Consome o OTP — uso único
  await prisma.adminOtp.update({ where: { id: otp.id }, data: { used: true } });
  return { valid: true };
}
