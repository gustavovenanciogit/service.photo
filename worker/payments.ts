/**
 * Meio de pagamento da loja: Mercado Pago (Checkout Pro).
 *   Segredos na Cloudflare: MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET.
 *   Sem MP_ACCESS_TOKEN, a galeria volta ao pedido pelo WhatsApp.
 */
export interface PaymentsEnv {
  MP_ACCESS_TOKEN?: string;
  MP_WEBHOOK_SECRET?: string;
  /** Só para testes locais (simulador). Em produção fica vazio. */
  MP_API_BASE?: string;
}

export const mpConfigured = (env: PaymentsEnv) => !!env.MP_ACCESS_TOKEN?.trim();

/** Diagnóstico para o painel (sem revelar nenhum segredo). */
export const paymentStatus = (env: PaymentsEnv) => ({
  active: mpConfigured(env) ? ('mercadopago' as const) : null,
  mercadopagoTest: /^TEST-/.test(env.MP_ACCESS_TOKEN?.trim() ?? ''),
  webhookSecret: !!env.MP_WEBHOOK_SECRET?.trim(),
});
