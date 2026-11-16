/**
 * LOJA DE FOTOS — pedidos, pagamento (Mercado Pago) e download (Fase 2)
 * ------------------------------------------------------------------
 * Público:
 *   POST /api/public/orders            → cria o pedido e devolve o link de pagamento do Mercado Pago
 *   GET  /api/public/orders/:token     → situação do pedido (confere no Mercado Pago se ainda pendente)
 *   POST /api/webhooks/mercadopago     → aviso de pagamento (assinatura conferida + consulta ao Mercado Pago)
 *   GET  /d/:token/:photoId/(thumb|full) → miniatura / download da foto comprada
 *   GET  /pedido/:token                → página "Minhas fotos"
 * Painel (exige login):
 *   GET   /api/orders                  → vendas
 *   PATCH /api/orders/:id              → conferir pagamento, liberar manualmente, bloquear, anotações
 *
 * Segurança:
 *   - o preço é sempre calculado aqui no servidor (nunca vem do navegador);
 *   - o download só é liberado depois de CONSULTAR o pagamento no Mercado Pago
 *     (pedido certo, em reais, valor exato), nunca só pelo aviso recebido;
 *   - o link de download é um segredo de 256 bits e vale até o fim do prazo de download.
 */
import { photoKey, publicState, selectionPrice } from '../src/lib/events.ts';
import {
  buildPreference, canDownload, checkPayment, downloadName, downloadUntil, effectiveStatus, orderCode, orderToken,
  parseCheckout, pickPayment, TOKEN_RE, verifyMpSignature, type MpPayment, type Order, type OrderStatus,
} from '../src/lib/orders.ts';
import { buildInfiniteLink, checkInfinite, infiniteMethod, linkUrl, parseInfiniteRef, type InfiniteCheck, type InfiniteRef } from '../src/lib/infinitepay.ts';
import { store } from '../src/config/store.ts';
import { getBySlug, type EventsEnv } from './events.ts';
import { ipHandle, provider, type Provider } from './payments.ts';

export type OrdersEnv = EventsEnv;

type Json = (data: unknown, status?: number, headers?: Record<string, string>) => Response;
type OrderRow = Omit<Order, 'use_pack'> & {
  use_pack: number;
  download_days: number;
  checked_at: number;
  preference_id: string;
  provider: Provider;
  payment_ref: string;
};

const now = () => new Date().toISOString();
const toOrder = (r: OrderRow) => ({ ...r, use_pack: !!r.use_pack, status: effectiveStatus(r, store.pendingHours) });

const byToken = (db: D1Database, token: string) => db.prepare('SELECT * FROM orders WHERE token = ?').bind(token).first<OrderRow>();
const byId = (db: D1Database, id: string) => db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>();

// ───────── Mercado Pago ─────────

export class MpError extends Error {
  status = 502;
}

async function mp<T>(env: OrdersEnv, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${env.MP_API_BASE || 'https://api.mercadopago.com'}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    console.error('Mercado Pago', path.split('?')[0], res.status, (await res.text()).slice(0, 300));
    throw new MpError('Não foi possível falar com o Mercado Pago. Tente de novo em instantes.');
  }
  return res.json() as Promise<T>;
}

/**
 * Consulta os pagamentos do pedido no Mercado Pago e atualiza a situação.
 * Nunca rebaixa um pedido pago por causa de outra tentativa recusada (pickPayment escolhe o aprovado).
 */
async function syncOrder(env: OrdersEnv, order: OrderRow, extraPaymentId = ''): Promise<OrderRow> {
  if (!env.MP_ACCESS_TOKEN || order.payment_method === 'manual') return order;
  const found = new Map<string, MpPayment & { date_created?: string }>();
  const search = await mp<{ results: (MpPayment & { date_created?: string })[] }>(
    env,
    `/v1/payments/search?external_reference=${encodeURIComponent(order.id)}&sort=date_created&criteria=desc&limit=50`,
  );
  search.results.forEach((p) => found.set(String(p.id), p));
  if (/^\d{1,20}$/.test(extraPaymentId) && !found.has(extraPaymentId)) {
    const p = await mp<MpPayment & { date_created?: string }>(env, `/v1/payments/${extraPaymentId}`);
    if (p.external_reference === order.id) found.set(String(p.id), p);
  }
  const t = Date.now();
  const payment = pickPayment([...found.values()]);
  if (!payment) {
    await env.DB.prepare('UPDATE orders SET checked_at = ? WHERE id = ?').bind(t, order.id).run();
    return { ...order, checked_at: t };
  }
  const status: OrderStatus = checkPayment(order, payment);
  let { paid_at, download_until } = order;
  if (status === 'pago' && !paid_at) {
    paid_at = payment.date_approved ? new Date(payment.date_approved).toISOString() : now();
    download_until = downloadUntil(paid_at, order.download_days);
  }
  if (status === 'divergente') console.error('Pagamento divergente', order.id, payment.id, payment.transaction_amount, payment.currency_id);
  const method = payment.payment_type_id ?? '';
  await env.DB
    .prepare('UPDATE orders SET status=?, payment_id=?, payment_method=?, paid_at=?, download_until=?, checked_at=?, updated_at=? WHERE id=?')
    .bind(status, String(payment.id), method, paid_at, download_until, t, now(), order.id)
    .run();
  return { ...order, status, payment_id: String(payment.id), payment_method: method, paid_at, download_until, checked_at: t };
}

// ───────── InfinitePay ─────────

async function ip<T>(env: OrdersEnv, path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.INFINITEPAY_API_KEY) headers['X-Api-Key'] = env.INFINITEPAY_API_KEY;
  const res = await fetch(`${env.IP_API_BASE || 'https://api.checkout.infinitepay.io'}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    console.error('InfinitePay', path, res.status, (await res.text()).slice(0, 300));
    throw new MpError('Não foi possível falar com a InfinitePay. Tente de novo em instantes.');
  }
  return res.json() as Promise<T>;
}

/**
 * Confere o pagamento na InfinitePay (payment_check). Precisa dos dados da transação, que chegam
 * pelo retorno do comprador ou pelo aviso (webhook); ficam guardados no pedido para conferências seguintes.
 */
async function syncInfinite(env: OrdersEnv, order: OrderRow, ref?: InfiniteRef | null): Promise<OrderRow> {
  const handle = ipHandle(env);
  if (!handle || order.payment_method === 'manual') return order;
  const r: InfiniteRef | null =
    ref && ref.order_nsu === order.id ? ref : order.payment_id && order.payment_ref ? { order_nsu: order.id, transaction_nsu: order.payment_id, slug: order.payment_ref } : null;
  const t = Date.now();
  if (!r) {
    await env.DB.prepare('UPDATE orders SET checked_at = ? WHERE id = ?').bind(t, order.id).run();
    return { ...order, checked_at: t };
  }
  const check = await ip<InfiniteCheck>(env, '/payment_check', { handle, order_nsu: r.order_nsu, transaction_nsu: r.transaction_nsu, slug: r.slug });
  // Transação desconhecida pela InfinitePay (dados errados ou inventados): não guarda nada.
  if (!check.success) {
    await env.DB.prepare('UPDATE orders SET checked_at = ? WHERE id = ?').bind(t, order.id).run();
    return { ...order, checked_at: t };
  }
  let status = checkInfinite(order, check);
  // A mesma transação não pode pagar dois pedidos.
  const dup = await env.DB.prepare("SELECT id FROM orders WHERE provider = 'infinitepay' AND payment_id = ? AND id != ?").bind(r.transaction_nsu, order.id).first();
  if (dup && status === 'pago') status = 'divergente';
  if (order.status === 'pago' && status !== 'pago') return order; // nunca rebaixa um pedido já pago
  if (status === 'pendente' && order.status !== 'pendente') status = order.status;
  let { paid_at, download_until } = order;
  if (status === 'pago' && !paid_at) {
    paid_at = now();
    download_until = downloadUntil(paid_at, order.download_days);
  }
  if (status === 'divergente') console.error('Pagamento divergente (InfinitePay)', order.id, r.transaction_nsu, check.amount);
  const method = infiniteMethod(check.capture_method);
  await env.DB
    .prepare('UPDATE orders SET status=?, payment_id=?, payment_ref=?, payment_method=?, paid_at=?, download_until=?, checked_at=?, updated_at=? WHERE id=?')
    .bind(status, r.transaction_nsu, r.slug, method, paid_at, download_until, t, now(), order.id)
    .run();
  return { ...order, status, payment_id: r.transaction_nsu, payment_ref: r.slug, payment_method: method, paid_at, download_until, checked_at: t };
}

/** Confere o pagamento no meio usado pelo pedido. */
const syncAny = (env: OrdersEnv, order: OrderRow, opts: { mpPaymentId?: string; ipRef?: InfiniteRef | null } = {}) =>
  order.provider === 'infinitepay' ? syncInfinite(env, order, opts.ipRef) : syncOrder(env, order, opts.mpPaymentId ?? '');

// ───────── Público ─────────

export async function createOrder(req: Request, env: OrdersEnv, url: URL, body: unknown, json: Json) {
  const prov = provider(env);
  if (!prov) return json({ error: 'A compra online ainda não está ativa. Faça o pedido pelo WhatsApp.' }, 503);
  const parsed = parseCheckout(body, store.maxPhotosPerOrder);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const c = parsed.value;
  const ev = await getBySlug(env.DB, c.slug);
  if (!ev || publicState(ev) !== 'aberto') return json({ error: 'A venda deste evento não está aberta.' }, 409);

  // Fotos: precisam existir, estar prontas e ser deste evento (até 90 por consulta, limite do D1).
  const photos: { id: string; seq: number }[] = [];
  for (let i = 0; i < c.photo_ids.length; i += 90) {
    const chunk = c.photo_ids.slice(i, i + 90);
    const q = `SELECT id, seq FROM event_photos WHERE event_id = ? AND ready = 1 AND id IN (${chunk.map(() => '?').join(',')})`;
    photos.push(...(await env.DB.prepare(q).bind(ev.id, ...chunk).all<{ id: string; seq: number }>()).results);
  }
  if (photos.length !== c.photo_ids.length) return json({ error: 'Algumas fotos não estão mais disponíveis. Atualize a página.' }, 409);

  const price = selectionPrice(photos.length, ev);
  const t = now();
  const order = {
    id: orderCode(),
    token: orderToken(),
    total: price.total,
    photo_count: photos.length,
    buyer_name: c.name,
    buyer_email: c.email,
    created_at: t,
  };
  const db = env.DB;
  const stmts = [
    db
      .prepare(
        `INSERT INTO orders (id, token, event_id, event_name, event_slug, buyer_name, buyer_email, buyer_phone, total, use_pack, photo_count,
         status, download_days, terms_version, provider, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, 'pendente', ?,?,?,?,?)`,
      )
      .bind(order.id, order.token, ev.id, ev.name, ev.slug, c.name, c.email, c.phone, price.total, price.usePack ? 1 : 0, photos.length, ev.download_days, store.termsVersion, prov, t, t),
  ];
  // Itens em blocos de 33 (3 parâmetros cada, até 99 por consulta).
  for (let i = 0; i < photos.length; i += 33) {
    const chunk = photos.slice(i, i + 33);
    stmts.push(
      db
        .prepare(`INSERT INTO order_items (order_id, photo_id, seq) VALUES ${chunk.map(() => '(?,?,?)').join(',')}`)
        .bind(...chunk.flatMap((p) => [order.id, p.id, p.seq])),
    );
  }
  await db.batch(stmts);

  try {
    if (prov === 'infinitepay') {
      const link = await ip<{ url?: unknown; checkout_url?: unknown }>(env, '/links', buildInfiniteLink(order, ev, url.origin, ipHandle(env)));
      const checkout = linkUrl(link);
      if (!checkout) throw new MpError('A InfinitePay não devolveu o link de pagamento. Tente de novo.');
      await db.prepare('UPDATE orders SET checkout_url = ? WHERE id = ?').bind(checkout, order.id).run();
      return json({ ok: true, id: order.id, token: order.token, checkout_url: checkout }, 201);
    }
    const pref = await mp<{ id: string; init_point: string }>(env, '/checkout/preferences', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': order.id },
      body: JSON.stringify(buildPreference(order, ev, url.origin, store)),
    });
    await db.prepare('UPDATE orders SET checkout_url = ?, preference_id = ? WHERE id = ?').bind(pref.init_point, pref.id, order.id).run();
    return json({ ok: true, id: order.id, token: order.token, checkout_url: pref.init_point }, 201);
  } catch (e) {
    await db.batch([db.prepare('DELETE FROM order_items WHERE order_id = ?').bind(order.id), db.prepare('DELETE FROM orders WHERE id = ?').bind(order.id)]);
    throw e;
  }
}

export async function orderStatus(env: OrdersEnv, token: string, url: URL, json: Json) {
  if (!TOKEN_RE.test(token)) return json({ error: 'Pedido não encontrado.' }, 404);
  let row = await byToken(env.DB, token);
  if (!row) return json({ error: 'Pedido não encontrado.' }, 404);
  // Ainda pendente? Confere no meio de pagamento (no máximo a cada 10 s por pedido, ou na volta do pagamento).
  const pid = url.searchParams.get('payment_id') ?? '';
  const ipRef = parseInfiniteRef(Object.fromEntries(url.searchParams));
  if (['pendente', 'recusado'].includes(row.status) && (Date.now() - row.checked_at > 10_000 || pid || ipRef)) {
    try {
      row = await syncAny(env, row, { mpPaymentId: pid, ipRef });
    } catch (e) {
      console.error(e);
    }
  }
  const o = toOrder(row);
  const items = (await env.DB.prepare('SELECT photo_id AS id, seq AS n FROM order_items WHERE order_id = ? ORDER BY seq').bind(o.id).all<{ id: string; n: number }>()).results;
  return json(
    {
      id: o.id,
      status: o.status,
      event_name: o.event_name,
      event_slug: o.event_slug,
      buyer_first_name: o.buyer_name.split(/\s+/)[0],
      total: o.total,
      use_pack: o.use_pack,
      photo_count: o.photo_count,
      paid_at: o.paid_at,
      download_until: o.download_until,
      can_download: canDownload(o),
      checkout_url: ['pendente', 'recusado'].includes(o.status) ? o.checkout_url : '',
      items,
    },
    200,
    { 'Referrer-Policy': 'no-referrer' },
  );
}

/**
 * Aviso de pagamento da InfinitePay. Não é assinado: serve só de gatilho para a conferência no payment_check.
 * Resposta 400 faz a InfinitePay tentar de novo (ex.: pagamento ainda não confirmado).
 */
export async function webhookInfinite(req: Request, env: OrdersEnv, json: Json) {
  if (!ipHandle(env)) return json({ ok: true });
  const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const ref = parseInfiniteRef(body);
  if (!ref) return json({ ok: true });
  const order = await byId(env.DB, ref.order_nsu);
  if (!order || order.provider !== 'infinitepay') return json({ ok: true });
  const updated = await syncInfinite(env, order, ref);
  return updated.status === 'pago' || updated.status === 'divergente' ? json({ ok: true }) : json({ error: 'Pagamento ainda não confirmado.' }, 400);
}

export async function webhook(req: Request, env: OrdersEnv, url: URL, json: Json) {
  if (!env.MP_ACCESS_TOKEN) return json({ ok: true });
  const body = ((await req.json().catch(() => ({}))) ?? {}) as { type?: string; data?: { id?: unknown } };
  const type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? body.type ?? '';
  if (type !== 'payment') return json({ ok: true }); // outros avisos: ignorados
  const dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? String(body.data?.id ?? '');
  if (!/^\d{1,20}$/.test(dataId)) return json({ ok: true });
  if (env.MP_WEBHOOK_SECRET) {
    const ok = await verifyMpSignature(req.headers.get('x-signature') ?? '', req.headers.get('x-request-id') ?? '', dataId, env.MP_WEBHOOK_SECRET);
    if (!ok) return json({ error: 'Assinatura inválida.' }, 401);
  }
  // Não confia no aviso: consulta o pagamento direto no Mercado Pago.
  const payment = await mp<MpPayment>(env, `/v1/payments/${dataId}`);
  const ref = payment.external_reference ?? '';
  const order = /^VNA-[A-Z0-9]{6}$/.test(ref) ? await byId(env.DB, ref) : null;
  if (!order) return json({ ok: true });
  await syncOrder(env, order, dataId);
  return json({ ok: true });
}

/** /d/:token/:photoId/(thumb|full) */
export async function serveDownload(env: OrdersEnv, path: string) {
  const notFound = () => new Response('Não encontrado', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const m = /^\/d\/([A-Za-z0-9_-]{43})\/(ph_[a-z0-9]{6,30})\/(thumb|full)$/.exec(path);
  if (!m || !env.PHOTOS) return notFound();
  const [, token, photoId, kind] = m as unknown as [string, string, string, 'thumb' | 'full'];
  const row = await byToken(env.DB, token);
  if (!row) return notFound();
  const item = await env.DB.prepare('SELECT seq FROM order_items WHERE order_id = ? AND photo_id = ?').bind(row.id, photoId).first<{ seq: number }>();
  if (!item) return notFound();
  const o = toOrder(row);
  if (kind === 'full' && !canDownload(o)) return new Response('Download indisponível para este pedido.', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  const obj = await env.PHOTOS.get(photoKey(row.event_id, kind === 'full' ? 'sale' : 'thumb', photoId));
  if (!obj) return notFound();
  const headers: Record<string, string> = {
    'Content-Type': 'image/jpeg',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex',
    'Cache-Control': kind === 'full' ? 'private, no-store' : 'private, max-age=86400',
  };
  if (kind === 'full') {
    headers['Content-Disposition'] = `attachment; filename="${downloadName(row.event_slug, item.seq)}"`;
    if (obj.size) headers['Content-Length'] = String(obj.size);
  }
  return new Response(obj.body, { headers });
}

/** /pedido/:token → página estática "Minhas fotos" (sem enviar o endereço para outros sites). */
export async function serveOrderPage(req: Request, env: OrdersEnv, url: URL) {
  const page = await env.ASSETS.fetch(new Request(new URL('/pedido/', url.origin), req));
  const r = new Response(page.body, page);
  r.headers.set('Referrer-Policy', 'no-referrer');
  r.headers.set('Cache-Control', 'no-store');
  r.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return r;
}

// ───────── Painel ─────────

export async function ordersAdminApi(req: Request, env: OrdersEnv, path: string, json: Json, readJson: (r: Request) => Promise<unknown>) {
  const db = env.DB;
  if (path === '/api/orders' && req.method === 'GET') {
    const rows = (await db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 1000').all<OrderRow>()).results;
    const prov = provider(env);
    return json({ configured: !!prov, provider: prov ?? '', orders: rows.map(({ checked_at: _c, preference_id: _p, payment_ref: _r, ...r }) => toOrder(r as OrderRow)) });
  }
  const m = /^\/api\/orders\/(VNA-[A-Z0-9]{6})$/.exec(path);
  if (!m || req.method !== 'PATCH') return json({ error: 'Não encontrado.' }, 404);
  let row = await byId(db, m[1]!);
  if (!row) return json({ error: 'Pedido não encontrado.' }, 404);
  const body = (await readJson(req)) as { action?: unknown; notes?: unknown };
  const t = now();
  if (typeof body.notes === 'string') {
    await db.prepare('UPDATE orders SET notes = ?, updated_at = ? WHERE id = ?').bind(body.notes.slice(0, 2000), t, row.id).run();
  }
  if (body.action === 'sync') {
    if (row.provider === 'infinitepay') {
      if (!ipHandle(env)) return json({ error: 'InfinitePay não configurada.' }, 503);
      if (!row.payment_id || !row.payment_ref) {
        return json({ error: 'A InfinitePay ainda não enviou os dados deste pagamento. Confira no app da InfinitePay; se estiver pago, use "Liberar".' }, 409);
      }
    } else if (!env.MP_ACCESS_TOKEN) return json({ error: 'Mercado Pago não configurado.' }, 503);
    row = await syncAny(env, row);
  } else if (body.action === 'release') {
    // Pagou por fora (ex.: Pix direto): libera o download a partir de agora.
    if (row.status === 'pago') return json({ error: 'Este pedido já está pago.' }, 409);
    await db
      .prepare("UPDATE orders SET status='pago', payment_method='manual', payment_id='manual', paid_at=?, download_until=?, updated_at=? WHERE id=?")
      .bind(t, downloadUntil(t, row.download_days), t, row.id)
      .run();
  } else if (body.action === 'block') {
    // Reembolso feito fora do sistema: bloqueia o download.
    await db.prepare("UPDATE orders SET status='reembolsado', updated_at=? WHERE id=?").bind(t, row.id).run();
  } else if (body.action === 'extend') {
    // Mais 30 dias de download (ex.: comprador perdeu o prazo).
    if (row.status !== 'pago') return json({ error: 'Só pedidos pagos.' }, 409);
    const base = Math.max(Date.now(), Date.parse(row.download_until || t));
    await db.prepare('UPDATE orders SET download_until=?, updated_at=? WHERE id=?').bind(new Date(base + 30 * 86_400_000).toISOString(), t, row.id).run();
  } else if (body.action !== undefined) {
    return json({ error: 'Ação inválida.' }, 400);
  }
  const updated = (await byId(db, row.id))!;
  const { checked_at: _c, preference_id: _p, payment_ref: _r, ...rest } = updated;
  return json(toOrder(rest as OrderRow));
}

