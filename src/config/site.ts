/**
 * CONFIGURAÇÕES CENTRAIS DO SITE
 * ------------------------------------------------------------------
 * Tudo que é contato, nome e links fica aqui. Altere e salve:
 * o site inteiro passa a usar os novos valores.
 *
 * Campos marcados com "PENDENTE" ainda precisam ser preenchidos.
 * Enquanto estiverem vazios, o site esconde o link correspondente
 * (não publica link quebrado).
 */

export const site = {
  /** Nome profissional exibido no topo, rodapé e SEO. PENDENTE: confirme o nome. */
  name: 'Gustavo Fotografia',
  /** Nome curto (logo do menu). */
  shortName: 'GUSTAVO',
  /** Linha de apoio do logo. */
  tagline: 'Fotografia esportiva & comercial',

  city: 'Manaus',
  state: 'Amazonas',
  stateCode: 'AM',

  /**
   * WhatsApp no formato internacional, só números: 55 + DDD + número.
   * Ex.: '5592999999999'. PENDENTE: preencha com o seu número.
   * Enquanto estiver vazio, os botões abrem o WhatsApp sem destinatário
   * (o cliente escolhe o contato), e o site mostra um aviso no modo dev.
   */
  whatsappNumber: '',

  /** Usuário do Instagram, sem @. PENDENTE. */
  instagramUser: '',

  /** Link da sua página na Fotto (venda de fotos esportivas). PENDENTE. */
  fottoUrl: '',

  /** E-mail público (opcional). */
  email: '',

  seo: {
    defaultTitle: 'Fotógrafo em Manaus | Fotografia esportiva, ensaios e eventos',
    defaultDescription:
      'Fotografia esportiva, ensaios e cobertura de eventos em Manaus. Conheça os serviços, consulte os pacotes e solicite seu orçamento pelo WhatsApp.',
    /** Imagem de compartilhamento (Open Graph), dentro de /public. */
    ogImage: '/og-image.png',
    locale: 'pt_BR',
  },
} as const;

/** Exibe avisos de "pendente de confirmação" (apenas no `npm run dev`). */
export const showPendingNotices = import.meta.env.DEV;

export const instagramUrl = site.instagramUser
  ? `https://www.instagram.com/${site.instagramUser}/`
  : '';

/** Itens do menu principal. `href` com # aponta para seções da página inicial. */
export const navItems = [
  { label: 'Início', href: '/#inicio' },
  { label: 'Serviços', href: '/#servicos' },
  { label: 'Tabela de preços', href: '/precos' },
  { label: 'Como contratar', href: '/#como-contratar' },
  { label: 'Dúvidas frequentes', href: '/faq' },
  { label: 'Contato', href: '/#contato' },
] as const;
