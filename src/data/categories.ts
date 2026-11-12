/**
 * CATEGORIAS DE SERVIÇO (conforme a Tabela 2026)
 * ------------------------------------------------------------------
 * O `slug` vira a URL: /servicos/fotografia-esportiva, etc.
 * `notes` são as observações do rodapé de cada página da tabela.
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
  /** Linha de apoio (ex.: "Jiu-jitsu, Muay Thai, Boxe e outros"). */
  subtitle?: string;
  /** Descrição curta exibida no cartão. */
  summary: string;
  icon: IconName;
  /** Subgrupos de pacotes (ex.: "Cobertura geral"), na ordem de exibição. */
  groups?: { id: string; title: string; description?: string }[];
  /** Observações da categoria (rodapé da tabela). */
  notes: string[];
}

export const categories: Category[] = [
  {
    slug: 'fotografia-esportiva',
    number: '01',
    title: 'Fotografia esportiva',
    subtitle: 'Corridas, assessorias e atletas',
    summary: 'Fotos de provas, treinos de assessoria e ensaios esportivos, com venda de fotos pela Fotto.',
    icon: 'running',
    notes: [
      'Cobertura feita em pontos estratégicos da prova, por 1 fotógrafo. Não é garantida foto de todos os participantes.',
      'Na pré-venda, se você não for fotografado, o valor é devolvido.',
    ],
  },
  {
    slug: 'academias-de-luta',
    number: '02',
    title: 'Academias de luta',
    subtitle: 'Jiu-jitsu, Muay Thai, Boxe e outros',
    summary: 'Cobertura de treinos e graduações, e planos de marketing com fotos para as redes da academia.',
    icon: 'gloves',
    groups: [
      { id: 'cobertura-geral', title: 'Cobertura geral', description: 'Fotos de todos, liberadas para academia e alunos' },
      { id: 'marketing', title: 'Marketing da academia', description: 'Fotos para as redes da academia' },
    ],
    notes: [
      'No marketing da academia, os alunos compram as próprias fotos: R$ 12,90 a avulsa ou R$ 119,90 todas.',
      'Assinaturas com pagamento mensal antecipado e cancelamento com 30 dias de aviso.',
    ],
  },
  {
    slug: 'atletas-de-luta',
    number: '03',
    title: 'Atletas de luta',
    subtitle: 'Marketing pessoal',
    summary: 'Fotos suas para redes sociais, patrocinadores e campeonatos, com acompanhamento do seu treino.',
    icon: 'medal',
    notes: [
      'Entrega 100% digital, em galeria online.',
      'Plano com pagamento mensal antecipado e cancelamento com 30 dias de aviso.',
    ],
  },
  {
    slug: 'eventos-sociais',
    number: '04',
    title: 'Eventos sociais',
    subtitle: 'Aniversários, festas, 15 anos e formaturas',
    summary: 'Pacotes de 2 a 6 horas para festas, 15 anos e formaturas, além de eventos corporativos.',
    icon: 'party',
    notes: [
      'Galeria completa em até 10 dias úteis, com todas as fotos selecionadas e editadas.',
      'Eventos acima de 100 convidados: sob consulta.',
    ],
  },
  {
    slug: 'ensaios-externos',
    number: '05',
    title: 'Ensaios externos',
    subtitle: 'Individual, casal, família e gestante',
    summary: 'Ensaios ao ar livre em 1 local, de retratos profissionais a sessões de 2 horas.',
    icon: 'camera',
    notes: [
      'Ensaios externos em 1 local.',
      'Roupa e maquiagem por conta do cliente.',
      'Remarcação sem custo em caso de chuva.',
    ],
  },
  {
    slug: 'extras-e-pagamento',
    number: '06',
    title: 'Extras e pagamento',
    subtitle: 'Adicionais e condições',
    summary: 'Hora extra, entrega expressa, deslocamento, adicionais e condições de pagamento.',
    icon: 'plus',
    notes: [
      'Entrega 100% digital, em galeria online, com todas as fotos selecionadas e editadas.',
      'Assinaturas: pagamento mensal antecipado e cancelamento com 30 dias de aviso.',
    ],
  },
];

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
