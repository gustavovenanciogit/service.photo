/**
 * GALERIA DE VENDAS — regras puras (servidor, página e testes usam as mesmas)
 * ------------------------------------------------------------------
 * - Orientação pela dimensão REAL do arquivo (não pelo nome).
 * - Filtros e ordenação da consulta pública.
 * - Oferta do pacote: só é "econômica" quando sai mais barato que as avulsas.
 * - Distribuição em colunas (masonry) pela proporção de cada foto.
 */
import { selectionPrice } from './events.ts';

export type Orientation = 'vertical' | 'horizontal' | 'square';
export const ORIENTATIONS: Orientation[] = ['vertical', 'horizontal', 'square'];
export type GalleryOrder = 'asc' | 'desc' | 'new' | 'old';

/** Quadrada quando os lados diferem até 3%. Sem dimensões: null. */
export function orientationOf(w: number, h: number): Orientation | null {
  if (!(w > 0 && h > 0)) return null;
  if (Math.abs(w - h) * 100 <= 3 * Math.max(w, h)) return 'square';
  return h > w ? 'vertical' : 'horizontal';
}

/** Mesma regra em SQL (colunas width/height). */
export const ORIENTATION_SQL: Record<Orientation, string> = {
  square: '(width > 0 AND height > 0 AND abs(width - height) * 100 <= 3 * max(width, height))',
  vertical: '(width > 0 AND height > width AND abs(width - height) * 100 > 3 * max(width, height))',
  horizontal: '(height > 0 AND width > height AND abs(width - height) * 100 > 3 * max(width, height))',
};

export const ORDER_SQL: Record<GalleryOrder, string> = {
  asc: 'seq ASC',
  desc: 'seq DESC',
  new: 'created_at DESC, seq DESC',
  old: 'created_at ASC, seq ASC',
};

export interface GalleryQuery {
  orient: Orientation | 'all';
  order: GalleryOrder;
  offset: number;
  from: number; // a partir da foto nº (busca); 0 = desde o início
}

export function parseGalleryQuery(p: URLSearchParams): GalleryQuery {
  const orient = p.get('orient');
  const order = p.get('order');
  const int = (v: string | null, max: number) => Math.min(max, Math.max(0, Number.parseInt(v ?? '0', 10) || 0));
  return {
    orient: ORIENTATIONS.includes(orient as Orientation) ? (orient as Orientation) : 'all',
    order: order && order in ORDER_SQL ? (order as GalleryOrder) : 'asc',
    offset: int(p.get('offset'), 1_000_000),
    from: int(p.get('from'), 1_000_000),
  };
}

/**
 * O pacote ("todas as suas fotos") só ganha selo de economia se for mais barato
 * do que comprar avulsas — a partir de quantas fotos ele passa a valer a pena.
 */
export function packOffer(e: { price_single: number; price_pack: number }, photoCount: number) {
  if (!(e.price_pack > 0) || !(e.price_single > 0)) return { show: false, worthFrom: 0, badge: false };
  const worthFrom = Math.floor(e.price_pack / e.price_single) + 1; // nº mínimo de fotos em que o pacote sai mais barato
  return { show: true, worthFrom, badge: worthFrom <= photoCount };
}

/** Resumo do carrinho: total, se o pacote foi aplicado e quanto economizou. */
export function cartSummary(count: number, e: { price_single: number; price_pack: number }) {
  const p = selectionPrice(count, e);
  return { total: p.total, usePack: p.usePack, savings: Math.round((p.full - p.total) * 100) / 100 };
}

/** Número de colunas por largura de tela (celular 2, tablet 3, computador 4). */
export const columnsFor = (width: number) => (width >= 1200 ? 4 : width >= 768 ? 3 : 2);

/** Coluna mais baixa (onde a próxima foto entra). Empate: a mais à esquerda. */
export function shortestColumn(heights: number[]) {
  let best = 0;
  for (let i = 1; i < heights.length; i++) if (heights[i]! < heights[best]! - 1e-9) best = i;
  return best;
}

/** Altura relativa de uma foto numa coluna de largura 1 (proporção real; sem dimensões, 2:3 horizontal). */
export const relativeHeight = (w: number, h: number) => (w > 0 && h > 0 ? h / w : 2 / 3);

/** Distribui fotos em colunas (masonry): devolve a coluna de cada foto. */
export function distribute(items: { w: number; h: number }[], columns: number, gap = 0.03) {
  const heights = Array.from({ length: columns }, () => 0);
  return items.map((it) => {
    const c = shortestColumn(heights);
    heights[c]! += relativeHeight(it.w, it.h) + gap;
    return c;
  });
}
