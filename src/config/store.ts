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
  termsVersion: '2026-11-v3',
  /** Parcelas no cartão. 1 = só à vista. (Decisão 0.3 do checklist: pendente.) */
  maxInstallments: 1,
  /** Tempo para pagar antes de o pedido expirar (horas). */
  pendingHours: 24,
  /** Máximo de fotos por pedido. */
  maxPhotosPerOrder: 500,
  /**
   * Dados do vendedor exibidos nos Termos de compra (exigidos para venda pela internet — Decreto 7.962/2013).
   * Preencha quando o CNPJ do MEI estiver ativo. Enquanto vazio, a linha não aparece.
   */
  seller: {
    legalName: 'GUSTAVO VENANCIO SALES DE SOUZA', // razão social do MEI (como aparece no CNPJ)
    cnpj: '68.729.010/0001-04',
    address: '', // endereço (pendente: o do cadastro do MEI ou um comercial)
  },
  /** Nome que aparece na fatura do cartão. */
  statementDescriptor: 'VENART',
} as const;
