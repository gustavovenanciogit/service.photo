/**
 * Qual meio de pagamento a loja usa.
 *   InfinitePay  → INFINITEPAY_HANDLE (seu @ na InfinitePay, sem o @) e, opcional, o segredo INFINITEPAY_API_KEY
 *   Mercado Pago → segredos MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET
 * Com os dois configurados, vale PAYMENT_PROVIDER ("infinitepay" ou "mercadopago"); sem ele, a InfinitePay.
 * Sem nenhum, a galeria continua com o pedido pelo WhatsApp.
 */
export type Provider = 'infinitepay' | 'mercadopago';

export interface PaymentsEnv {
  MP_ACCESS_TOKEN?: string;
  MP_WEBHOOK_SECRET?: string;
  INFINITEPAY_HANDLE?: string;
  INFINITEPAY_API_KEY?: string;
  PAYMENT_PROVIDER?: string;
  /** Só para testes locais (simuladores). Em produção ficam vazios. */
  MP_API_BASE?: string;
  IP_API_BASE?: string;
}

export const ipHandle = (env: PaymentsEnv) => (env.INFINITEPAY_HANDLE ?? '').trim().replace(/^[@$]/, '');

export function provider(env: PaymentsEnv): Provider | null {
  const ip = !!ipHandle(env);
  const mp = !!env.MP_ACCESS_TOKEN;
  if (env.PAYMENT_PROVIDER === 'mercadopago' && mp) return 'mercadopago';
  if (env.PAYMENT_PROVIDER === 'infinitepay' && ip) return 'infinitepay';
  return ip ? 'infinitepay' : mp ? 'mercadopago' : null;
}

export const PROVIDER_NAMES: Record<Provider, string> = { infinitepay: 'InfinitePay', mercadopago: 'Mercado Pago' };
