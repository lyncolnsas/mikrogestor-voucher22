import { MercadoPagoConfig, Payment, Preference, Order } from 'mercadopago';

/**
 * Sanitiza e garante um e-mail com formato e TLD válidos aceitos pelo validador do Mercado Pago.
 * Evita o erro HTTP 400 'payer.email must be a valid email' quando o cliente não informa e-mail no Hotspot.
 */
export function formatValidPayerEmail(rawEmail?: string | null, fallbackUsername?: string | null): string {
  if (rawEmail && typeof rawEmail === 'string') {
    const trimmed = rawEmail.trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(trimmed) && !trimmed.endsWith('.local')) {
      return trimmed;
    }
  }

  const clean = (fallbackUsername || 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase();

  const userPart = clean && clean.length > 0 ? clean : 'cliente';
  return `${userPart}@mikrogestor.com`;
}

export class MercadoPagoService {
  private client: MercadoPagoConfig;

  constructor(accessToken: string) {
    this.client = new MercadoPagoConfig({ accessToken });
  }

  static async init(accessToken: string) {
    return new MercadoPagoService(accessToken);
  }

  /**
   * Cria um pagamento PIX direto (Checkout Transparente)
   * Retorna o ID do pagamento, QR Code e Pix Copia e Cola instantâneo.
   */
  async createPixPayment(data: {
    transaction_amount: number;
    description: string;
    payer: {
      email: string;
      first_name?: string;
      identification?: { type: string; number: string };
    };
  }) {
    const payment = new Payment(this.client);
    const safeEmail = formatValidPayerEmail(data.payer.email, data.payer.first_name);
    
    try {
      const result = await payment.create({
        body: {
          transaction_amount: data.transaction_amount,
          description: data.description,
          payment_method_id: 'pix',
          payer: {
            email: safeEmail,
            first_name: data.payer.first_name || 'Cliente',
            identification: data.payer.identification,
          },
        }
      });
      return result;
    } catch (error) {
      console.error('[MercadoPago] Erro ao criar pagamento PIX:', error);
      throw error;
    }
  }

  /**
   * Consulta o status de um pagamento pelo ID
   */
  async getPayment(paymentId: string | number) {
    const payment = new Payment(this.client);
    return payment.get({ id: String(paymentId) });
  }

  /**
   * Cria uma Ordem de Pagamento no formato Checkout Pro (Nova Orders API)
   * Suporta cartões, pix, boleto e saldo Mercado Pago redirecionando para a checkout_url.
   */
  async createOrder(data: {
    total_amount: number;
    external_reference: string;
    description: string;
    payerEmail: string;
    backUrls?: {
      success?: string;
      pending?: string;
      failure?: string;
    };
  }) {
    const order = new Order(this.client);
    try {
      const result = await order.create({
        body: {
          type: 'online',
          processing_mode: 'manual',
          total_amount: data.total_amount.toFixed(2),
          external_reference: data.external_reference,
          items: [
            {
              id: data.external_reference,
              title: data.description,
              unit_price: data.total_amount.toFixed(2),
              quantity: 1,
              tangible: false,
            }
          ],
          payer: {
            email: data.payerEmail
          },
          back_urls: data.backUrls,
          auto_return: 'approved'
        } as any
      });
      return result;
    } catch (error) {
      console.error('[MercadoPago] Erro ao criar Checkout Pro Order:', error);
      throw error;
    }
  }

  /**
   * Cria uma Preferência clássica de Checkout Pro (Preference API)
   */
  async createPreference(data: {
    title: string;
    unit_price: number;
    quantity?: number;
    external_reference?: string;
    payerEmail?: string;
    backUrls?: {
      success?: string;
      pending?: string;
      failure?: string;
    };
  }) {
    const preference = new Preference(this.client);
    try {
      const result = await preference.create({
        body: {
          items: [
            {
              id: data.external_reference || 'voucher',
              title: data.title,
              unit_price: data.unit_price,
              quantity: data.quantity || 1,
            }
          ],
          external_reference: data.external_reference,
          payer: data.payerEmail ? { email: data.payerEmail } : undefined,
          back_urls: data.backUrls,
          auto_return: 'approved'
        }
      });
      return result;
    } catch (error) {
      console.error('[MercadoPago] Erro ao criar Preferência Checkout Pro:', error);
      throw error;
    }
  }
}
