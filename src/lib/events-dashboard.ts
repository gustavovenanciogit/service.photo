/**
 * PAINEL DE EVENTOS — regras puras (status, filtros, calendário, próximos)
 * ------------------------------------------------------------------
 * Centraliza a "fase" de cada evento para o painel, a partir dos dados reais:
 *   rascunho     → ainda não publicado (e a data do evento já chegou)
 *   agendado     → data do evento no futuro
 *   em_andamento → publicado, venda aberta e o evento já aconteceu
 *   finalizado   → venda encerrada (prazo terminou ou encerrada à mão)
 */
import { publicState, type EventRecord } from './events.ts';

export type EventPhase = 'rascunho' | 'agendado' | 'em_andamento' | 'finalizado';
export type DashboardEvent = EventRecord & { sales_total?: number; photos_sold?: number; orders_paid?: number };

export const PHASES: Record<EventPhase, { label: string; tone: 'brand' | 'neutral' | 'amber' | 'muted' }> = {
  agendado: { label: 'Agendado', tone: 'neutral' },
  em_andamento: { label: 'Em andamento', tone: 'brand' },
  rascunho: { label: 'Rascunho', tone: 'amber' },
  finalizado: { label: 'Finalizado', tone: 'muted' },
};

export function eventPhase(e: Pick<EventRecord, 'status' | 'published_at' | 'sale_days' | 'date'>, today: string, now = new Date()): EventPhase {
  const st = publicState(e, now);
  if (st === 'encerrado') return 'finalizado';
  if (e.date > today) return 'agendado';
  return st === 'aberto' ? 'em_andamento' : 'rascunho';
}

/** Situação da galeria (selo do card): o que o público vê. */
export function galleryBadge(e: Pick<EventRecord, 'status' | 'published_at' | 'sale_days'>, now = new Date()) {
  const st = publicState(e, now);
  return st === 'aberto' ? { label: 'Publicado', tone: 'brand' as const } : st === 'encerrado' ? { label: 'Encerrado', tone: 'muted' as const } : { label: 'Rascunho', tone: 'amber' as const };
}

export type DashboardFilter = 'todos' | 'proximos' | 'em_andamento' | 'finalizados';
export const FILTERS: { id: DashboardFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'proximos', label: 'Próximos' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'finalizados', label: 'Finalizados' },
];

export function matchesFilter(e: DashboardEvent, f: DashboardFilter, today: string, now = new Date()) {
  if (f === 'todos') return true;
  if (f === 'proximos') return e.date >= today && eventPhase(e, today, now) !== 'finalizado';
  if (f === 'em_andamento') return eventPhase(e, today, now) === 'em_andamento';
  return eventPhase(e, today, now) === 'finalizado';
}

export function countFilters(events: DashboardEvent[], today: string, now = new Date()) {
  const out = {} as Record<DashboardFilter, number>;
  for (const f of FILTERS) out[f.id] = events.filter((e) => matchesFilter(e, f.id, today, now)).length;
  return out;
}

/** Busca por nome, local ou data (aceita "15/11", "15/11/2026" ou "2026-11-15"). */
export function matchesSearch(e: Pick<EventRecord, 'name' | 'location' | 'date'>, q: string) {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const term = norm(q.trim());
  if (!term) return true;
  const [y, m, d] = e.date.split('-');
  const dates = [e.date, `${d}/${m}`, `${d}/${m}/${y}`];
  return norm(e.name).includes(term) || norm(e.location).includes(term) || dates.some((x) => x.startsWith(term));
}

export type SortKey = 'data_desc' | 'data_asc' | 'nome' | 'vendas';
export const SORTS: { id: SortKey; label: string }[] = [
  { id: 'data_desc', label: 'Data (mais recente)' },
  { id: 'data_asc', label: 'Data (mais antiga)' },
  { id: 'nome', label: 'Nome (A–Z)' },
  { id: 'vendas', label: 'Maior venda' },
];
export function sortEvents(list: DashboardEvent[], key: SortKey) {
  const s = [...list];
  if (key === 'data_asc') return s.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  if (key === 'nome') return s.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (key === 'vendas') return s.sort((a, b) => (b.sales_total ?? 0) - (a.sales_total ?? 0));
  return s.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
}

/** Próximos eventos (data de hoje em diante), em ordem cronológica. */
export const upcoming = (events: DashboardEvent[], today: string, max = 4) =>
  events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, max);

/** Grade do mês (semanas de domingo a sábado). Dias de fora do mês = null. */
export function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MONTHS_SHORT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** Fotos vendidas sobre o total do evento (0–100). */
export const soldPercent = (e: Pick<DashboardEvent, 'photo_count' | 'photos_sold'>) =>
  e.photo_count > 0 ? Math.min(100, Math.round(((e.photos_sold ?? 0) / e.photo_count) * 100)) : 0;

/** Armazenamento: bytes → "128 GB", com porcentagem da cota. */
export function storageSummary(bytes: number, quotaBytes: number) {
  const gb = bytes / 1e9;
  const used = gb >= 10 ? `${Math.round(gb)} GB` : gb >= 1 ? `${gb.toFixed(1).replace('.', ',')} GB` : `${Math.round(bytes / 1e6)} MB`;
  return { used, quota: `${Math.round(quotaBytes / 1e9)} GB`, percent: quotaBytes > 0 ? Math.min(100, Math.round((bytes / quotaBytes) * 100)) : 0 };
}
