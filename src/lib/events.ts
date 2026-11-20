/**
 * LOJA DE FOTOS — EVENTOS (Fase 1)
 * ------------------------------------------------------------------
 * Regras puras: usadas pelo servidor (worker/), pelo painel e pelos testes.
 *
 * Arquivos no R2 (bucket privado):
 *   events/<eventId>/sale/<photoId>.jpg     → versão de venda (NUNCA servida sem compra)
 *   events/<eventId>/preview/<photoId>.jpg  → prévia ~1200 px com marca d'água (pública)
 *   events/<eventId>/thumb/<photoId>.jpg    → miniatura ~480 px com marca d'água (pública)
 */
import { slugify } from './site-content.ts';
import { formatBRL } from './whatsapp.ts';

export const EVENT_STATUSES = [
  { id: 'rascunho', label: 'Rascunho' },
  { id: 'publicado', label: 'Publicado' },
  { id: 'encerrado', label: 'Encerrado' },
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number]['id'];

export const PHOTO_PARTS = ['thumb', 'preview', 'sale'] as const;
export type PhotoPart = (typeof PHOTO_PARTS)[number];

/** Padrões (podem ser alterados em cada evento). Valores da Tabela 2026 e do checklist (item 0.4). */
export const EVENT_DEFAULTS = { price_single: 12.9, price_pack: 119.9, sale_days: 180, download_days: 30 };

export interface EventRecord {
  id: string;
  slug: string;
  name: string;
  date: string; // AAAA-MM-DD
  location: string;
  category: string;
  description: string;
  cover_photo_id: string;
  price_single: number;
  price_pack: number; // 0 = sem pacote
  sale_days: number;
  download_days: number;
  status: EventStatus;
  listed: boolean; // aparecer no site público (Fase 4)
  watermark_model: number; // 0 = modelo padrão; 1–8 = modelo próprio desta galeria
  cover_image: string; // capa da página (vazio = sem capa); guarda a data do envio (versão)
  cover_position: string; // enquadramento da capa, ex.: "50% 40%"
  face_search: number; // 1 = busca por selfie ligada para compradores (exige aviso do evento confirmado)
  face_pack_at: string; // quando o pacote de busca por rostos foi gerado (vazio = sem pacote)
  photo_count: number;
  published_at: string; // ISO
  purged_at: string; // quando os arquivos foram apagados automaticamente (vazio = ainda guardados)
  created_at: string;
  updated_at: string;
}

export interface EventPhoto {
  id: string;
  event_id: string;
  file_name: string;
  seq: number; // número exibido ao cliente (#0001)
  width: number;
  height: number;
  ready: boolean;
  wm_sig: string; // assinatura da marca d'água aplicada (para saber se precisa refazer)
}

export type EventInput = Pick<
  EventRecord,
  'name' | 'date' | 'location' | 'category' | 'description' | 'price_single' | 'price_pack' | 'sale_days' | 'download_days' | 'status' | 'listed' | 'cover_photo_id' | 'watermark_model' | 'cover_position'
> & { slug: string };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, min: number, max: number, fallback: number) => {
  if (v === undefined || v === null || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : fallback;
};

/** Endereço curto do evento: "Treino KOHË — 20/11" → "treino-kohe-20-11". */
export const eventSlug = (name: string, date = '') => {
  const d = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return slugify(`${name}${d ? ` ${d[2]}-${d[1]}` : ''}`).slice(0, 60);
};

/** Enquadramento da capa: "X% Y%" (0–100). */
export const coverPosition = (v: unknown) => {
  const m = /^(\d{1,3})% (\d{1,3})%$/.exec(String(v ?? ''));
  return m && Number(m[1]) <= 100 && Number(m[2]) <= 100 ? `${Number(m[1])}% ${Number(m[2])}%` : '50% 50%';
};

export function parseEvent(input: unknown): Result<EventInput> {
  const o = (input ?? {}) as Record<string, unknown>;
  const name = str(o.name, 120);
  if (!name) return { ok: false, error: 'Informe o nome do evento.' };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(o.date ?? '')) ? String(o.date) : '';
  if (!date) return { ok: false, error: 'Informe a data do evento.' };
  const rawSlug = str(o.slug, 60);
  const slug = rawSlug ? slugify(rawSlug) : eventSlug(name, date);
  const status = EVENT_STATUSES.some((s) => s.id === o.status) ? (o.status as EventStatus) : 'rascunho';
  return {
    ok: true,
    value: {
      name,
      date,
      slug,
      location: str(o.location, 160),
      category: str(o.category, 40),
      description: str(o.description, 600),
      cover_photo_id: str(o.cover_photo_id, 40),
      price_single: num(o.price_single, 0.5, 10_000, EVENT_DEFAULTS.price_single),
      price_pack: num(o.price_pack, 0, 100_000, EVENT_DEFAULTS.price_pack),
      sale_days: Math.round(num(o.sale_days, 1, 3650, EVENT_DEFAULTS.sale_days)),
      download_days: Math.round(num(o.download_days, 1, 365, EVENT_DEFAULTS.download_days)),
      status,
      listed: o.listed === true,
      watermark_model: [1, 2, 3, 4, 5, 6, 7, 8].includes(Number(o.watermark_model)) ? Number(o.watermark_model) : 0,
      cover_position: coverPosition(o.cover_position),
    },
  };
}

const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString();

/** Data em que a venda encerra (a partir da publicação). */
export const saleEndsAt = (e: Pick<EventRecord, 'published_at' | 'sale_days'>) => (e.published_at ? addDays(e.published_at, e.sale_days) : '');

/** Situação vista pelo público: rascunho e encerrados não aparecem; publicação vencida = encerrado. */
export function publicState(e: Pick<EventRecord, 'status' | 'published_at' | 'sale_days'>, now = new Date()): 'oculto' | 'aberto' | 'encerrado' {
  if (e.status === 'rascunho') return 'oculto';
  if (e.status === 'encerrado') return 'encerrado';
  const end = saleEndsAt(e);
  return end && Date.parse(end) < now.getTime() ? 'encerrado' : 'aberto';
}

/** Quando os arquivos podem ser apagados: fim da venda + prazo de download dos compradores. */
export const purgeAfter = (e: Pick<EventRecord, 'published_at' | 'sale_days' | 'download_days'>) =>
  e.published_at ? addDays(e.published_at, e.sale_days + e.download_days) : '';

export const photoKey = (eventId: string, part: PhotoPart, photoId: string) => `events/${eventId}/${part}/${photoId}.jpg`;

/** Preço da seleção: menor valor entre "quantidade × avulsa" e o pacote (se houver pacote). */
export function selectionPrice(count: number, e: Pick<EventRecord, 'price_single' | 'price_pack'>) {
  const single = Math.round(count * e.price_single * 100) / 100;
  const usePack = e.price_pack > 0 && count > 0 && e.price_pack < single;
  return { total: usePack ? e.price_pack : single, usePack, full: single };
}

export const photoLabel = (seq: number) => `#${String(seq).padStart(4, '0')}`;

/** Mensagem de pedido pelo WhatsApp (enquanto o pagamento automático não está ativo). */
export function orderMessage(e: Pick<EventRecord, 'name' | 'date' | 'price_single' | 'price_pack'>, seqs: number[], link: string) {
  const sorted = [...seqs].sort((a, b) => a - b);
  const p = selectionPrice(sorted.length, e);
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.date);
  return [
    `Olá! Quero comprar fotos do evento "${e.name}"${d ? ` (${d[3]}/${d[2]})` : ''}.`,
    '',
    `Fotos (${sorted.length}): ${sorted.map(photoLabel).join(', ')}`,
    `Total: ${formatBRL(p.total)}${p.usePack ? ' (pacote)' : ''}`,
    '',
    `Galeria: ${link}`,
  ].join('\n');
}
