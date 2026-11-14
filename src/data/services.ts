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
import pricingData from './pricing.json' with { type: 'json' };

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

/** Valores padrão para campos omitidos no JSON. */
const withDefaults = (p: Partial<ServicePackage> & Pick<ServicePackage, 'id' | 'category' | 'name' | 'description' | 'price'>): ServicePackage => ({
  duration: null,
  photos: null,
  delivery: null,
  benefits: [],
  conditions: [],
  confirmed: true,
  active: true,
  ...p,
});

/**
 * Os pacotes ficam em src/data/pricing.json — editável pelo painel
 * (Painel → Site → Preços) ou diretamente no arquivo.
 */
export const packages: ServicePackage[] = (pricingData.packages as ServicePackage[]).map(withDefaults);

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
