/**
 * LOJA DE FOTOS — configurações da venda online (Fase 2)
 * ------------------------------------------------------------------
 * Pagamento: Mercado Pago (Checkout Pro). As credenciais NUNCA ficam aqui:
 *   MP_ACCESS_TOKEN   → segredo na Cloudflare (Access Token: de teste ou de produção)
 *   MP_WEBHOOK_SECRET → segredo na Cloudflare (assinatura das notificações)
 * Sem MP_ACCESS_TOKEN, a galeria continua com o pedido pelo WhatsApp.
 */
export const store = {
  /** Versão dos Termos de compra aceitos (fica gravada em cada pedido). Mude ao alterar os termos. */
  termsVersion: '2026-11-v1',
  /** Parcelas no cartão. 1 = só à vista. (Decisão 0.3 do checklist: pendente.) */
  maxInstallments: 1,
  /** Tempo para pagar antes de o pedido expirar (horas). */
  pendingHours: 24,
  /** Máximo de fotos por pedido. */
  maxPhotosPerOrder: 500,
  /** Nome que aparece na fatura do cartão. */
  statementDescriptor: 'VENART',
} as const;
