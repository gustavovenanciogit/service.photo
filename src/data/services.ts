/**
 * CATÁLOGO DE PACOTES E PREÇOS — ARQUIVO ÚNICO
 * ------------------------------------------------------------------
 * Para atualizar preços e descrições, edite SOMENTE este arquivo.
 * Depois rode `npm run build` (ou faça o deploy) e o site inteiro
 * (tabela de preços, páginas de categoria e mensagens de WhatsApp)
 * passa a usar os novos valores.
 *
 * REGRAS IMPORTANTES
 * - `price`: número em reais, sem "R$" (ex.: 350 ou 1290.5). Use `null`
 *   quando o valor for "sob consulta".
 * - `confirmed`: só marque `true` depois de conferir o pacote com a sua
 *   tabela oficial. Enquanto for `false`, o site NÃO exibe o preço ao
 *   público (mostra "Valor sob consulta") e, no modo de desenvolvimento,
 *   mostra o selo "Pendente de confirmação".
 * - `highlight`: etiqueta opcional (ex.: 'Mais escolhido'). Use apenas
 *   se for verdade — deixe `undefined` caso contrário.
 * - `active: false` esconde o pacote sem apagá-lo.
 *
 * SITUAÇÃO ATUAL: a imagem da tabela de preços ainda não foi
 * transcrita. Os pacotes abaixo foram criados a partir das categorias
 * e serviços informados, com valores, durações e prazos PENDENTES.
 * Veja PENDENCIAS.md.
 */

export interface ServicePackage {
  /** Identificador único (sem espaços/acentos). */
  id: string;
  /** Slug da categoria (ver src/data/categories.ts). */
  category: string;
  name: string;
  description: string;
  /** Valor em reais. `null` = sob consulta. */
  price: number | null;
  /** Unidade/periodicidade do valor: 'por sessão', 'por mês', 'por hora'... */
  priceUnit?: string;
  /** Prefixo do valor, se houver (ex.: 'a partir de'). */
  pricePrefix?: string;
  /** Duração da cobertura/sessão (ex.: '1 hora'). `null` = a confirmar. */
  duration: string | null;
  /** Quantidade de fotos (ex.: '30 fotos editadas'), quando aplicável. */
  photos?: string | null;
  /** Prazo de entrega (ex.: 'até 7 dias úteis'). `null` = a confirmar. */
  delivery: string | null;
  /** O que está incluso. */
  benefits: string[];
  /** Condições/observações do pacote. */
  conditions: string[];
  /** Etiqueta de destaque opcional. */
  highlight?: string;
  /** Pacote conferido com a tabela oficial? (ver regras acima) */
  confirmed: boolean;
  /** Exibir no site? */
  active: boolean;
}

/** Atalho para criar pacotes ainda não transcritos da tabela oficial. */
const pending = (
  p: Pick<ServicePackage, 'id' | 'category' | 'name' | 'description'> & Partial<ServicePackage>,
): ServicePackage => ({
  price: null,
  duration: null,
  photos: null,
  delivery: null,
  benefits: [],
  conditions: [],
  confirmed: false,
  active: true,
  ...p,
});

export const packages: ServicePackage[] = [
  // ───────────── 01. FOTOGRAFIA ESPORTIVA ─────────────
  pending({
    id: 'fotos-individuais',
    category: 'fotografia-esportiva',
    name: 'Fotos individuais',
    description: 'Fotos do atleta durante treino, prova ou atividade esportiva.',
  }),
  pending({
    id: 'cobertura-de-atletas',
    category: 'fotografia-esportiva',
    name: 'Cobertura de atletas',
    description: 'Acompanhamento fotográfico de atletas em treinos e competições.',
  }),
  pending({
    id: 'ensaio-esportivo',
    category: 'fotografia-esportiva',
    name: 'Ensaio esportivo',
    description: 'Cobertura fotográfica individual de treino ou atividade esportiva.',
    // Valor citado como EXEMPLO no briefing. Confirme na tabela antes de marcar confirmed: true.
    price: 350,
    priceUnit: 'por ensaio',
  }),
  pending({
    id: 'treinos-de-assessorias',
    category: 'fotografia-esportiva',
    name: 'Treinos de assessorias',
    description: 'Cobertura de treinos coletivos de assessorias esportivas e grupos de corrida.',
  }),
  pending({
    id: 'cobertura-de-corridas',
    category: 'fotografia-esportiva',
    name: 'Cobertura de corridas',
    description: 'Registro de provas de rua e corridas, do pré-largada à chegada.',
  }),

  // ───────────── 02. ACADEMIAS DE LUTA ─────────────
  pending({
    id: 'academia-cobertura-de-treino',
    category: 'academias-de-luta',
    name: 'Cobertura de treino',
    description: 'Registro fotográfico de treinos para divulgação da academia.',
  }),
  pending({
    id: 'academia-plano-avulso',
    category: 'academias-de-luta',
    name: 'Plano avulso',
    description: 'Cobertura pontual, contratada por data.',
  }),
  pending({
    id: 'academia-plano-quinzenal',
    category: 'academias-de-luta',
    name: 'Plano quinzenal',
    description: 'Coberturas recorrentes a cada quinze dias.',
  }),
  pending({
    id: 'academia-plano-mensal',
    category: 'academias-de-luta',
    name: 'Plano mensal',
    description: 'Coberturas recorrentes ao longo do mês.',
  }),
  pending({
    id: 'academia-marketing',
    category: 'academias-de-luta',
    name: 'Marketing para academias',
    description: 'Conteúdo fotográfico pensado para redes sociais e divulgação da academia.',
  }),

  // ───────────── 03. ATLETAS DE LUTA ─────────────
  pending({
    id: 'atleta-sessao-individual',
    category: 'atletas-de-luta',
    name: 'Sessão individual',
    description: 'Sessão fotográfica individual para atletas de artes marciais.',
  }),
  pending({
    id: 'atleta-plano',
    category: 'atletas-de-luta',
    name: 'Plano para atletas',
    description: 'Acompanhamento fotográfico recorrente do atleta.',
  }),
  pending({
    id: 'atleta-cobertura-de-competicao',
    category: 'atletas-de-luta',
    name: 'Cobertura de competição',
    description: 'Registro do atleta durante campeonatos e eventos de luta.',
  }),

  // ───────────── 04. EVENTOS SOCIAIS ─────────────
  pending({
    id: 'evento-aniversario',
    category: 'eventos-sociais',
    name: 'Aniversário',
    description: 'Cobertura fotográfica de festas de aniversário.',
  }),
  pending({
    id: 'evento-festa',
    category: 'eventos-sociais',
    name: 'Festa',
    description: 'Cobertura fotográfica de festas e confraternizações.',
  }),
  pending({
    id: 'evento-formatura',
    category: 'eventos-sociais',
    name: 'Formatura',
    description: 'Cobertura fotográfica de formaturas e colações.',
  }),
  pending({
    id: 'evento-corporativo',
    category: 'eventos-sociais',
    name: 'Evento corporativo',
    description: 'Cobertura de eventos empresariais, palestras e lançamentos.',
  }),

  // ───────────── 05. ENSAIOS EXTERNOS ─────────────
  pending({
    id: 'ensaio-individual',
    category: 'ensaios-externos',
    name: 'Ensaio individual',
    description: 'Ensaio fotográfico externo individual.',
  }),
  pending({
    id: 'ensaio-casal',
    category: 'ensaios-externos',
    name: 'Ensaio de casal',
    description: 'Ensaio fotográfico externo para casais.',
  }),
  pending({
    id: 'ensaio-familia',
    category: 'ensaios-externos',
    name: 'Ensaio de família',
    description: 'Ensaio fotográfico externo para famílias.',
  }),
  pending({
    id: 'ensaio-gestante',
    category: 'ensaios-externos',
    name: 'Ensaio gestante',
    description: 'Ensaio fotográfico externo para gestantes.',
  }),
  pending({
    id: 'retrato-profissional',
    category: 'ensaios-externos',
    name: 'Retrato profissional',
    description: 'Retratos para perfil profissional, currículo e redes.',
  }),

  // ───────────── 06. EXTRAS E PAGAMENTO ─────────────
  pending({
    id: 'extra-hora-adicional',
    category: 'extras-e-pagamento',
    name: 'Hora adicional',
    description: 'Tempo extra de cobertura além do contratado no pacote.',
    priceUnit: 'por hora',
  }),
  pending({
    id: 'extra-entrega-expressa',
    category: 'extras-e-pagamento',
    name: 'Entrega expressa',
    description: 'Entrega das fotografias em prazo reduzido.',
  }),
  pending({
    id: 'extra-deslocamento',
    category: 'extras-e-pagamento',
    name: 'Deslocamento',
    description: 'Taxa de deslocamento para locais fora da área de atendimento.',
  }),
  pending({
    id: 'condicoes-comerciais',
    category: 'extras-e-pagamento',
    name: 'Condições comerciais',
    description: 'Formas de pagamento, sinal e condições de contratação.',
  }),
];

export const activePackages = packages.filter((p) => p.active);

export const packagesByCategory = (slug: string) =>
  activePackages.filter((p) => p.category === slug);

/** O preço pode ser mostrado ao público? */
export const isPricePublic = (p: ServicePackage) => p.confirmed && p.price !== null;
