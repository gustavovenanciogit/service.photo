/**
 * CATEGORIAS DE SERVIÇO
 * ------------------------------------------------------------------
 * As 6 categorias da tabela de preços. O `slug` vira a URL:
 * /servicos/fotografia-esportiva, /servicos/academias-de-luta, etc.
 */

export type IconName =
  | 'running'
  | 'gloves'
  | 'medal'
  | 'party'
  | 'camera'
  | 'plus'
  | 'search'
  | 'chat'
  | 'check'
  | 'calendar'
  | 'image';

export interface Category {
  /** Identificador usado em URL e filtros. Não use espaços nem acentos. */
  slug: string;
  /** Número exibido no cartão (01, 02...). */
  number: string;
  title: string;
  /** Descrição curta exibida no cartão. */
  summary: string;
  icon: IconName;
  /** Itens/serviços cobertos pela categoria. */
  items: string[];
}

export const categories: Category[] = [
  {
    slug: 'fotografia-esportiva',
    number: '01',
    title: 'Fotografia esportiva',
    summary: 'Registro de atletas, treinos e provas, com foco em movimento, esforço e performance.',
    icon: 'running',
    items: [
      'Fotos individuais',
      'Cobertura de atletas',
      'Ensaios esportivos',
      'Treinos de assessorias',
      'Cobertura de corridas',
    ],
  },
  {
    slug: 'academias-de-luta',
    number: '02',
    title: 'Academias de luta',
    summary: 'Cobertura de treinos e conteúdo visual para divulgação de academias e equipes.',
    icon: 'gloves',
    items: [
      'Cobertura de treinos',
      'Planos avulsos',
      'Planos quinzenais',
      'Planos mensais',
      'Marketing para academias',
    ],
  },
  {
    slug: 'atletas-de-luta',
    number: '03',
    title: 'Atletas de luta',
    summary: 'Sessões e acompanhamento fotográfico para atletas de artes marciais.',
    icon: 'medal',
    items: ['Sessões individuais', 'Planos para atletas', 'Cobertura de competições'],
  },
  {
    slug: 'eventos-sociais',
    number: '04',
    title: 'Eventos sociais',
    summary: 'Aniversários, festas, formaturas e eventos corporativos registrados com naturalidade.',
    icon: 'party',
    items: ['Aniversários', 'Festas', 'Formaturas', 'Eventos corporativos'],
  },
  {
    slug: 'ensaios-externos',
    number: '05',
    title: 'Ensaios externos',
    summary: 'Ensaios ao ar livre para retratos individuais, casais, famílias e gestantes.',
    icon: 'camera',
    items: ['Ensaios individuais', 'Casais', 'Famílias', 'Gestantes', 'Retratos profissionais'],
  },
  {
    slug: 'extras-e-pagamento',
    number: '06',
    title: 'Extras e pagamento',
    summary: 'Horas adicionais, entrega expressa, deslocamento e condições comerciais.',
    icon: 'plus',
    items: ['Horas adicionais', 'Entregas expressas', 'Deslocamento', 'Condições comerciais'],
  },
];

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
