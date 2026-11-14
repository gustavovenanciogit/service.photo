/**
 * AGENDA E PRAZOS DE ENTREGA — regras
 * ------------------------------------------------------------------
 * Funções puras (servidor, painel e testes).
 *
 * Prazo de entrega a partir do texto do pacote:
 *   "Em 24h" → +1 dia · "Em 48h" → +2 · "Em 48 a 72h" → +3 (usa o MAIOR prazo)
 *   "Em 7 dias" → +7 · "Em 7 a 10 dias" → +10 · "Em 10 dias úteis" → +10 dias úteis (sem sábado/domingo)
 * Feriados não são considerados: confira prazos que caem perto de feriados.
 */

export const TIMEZONE = 'America/Manaus';

/** Data de hoje (AAAA-MM-DD) no fuso de Manaus. */
export const todayInManaus = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(now);

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
};
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export const addDaysISO = (iso: string, days: number) => {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fmt(d);
};

export const addBusinessDaysISO = (iso: string, days: number) => {
  const d = parse(iso);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return fmt(d);
};

/** Diferença em dias (b − a). */
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);

export interface DeliveryRule {
  days: number;
  business: boolean;
}

/** Interpreta o texto de entrega do pacote. `null` se não reconhecer. */
export function parseDelivery(text: string | null | undefined): DeliveryRule | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(/\s+/g, ' ');
  const nums = [...t.matchAll(/\d+/g)].map((m) => Number(m[0]));
  if (!nums.length) return null;
  const max = Math.max(...nums);
  if (/\d\s*h\b|horas?/.test(t)) return { days: Math.max(1, Math.ceil(max / 24)), business: false };
  if (/dias?/.test(t)) return { days: max, business: /úteis|uteis/.test(t) };
  return null;
}

export function dueDate(start: string, rule: DeliveryRule | null) {
  if (!rule || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return '';
  return rule.business ? addBusinessDaysISO(start, rule.days) : addDaysISO(start, rule.days);
}

/**
 * Prazo de entrega de uma proposta aceita.
 * - Entrega expressa (48h) na proposta → 48h.
 * - Senão, o MAIOR prazo entre os itens ("Entrega: ..." nos detalhes).
 * - Itens sem prazo próprio usam o padrão da categoria (ex.: eventos sociais = 10 dias úteis).
 */
export function dueDateForItems(
  start: string,
  items: { n: string; c?: string; d?: string[] }[],
  categoryDefaults: Record<string, string> = DEFAULT_DELIVERY_BY_CATEGORY,
) {
  if (items.some((i) => /entrega expressa/i.test(i.n))) return dueDate(start, { days: 2, business: false });
  const dates = items
    .map((i) => {
      const own = i.d?.find((x) => x.startsWith('Entrega:'))?.replace('Entrega:', '').trim();
      const cat = Object.entries(categoryDefaults).find(([label]) => i.c?.startsWith(label))?.[1];
      return dueDate(start, parseDelivery(own ?? cat));
    })
    .filter(Boolean)
    .sort();
  return dates.at(-1) ?? '';
}

/**
 * Prazos padrão por categoria (pelo título), quando o pacote não tem prazo próprio.
 * Fonte: observação da Tabela 2026 — "Galeria completa em até 10 dias úteis".
 */
export const DEFAULT_DELIVERY_BY_CATEGORY: Record<string, string> = {
  'Eventos sociais': 'Em 10 dias úteis',
};

/** Rótulo do prazo em relação a hoje. */
export function dueLabel(due: string, today: string): { text: string; tone: 'late' | 'today' | 'soon' | 'ok' } {
  const n = daysBetween(today, due);
  if (n < 0) return { text: n === -1 ? 'Atrasada 1 dia' : `Atrasada ${-n} dias`, tone: 'late' };
  if (n === 0) return { text: 'Vence hoje', tone: 'today' };
  if (n === 1) return { text: 'Vence amanhã', tone: 'soon' };
  if (n <= 3) return { text: `Vence em ${n} dias`, tone: 'soon' };
  return { text: `Vence em ${n} dias`, tone: 'ok' };
}

/** Grade do mês para o calendário: semanas (domingo a sábado) com datas ISO ou null. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null);
  for (let d = 1; d <= days; d++) cells.push(fmt(new Date(Date.UTC(year, month - 1, d))));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}
