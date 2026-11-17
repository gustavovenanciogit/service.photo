/**
 * LOJA DE FOTOS — PEDIDOS (Fase 2)
 * ------------------------------------------------------------------
 * Regras puras de pedido, pagamento (Mercado Pago) e download.
 * Usadas pelo servidor, pelas páginas e pelos testes.
 */
import { photoLabel } from './events.ts';

export const ORDER_STATUSES = [
  { id: 'pendente', label: 'Aguardando pagamento' },
  { id: 'pago', label: 'Pago' },
  { id: 'recusado', label: 'Pagamento recusado' },
  { id: 'expirado', label: 'Expirado' },
  { id: 'reembolsado', label: 'Reembolsado' },
  { id: 'divergente', label: 'Conferir (valor diferente)' },
  { id: 'teste', label: 'Teste (não conta)' },
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number]['id'];

export interface Order {
  id: string; // código para humanos: VNA-7K3P9Q
  token: string; // segredo do link de download
  event_id: string;
  event_name: string;
  event_slug: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  total: number;
  use_pack: boolean;
  photo_count: number;
  status: OrderStatus;
  checkout_url: string;
  payment_id: string;
  payment_method: string;
  paid_at: string;
  download_until: string;
  terms_version: string;
  provider: string; // 'mercadopago' (pedidos antigos podem ser 'infinitepay')
  notes: string;
  created_at: string;
  updated_at: string;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const randomChars = (n: number, alphabet: string) => {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
};
/** Código do pedido (sem letras confundíveis: 0/O, 1/I/L). */
export const orderCode = () => `VNA-${randomChars(6, '23456789ABCDEFGHJKMNPQRSTUVWXYZ')}`;
/** Segredo do link de download (256 bits). */
export const orderToken = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export interface CheckoutInput {
  slug: string;
  photo_ids: string[];
  name: string;
  email: string;
  phone: string;
}

/** Dados enviados pela galeria na hora de comprar. */
export function parseCheckout(input: unknown, maxPhotos: number): Result<CheckoutInput> {
  const o = (input ?? {}) as Record<string, unknown>;
  const slug = str(o.slug, 60);
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return { ok: false, error: 'Evento inválido.' };
  const ids = Array.isArray(o.photo_ids) ? [...new Set(o.photo_ids.filter((x): x is string => typeof x === 'string' && /^ph_[a-z0-9]{6,30}$/.test(x)))] : [];
  if (!ids.length) return { ok: false, error: 'Selecione ao menos uma foto.' };
  if (ids.length > maxPhotos) return { ok: false, error: `Máximo de ${maxPhotos} fotos por pedido.` };
  const name = str(o.name, 80);
  if (name.length < 2) return { ok: false, error: 'Informe seu nome.' };
  const email = str(o.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'Informe um e-mail válido.' };
  const phone = str(o.phone, 30).replace(/[^\d+()\s-]/g, '');
  if (phone.replace(/\D/g, '').length < 10) return { ok: false, error: 'Informe seu WhatsApp com DDD.' };
  if (o.accept !== true) return { ok: false, error: 'É preciso aceitar os Termos de compra.' };
  return { ok: true, value: { slug, photo_ids: ids, name, email, phone } };
}

/** Situação do pagamento no Mercado Pago → situação do pedido. */
export function mapPaymentStatus(mp: string): OrderStatus {
  switch (mp) {
    case 'approved':
      return 'pago';
    case 'refunded':
    case 'charged_back':
      return 'reembolsado';
    case 'rejected':
    case 'cancelled':
      return 'recusado';
    default: // pending, in_process, authorized, in_mediation
      return 'pendente';
  }
}

export interface MpPayment {
  id: number | string;
  status: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  payment_type_id?: string;
  date_approved?: string | null;
}

/**
 * Conferência do pagamento antes de liberar: o pedido certo, em reais e o valor exato.
 * Devolve o novo status do pedido.
 */
export function checkPayment(order: Pick<Order, 'id' | 'total'>, p: MpPayment): OrderStatus {
  if (p.external_reference !== order.id) return 'divergente';
  const status = mapPaymentStatus(p.status);
  if (status === 'pago' && (p.currency_id !== 'BRL' || Math.abs((p.transaction_amount ?? 0) - order.total) > 0.009)) return 'divergente';
  return status;
}

/**
 * Qual pagamento vale quando há vários para o mesmo pedido (ex.: 1º cartão recusado, depois Pix pago):
 * aprovado > reembolsado > pendente > recusado; empate: o mais recente.
 */
export function pickPayment(payments: (MpPayment & { date_created?: string })[]) {
  const rank: Record<OrderStatus, number> = { pago: 5, divergente: 4, reembolsado: 3, pendente: 2, recusado: 1, expirado: 0, teste: 0 };
  return [...payments].sort(
    (a, b) => rank[mapPaymentStatus(b.status)] - rank[mapPaymentStatus(a.status)] || String(b.date_created ?? '').localeCompare(String(a.date_created ?? '')),
  )[0];
}

/** Um pedido "pendente" vira "expirado" depois do prazo para pagar. */
export function effectiveStatus(o: Pick<Order, 'status' | 'created_at'>, pendingHours: number, now = new Date()): OrderStatus {
  if (o.status === 'pendente' && now.getTime() - Date.parse(o.created_at) > pendingHours * 3_600_000) return 'expirado';
  return o.status;
}

export const downloadUntil = (paidAtISO: string, days: number) => new Date(Date.parse(paidAtISO) + days * 86_400_000).toISOString();

export const canDownload = (o: Pick<Order, 'status' | 'download_until'>, now = new Date()) =>
  o.status === 'pago' && !!o.download_until && Date.parse(o.download_until) > now.getTime();

/** Nome do arquivo baixado: venart-corrida-da-ponte-0007.jpg */
export const downloadName = (slug: string, seq: number) => `venart-${slug.slice(0, 40)}-${photoLabel(seq).slice(1)}.jpg`;

/** Corpo da "preferência" do Checkout Pro (a página de pagamento do Mercado Pago). */
export function buildPreference(
  order: Pick<Order, 'id' | 'token' | 'total' | 'photo_count' | 'buyer_name' | 'buyer_email' | 'created_at'>,
  ev: { name: string },
  origin: string,
  cfg: { maxInstallments: number; pendingHours: number; statementDescriptor: string },
) {
  const back = `${origin}/pedido/${order.token}`;
  const expires = new Date(Date.parse(order.created_at) + cfg.pendingHours * 3_600_000).toISOString();
  const [first, ...rest] = order.buyer_name.split(/\s+/);
  return {
    items: [
      {
        id: order.id,
        title: `Fotos digitais — ${ev.name}`.slice(0, 120),
        description: `${order.photo_count} foto(s) em alta resolução`,
        quantity: 1,
        unit_price: order.total,
        currency_id: 'BRL',
      },
    ],
    payer: { name: first, surname: rest.join(' '), email: order.buyer_email },
    external_reference: order.id,
    notification_url: `${origin}/api/webhooks/mercadopago`,
    back_urls: { success: back, pending: back, failure: back },
    auto_return: 'approved',
    statement_descriptor: cfg.statementDescriptor,
    payment_methods: { installments: cfg.maxInstallments },
    expires: true,
    expiration_date_to: expires,
    binary_mode: false,
  };
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Assinatura das notificações do Mercado Pago (cabeçalho x-signature: "ts=...,v1=...").
 * Modelo assinado: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com HMAC-SHA256 da chave secreta.
 */
export async function verifyMpSignature(xSignature: string, xRequestId: string, dataId: string, secret: string) {
  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=');
      return [k, v.join('=')];
    }),
  ) as Record<string, string>;
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  let manifest = '';
  if (id) manifest += `id:${id};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${parts.ts};`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)));
  if (expected.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}

/** Mensagem de WhatsApp para mandar o link das fotos ao comprador. */
export function deliveryMessage(o: Pick<Order, 'buyer_name' | 'event_name' | 'download_until'>, link: string) {
  const first = o.buyer_name.split(/\s+/)[0];
  const until = o.download_until ? new Date(o.download_until).toLocaleDateString('pt-BR', { timeZone: 'America/Manaus' }) : '';
  return [
    `Oi${first ? `, ${first}` : ''}! Aqui estão suas fotos de *${o.event_name}* 📸`,
    '',
    link,
    '',
    until ? `O download fica disponível até ${until}. Salve as fotos no seu aparelho.` : 'Salve as fotos no seu aparelho.',
    'Obrigado pela compra!',
  ].join('\n');
}
