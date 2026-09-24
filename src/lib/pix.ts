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
 * Obtém a chave PIX manual configurada no sistema com fallback inteligente
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
    for (const c of configs) configMap[c.key] = c.value;

    const key = configMap['MANUAL_PIX_KEY'] || configMap['manual_pix_key'] || configMap['PIX_MANUAL_KEY'] || configMap['ADMIN_WHATSAPP_PHONE'];
    if (key && key.trim()) return key.trim();

    // Se nenhuma chave foi digitada no painel financeiro, usa o número do primeiro WhatsApp conectado
    const wa = await prisma.whatsappInstance.findFirst({
      where: { status: 'connected', number: { not: null } }
    });
    if (wa?.number) return wa.number.replace(/\D/g, '');
  } catch (err) {
    console.error('[Pix] Erro ao buscar chave PIX efetiva:', err);
  }

  return '4497743598'; // Fallback final
}

