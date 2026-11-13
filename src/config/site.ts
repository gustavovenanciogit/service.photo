/**
 * CONFIGURAÇÕES CENTRAIS DO SITE
 * ------------------------------------------------------------------
 * Tudo que é contato, nome e links fica aqui. Altere e salve:
 * o site inteiro passa a usar os novos valores.
 *
 * Links vazios (Instagram, Fotto, e-mail) ficam escondidos no site
 * (não publica link quebrado).
 */

export const site = {
  /** Nome profissional exibido no topo, rodapé e SEO. */
  name: 'Venart Fotógrafo',
  /** Nome curto (logo do menu). */
  shortName: 'VENART',
  /** Linha de apoio do logo. */
  tagline: 'Fotografia esportiva & comercial',

  city: 'Manaus',
  state: 'Amazonas',
  stateCode: 'AM',

  /**
   * WhatsApp no formato internacional, só números: 55 + DDD + número.
   * Se ficar vazio, os botões abrem o WhatsApp sem destinatário.
   */
  whatsappNumber: '5592986066741',
  /** Número formatado para exibição. */
  whatsappDisplay: '(92) 98606-6741',

  /** Usuário do Instagram, sem @. */
  instagramUser: 'venart_mid',

  /** Link da sua página na Fotto (venda de fotos esportivas). */
  fottoUrl: 'https://www.fotto.com.br/venart',

  /** Identificação da tabela de preços vigente. */
  priceTable: 'Tabela 2026',

  /** E-mail público (opcional). */
  email: '',

  seo: {
    defaultTitle: 'Fotógrafo em Manaus | Fotografia esportiva, lutas, ensaios e eventos',
    defaultDescription:
      'Fotografia esportiva, ensaios e cobertura de eventos em Manaus. Conheça os serviços, consulte os pacotes e solicite seu orçamento pelo WhatsApp.',
    /** Imagem de compartilhamento (Open Graph), dentro de /public. */
    ogImage: '/og-image.png',
    locale: 'pt_BR',
  },
} as const;

/**
 * Condições de pagamento (página 06 da tabela).
 * Aparecem na tabela de preços, na categoria "Extras e pagamento" e no FAQ.
 */
export const paymentTerms = [
  { value: '30%', label: 'de sinal para reservar a data' },
  { value: '3x', label: 'sem juros no cartão de crédito' },
  { value: '5%', label: 'de desconto no Pix à vista' },
] as const;

/** Exibe avisos de "pendente de confirmação" (apenas no `npm run dev`). */
export const showPendingNotices = import.meta.env?.DEV ?? false;

export const instagramUrl = site.instagramUser
  ? `https://www.instagram.com/${site.instagramUser}/`
  : '';

/** Itens do menu principal. `href` com # aponta para seções da página inicial. */
export const navItems = [
  { label: 'Início', href: '/#inicio' },
  { label: 'Serviços', href: '/#servicos' },
  { label: 'Tabela de preços', href: '/precos' },
  { label: 'Simulador', href: '/simulador' },
  { label: 'Como contratar', href: '/#como-contratar' },
  { label: 'Dúvidas frequentes', href: '/faq' },
  { label: 'Contato', href: '/#contato' },
] as const;
