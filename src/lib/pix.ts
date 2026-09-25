// src/lib/pix.ts

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

export function generatePixPayload(key: string, amount: number, name: string = 'MIKROGESTOR', city: string = 'SAO PAULO', txId: string = '***'): string {
  const sanitize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, "").substring(0, 25).trim().toUpperCase() || 'MIKROGESTOR';

  const cleanKey = key.trim();
  const formatLength = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

  const gui = formatLength('00', 'br.gov.bcb.pix');
  const keyFmt = formatLength('01', cleanKey);
  const merchantAccountInfo = formatLength('26', gui + keyFmt);

  const mcc = formatLength('52', '0000');
  const currency = formatLength('53', '986');
  const amountStr = formatLength('54', amount.toFixed(2));
  const countryCode = formatLength('58', 'BR');
  const merchantName = formatLength('59', sanitize(name));
  const merchantCity = formatLength('60', sanitize(city));
  
  const additionalData = formatLength('62', formatLength('05', txId));

  const payload = [
    formatLength('00', '01'),
    merchantAccountInfo,
    mcc,
    currency,
    amountStr,
    countryCode,
    merchantName,
    merchantCity,
    additionalData,
    '6304' // CRC16 will be appended here
  ].join('');

  return payload + crc16(payload);
}

/**
 * Obtém a chave PIX manual configurada no sistema.
 * Retorna string vazia caso nenhuma chave esteja configurada ou preenchida.
 */
export async function getEffectivePixKey(): Promise<string> {
  const { prisma } = await import('@/lib/prisma');
  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: { in: ['MANUAL_PIX_KEY', 'manual_pix_key', 'PIX_MANUAL_KEY', 'ADMIN_WHATSAPP_PHONE'] }
      }
    });
    const configMap: Record<string, string> = {};
    for (const c of configs) {
      if (c.value && c.value.trim()) {
        configMap[c.key] = c.value.trim();
      }
    }

    const key = configMap['MANUAL_PIX_KEY'] || configMap['manual_pix_key'] || configMap['PIX_MANUAL_KEY'] || configMap['ADMIN_WHATSAPP_PHONE'];
    if (key && key.trim()) return key.trim();

    // Se nenhuma chave manual foi preenchida no painel financeiro, verifica número do WhatsApp conectado
    const wa = await prisma.whatsappInstance.findFirst({
      where: { status: 'connected', number: { not: null } }
    });
    const waNum = wa?.number?.replace(/\D/g, '');
    if (waNum && waNum.length >= 8) return waNum;
  } catch (err) {
    console.error('[Pix] Erro ao buscar chave PIX efetiva:', err);
  }

  // Nenhuma chave configurada — nunca retornar chave inventada/chumbada
  return '';
}

/**
 * Verifica se existe alguma forma de pagamento PIX configurada (Mercado Pago ou Chave Manual)
 */
export async function hasConfiguredPaymentMethod(): Promise<{ hasMercadoPago: boolean; hasManualPix: boolean; mpToken?: string; manualKey?: string }> {
  const { prisma } = await import('@/lib/prisma');
  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: { in: ['MERCADOPAGO_TOKEN', 'mercadopago_token', 'mercadoPagoToken', 'mercadopago_access_token', 'MANUAL_PIX_KEY', 'manual_pix_key', 'PIX_MANUAL_KEY'] }
      }
    });
    const map: Record<string, string> = {};
    for (const c of configs) {
      if (c.value && c.value.trim()) map[c.key] = c.value.trim();
    }

    const mpToken = map['MERCADOPAGO_TOKEN'] || map['mercadopago_token'] || map['mercadoPagoToken'] || map['mercadopago_access_token'] || '';
    const manualKey = map['MANUAL_PIX_KEY'] || map['manual_pix_key'] || map['PIX_MANUAL_KEY'] || '';

    return {
      hasMercadoPago: Boolean(mpToken && mpToken.trim() && !mpToken.startsWith('TEST-') && mpToken !== 'test'),
      hasManualPix: Boolean(manualKey && manualKey.trim()),
      mpToken: mpToken || undefined,
      manualKey: manualKey || undefined
    };
  } catch {
    return { hasMercadoPago: false, hasManualPix: false };
  }
}


