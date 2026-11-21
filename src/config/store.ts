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
  termsVersion: '2026-11-v5',
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
  /**
   * Limite de faturamento do MEI (R$ por ano). No ano de abertura, o limite é proporcional:
   * R$ 6.750 × meses desde a abertura (incluindo o mês de abertura). Confirme os valores com o contador.
   */
  mei: {
    annualLimit: 81_000,
    monthlyLimit: 6_750,
    openedAt: '', // data de abertura do CNPJ (AAAA-MM-DD), para o limite proporcional do 1º ano
  },
  /**
   * BUSCA POR SELFIE (reconhecimento facial). O comprador precisa aceitar este termo ANTES de cada busca;
   * o aceite fica registrado com a versão. Mude a versão sempre que mudar o texto.
   */
  faceSearch: {
    termsVersion: 'selfie-2026-11-v1',
    title: 'Termo de consentimento — busca por selfie',
    paragraphs: [
      'Para encontrar suas fotos, o site compara o rosto da sua selfie com os rostos das fotos deste evento (reconhecimento facial). O uso é opcional: se não concordar, você continua vendo a galeria completa e pode buscar pelo número da foto.',
      'A selfie é analisada no seu próprio aparelho. Ela não é enviada nem guardada. Só uma sequência de números que representa o rosto é enviada para a comparação, usada apenas nesta busca e descartada em seguida.',
      'Os rostos das fotos do evento são convertidos em sequências de números para permitir a busca. Esse índice é apagado junto com as fotos do evento, ao fim do prazo de venda e download.',
      'Fica registrado apenas que você aceitou este termo (data, hora, evento e versão do texto), sem nome, imagem ou outro dado seu.',
      'Use somente a sua própria selfie ou a de uma criança ou adolescente pelo qual você é responsável legal. Nesse caso, você consente em nome dele.',
      'O resultado pode ter erros (fotos de outras pessoas ou fotos suas que não aparecem). Confira as fotos antes de comprar.',
      'Base legal: consentimento (LGPD, art. 11, I, e art. 14, § 1º). Você pode pedir informações ou retirar o consentimento a qualquer momento pelo WhatsApp.',
    ],
    checkbox: 'Li e concordo com o uso da selfie (minha ou de quem sou responsável legal) para esta busca.',
  },
  /**
   * Armazenamento das fotos (Cloudflare R2). Cota exibida no painel: a gratuita do R2 é 10 GB.
   * Se contratar mais espaço, mude aqui.
   */
  storageQuotaGB: 10,
  /** Nome que aparece na fatura do cartão. */
  statementDescriptor: 'VENART',
} as const;
