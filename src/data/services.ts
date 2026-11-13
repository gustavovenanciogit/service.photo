/**
 * CATÁLOGO DE PACOTES E PREÇOS — ARQUIVO ÚNICO
 * ------------------------------------------------------------------
 * Transcrito da "Tabela de Preços 2026" (PDF, 6 páginas).
 *
 * Para atualizar preços e descrições, edite SOMENTE este arquivo.
 * Depois rode `npm run build` (ou faça o deploy): tabela de preços,
 * páginas de categoria e mensagens de WhatsApp passam a usar os novos valores.
 *
 * REGRAS
 * - `price`: número em reais, sem "R$" (ex.: 350 ou 12.9). `null` = sob consulta.
 * - `priceUnit`: sufixo exibido após o valor, como na tabela ('/mês', '/hora', '/km').
 * - `priceLabel`: texto que substitui o valor quando não é em reais (ex.: '+20%').
 * - `confirmed`: só com `true` o valor aparece ao público.
 * - `highlight`: etiqueta opcional — use só as que estão na sua tabela.
 * - `active: false` esconde o item sem apagá-lo.
 */
import { formatBRL } from '../lib/whatsapp.ts';

export interface ServicePackage {
  /** Identificador único (sem espaços/acentos). */
  id: string;
  /** Slug da categoria (ver src/data/categories.ts). */
  category: string;
  /** Subgrupo dentro da categoria (ver `groups` em categories.ts), se houver. */
  group?: string;
  name: string;
  description: string;
  /** Valor em reais. `null` = sob consulta. */
  price: number | null;
  /** Sufixo do valor: '/mês', '/hora', '/km'... */
  priceUnit?: string;
  /** Texto no lugar do valor (ex.: '+20%'). */
  priceLabel?: string;
  /** Duração da cobertura/sessão (ex.: '1 hora'). */
  duration: string | null;
  /** Fotos incluídas, quando aplicável. */
  photos?: string | null;
  /** Prazo de entrega. */
  delivery: string | null;
  /** O que está incluso / diferenciais. */
  benefits: string[];
  /** Condições/observações do item. */
  conditions: string[];
  /** Etiqueta de destaque (ex.: 'Mais escolhido'). */
  highlight?: string;
  /** Item adicional (extras), e não um pacote principal. */
  addon?: boolean;
  /** Compra direta numa plataforma (o botão leva para lá, e não para o WhatsApp). */
  buyAt?: 'fotto';
  /** Assinatura/plano recorrente (no simulador: sem extras, pagamento mensal). */
  subscription?: boolean;
  /** Conferido com a tabela oficial? */
  confirmed: boolean;
  /** Exibir no site? */
  active: boolean;
}

/** Atalho com valores padrão. */
const item = (
  p: Pick<ServicePackage, 'id' | 'category' | 'name' | 'description' | 'price'> & Partial<ServicePackage>,
): ServicePackage => ({
  duration: null,
  photos: null,
  delivery: null,
  benefits: [],
  conditions: [],
  confirmed: true,
  active: true,
  ...p,
});

export const packages: ServicePackage[] = [
  // ───────────── 01. FOTOGRAFIA ESPORTIVA ─────────────
  item({
    id: 'foto-avulsa',
    category: 'fotografia-esportiva',
    name: 'Foto avulsa',
    description: 'Valor fixo por foto, compra pela loja Fotto.',
    price: 12.9,
    buyAt: 'fotto',
  }),
  item({
    id: 'todas-as-minhas-fotos',
    category: 'fotografia-esportiva',
    name: 'Todas as minhas fotos',
    description: 'Todas as fotos em que você aparece.',
    price: 119.9,
    photos: 'Todas em que você aparece',
    benefits: ['Pré-venda: R$ 100'],
    buyAt: 'fotto',
  }),
  item({
    id: 'atleta-foco',
    category: 'fotografia-esportiva',
    name: 'Atleta Foco',
    description: 'Cobertura exclusiva em 3–4 pontos do percurso.',
    price: 190,
    delivery: 'Em 24h',
  }),
  item({
    id: 'ensaio-esportivo',
    category: 'fotografia-esportiva',
    name: 'Ensaio esportivo',
    description: 'Ensaio de treino ou lifestyle.',
    price: 350,
    duration: '1h',
    delivery: 'Em 7 dias',
  }),
  item({
    id: 'treino-de-assessoria',
    category: 'fotografia-esportiva',
    name: 'Treino de assessoria',
    description: 'Cobertura do treino com fotos à venda para os alunos.',
    price: 450,
    duration: 'Até 2h',
    benefits: ['Prévia no mesmo dia', 'Fotos à venda para os alunos'],
  }),
  item({
    id: 'plano-mensal-assessoria',
    subscription: true,
    category: 'fotografia-esportiva',
    name: 'Plano mensal assessoria',
    description: '4 treinos por mês.',
    price: 1500,
    benefits: ['4 treinos por mês', 'Prévia no mesmo dia'],
  }),
  item({
    id: 'corrida-corporativa',
    category: 'fotografia-esportiva',
    name: 'Corrida corporativa',
    description: 'Largada, percurso e chegada.',
    price: 950,
    duration: 'Até 4h',
    benefits: ['Largada, percurso e chegada', 'Fotos liberadas'],
  }),

  // ───────────── 02. ACADEMIAS DE LUTA ─────────────
  // Cobertura geral
  item({
    id: 'academia-treino-avulso',
    category: 'academias-de-luta',
    group: 'cobertura-geral',
    name: 'Treino avulso',
    description: 'Fotos de todos, liberadas para academia e alunos.',
    price: 300,
    duration: 'Até 1h30',
    delivery: 'Em 48h',
  }),
  item({
    id: 'academia-cobertura-quinzenal',
    subscription: true,
    category: 'academias-de-luta',
    group: 'cobertura-geral',
    name: 'Plano quinzenal',
    description: 'Assinatura · 2 treinos por mês.',
    price: 550,
    priceUnit: '/mês',
    benefits: ['2 treinos por mês'],
  }),
  item({
    id: 'academia-cobertura-mensal',
    subscription: true,
    category: 'academias-de-luta',
    group: 'cobertura-geral',
    name: 'Plano mensal',
    description: 'Assinatura · 4 treinos por mês.',
    price: 1000,
    priceUnit: '/mês',
    benefits: ['4 treinos por mês'],
  }),
  item({
    id: 'academia-graduacao',
    category: 'academias-de-luta',
    group: 'cobertura-geral',
    name: 'Graduação / Troca de faixa',
    description: 'Alunos, professores e famílias.',
    price: 550,
    duration: 'Até 3h',
  }),
  // Marketing da academia
  item({
    id: 'academia-visita-avulsa',
    category: 'academias-de-luta',
    group: 'marketing',
    name: 'Visita avulsa',
    description: 'Aulas, professores e estrutura.',
    price: 180,
    duration: 'Até 1h',
  }),
  item({
    id: 'academia-marketing-quinzenal',
    subscription: true,
    category: 'academias-de-luta',
    group: 'marketing',
    name: 'Plano quinzenal',
    description: 'Assinatura · 2 visitas por mês.',
    price: 340,
    priceUnit: '/mês',
    benefits: ['2 visitas por mês'],
  }),
  item({
    id: 'academia-marketing-mensal',
    subscription: true,
    category: 'academias-de-luta',
    group: 'marketing',
    name: 'Plano mensal',
    description: 'Assinatura · 4 visitas por mês.',
    price: 620,
    priceUnit: '/mês',
    benefits: ['4 visitas por mês'],
  }),

  // ───────────── 03. ATLETAS DE LUTA ─────────────
  item({
    id: 'atleta-sessao-avulsa',
    category: 'atletas-de-luta',
    name: 'Sessão avulsa',
    description: '1h de treino na academia.',
    price: 350,
    duration: '1h',
    delivery: 'Em 7 dias',
  }),
  item({
    id: 'plano-atleta',
    subscription: true,
    category: 'atletas-de-luta',
    name: 'Plano atleta',
    description: '2 sessões de treino por mês.',
    price: 590,
    priceUnit: '/mês',
    delivery: 'Em 7 dias',
    highlight: 'Assinatura',
  }),
  item({
    id: 'atleta-foco-luta',
    category: 'atletas-de-luta',
    name: 'Atleta Foco Luta',
    description: 'Suas lutas no campeonato (1 dia).',
    price: 190,
    duration: '1 dia de campeonato',
    delivery: 'Em 24h',
  }),

  // ───────────── 04. EVENTOS SOCIAIS ─────────────
  item({
    id: 'evento-premium',
    category: 'eventos-sociais',
    name: 'Premium',
    description: '15 anos e formaturas.',
    price: 1290,
    duration: '6 horas',
    benefits: ['Ensaio pré-festa de 1h + festa', 'Prévia em 24h'],
  }),
  item({
    id: 'evento-completo',
    category: 'eventos-sociais',
    name: 'Completo',
    description: 'Cobertura de mais momentos.',
    price: 890,
    duration: '4 horas',
    benefits: ['Prévia em 48h', 'Galeria online'],
  }),
  item({
    id: 'evento-classico',
    category: 'eventos-sociais',
    name: 'Clássico',
    description: 'Galeria online com prévia em 48h.',
    price: 690,
    duration: '3 horas',
    benefits: ['Galeria online', 'Prévia em 48h'],
    highlight: 'Mais escolhido',
  }),
  item({
    id: 'evento-essencial',
    category: 'eventos-sociais',
    name: 'Essencial',
    description: 'Aniversários e festas.',
    price: 500,
    duration: '2 horas',
    benefits: ['Galeria online'],
  }),
  item({
    id: 'evento-corporativo',
    category: 'eventos-sociais',
    name: 'Corporativo',
    description: 'Cobertura de eventos empresariais, com nota fiscal.',
    price: 180,
    priceUnit: '/hora',
    duration: 'Mínimo de 2h',
    delivery: 'Em 48 a 72h',
    benefits: ['Com nota fiscal'],
  }),
  item({
    id: 'formatura-colacao-individual',
    category: 'eventos-sociais',
    name: 'Formatura · Colação individual',
    description: 'Formando + família.',
    price: 390,
    delivery: 'Em 10 dias úteis',
  }),

  // ───────────── 05. ENSAIOS EXTERNOS ─────────────
  item({
    id: 'ensaio-premium',
    category: 'ensaios-externos',
    name: 'Premium',
    description: 'Sessão mais longa.',
    price: 850,
    duration: '2 horas · 1 local',
    delivery: 'Em 7 a 10 dias',
    benefits: ['Prévia em 48h'],
  }),
  item({
    id: 'ensaio-intermediario',
    category: 'ensaios-externos',
    name: 'Intermediário',
    description: 'Mais tempo para variar cenários no mesmo lugar.',
    price: 490,
    duration: '1h30 · 1 local',
    delivery: 'Em 7 a 10 dias',
    highlight: 'Mais escolhido',
  }),
  item({
    id: 'ensaio-basico',
    category: 'ensaios-externos',
    name: 'Básico',
    description: 'Vagas limitadas por mês.',
    price: 290,
    duration: '1 hora · 1 local',
    delivery: 'Em 7 a 10 dias',
  }),
  item({
    id: 'retrato-profissional',
    category: 'ensaios-externos',
    name: 'Retrato profissional',
    description: 'Para LinkedIn · externo ou no seu local de trabalho.',
    price: 220,
    duration: '30 a 45 min',
    delivery: 'Em 72h',
  }),

  // ───────────── 06. EXTRAS (ADICIONAIS) ─────────────
  item({ id: 'extra-hora', category: 'extras-e-pagamento', addon: true, name: 'Hora extra', description: 'Tempo adicional de cobertura.', price: 150 }),
  item({ id: 'extra-entrega-expressa', category: 'extras-e-pagamento', addon: true, name: 'Entrega expressa (48h)', description: 'Entrega das fotos em 48h.', price: 120, delivery: 'Em 48h' }),
  item({
    id: 'extra-deslocamento',
    category: 'extras-e-pagamento',
    addon: true,
    name: 'Deslocamento fora de Manaus',
    description: 'Mínimo R$ 80 + alimentação.',
    price: 1.5,
    priceUnit: '/km',
  }),
  item({ id: 'extra-domingos-feriados', category: 'extras-e-pagamento', addon: true, name: 'Domingos e feriados', description: 'Acréscimo sobre o pacote e as horas extras.', price: null, priceLabel: '+20%' }),
  item({ id: 'extra-apos-22h', category: 'extras-e-pagamento', addon: true, name: 'Horas após 22h', description: 'Acréscimo sobre o pacote quando o evento passa das 22h.', price: null, priceLabel: '+15%' }),
  item({ id: 'extra-video-curto', category: 'extras-e-pagamento', addon: true, name: 'Vídeo curto', description: 'Somente a pedido do cliente.', price: null }),
];

export const activePackages = packages.filter((p) => p.active);

export const packagesByCategory = (slug: string) => activePackages.filter((p) => p.category === slug);

/** O valor pode ser mostrado ao público? */
export const isPricePublic = (p: ServicePackage) => p.confirmed && (p.price !== null || !!p.priceLabel);

/** Valor como texto, igual à tabela: "R$ 550/mês", "+20%". `null` = sob consulta / não público. */
export const priceText = (p: ServicePackage): string | null => {
  if (!isPricePublic(p)) return null;
  if (p.priceLabel) return p.priceLabel;
  return `${formatBRL(p.price!)}${p.priceUnit ?? ''}`;
};

/** Menor valor público da categoria (para "a partir de"), ignorando adicionais. */
export const startingPrice = (slug: string): number | null => {
  const prices = packagesByCategory(slug)
    .filter((p) => !p.addon && !p.priceUnit && isPricePublic(p) && p.price !== null)
    .map((p) => p.price!);
  return prices.length ? Math.min(...prices) : null;
};
