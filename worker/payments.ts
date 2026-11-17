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

/** Valor de PAYMENT_PROVIDER escrito de qualquer jeito ("Mercado Pago", " mercadopago ", "MP"…). */
export function preferred(v: string | undefined): Provider | null {
  const s = (v ?? '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  if (['mercadopago', 'mp', 'mercado'].includes(s)) return 'mercadopago';
  if (['infinitepay', 'infinite', 'infinity', 'infinitypay', 'ip'].includes(s)) return 'infinitepay';
  return null;
}

export function provider(env: PaymentsEnv): Provider | null {
  const ip = !!ipHandle(env);
  const mp = !!env.MP_ACCESS_TOKEN?.trim();
  const want = preferred(env.PAYMENT_PROVIDER);
  if (want === 'mercadopago' && mp) return 'mercadopago';
  if (want === 'infinitepay' && ip) return 'infinitepay';
  return ip ? 'infinitepay' : mp ? 'mercadopago' : null;
}

/** Diagnóstico para o painel (sem revelar nenhum segredo). */
export const paymentStatus = (env: PaymentsEnv) => ({
  active: provider(env),
  infinitepay: !!ipHandle(env),
  mercadopago: !!env.MP_ACCESS_TOKEN?.trim(),
  mercadopagoTest: /^TEST-/.test(env.MP_ACCESS_TOKEN?.trim() ?? ''),
  webhookSecret: !!env.MP_WEBHOOK_SECRET?.trim(),
  preferred: preferred(env.PAYMENT_PROVIDER),
  preferredRaw: !!env.PAYMENT_PROVIDER,
});

export const PROVIDER_NAMES: Record<Provider, string> = { infinitepay: 'InfinitePay', mercadopago: 'Mercado Pago' };
