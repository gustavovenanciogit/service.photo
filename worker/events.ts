/**
 * LOJA DE FOTOS — servidor dos eventos (Fase 1)
 * ------------------------------------------------------------------
 * Painel (exige login):
 *   GET/POST   /api/events                      → lista / cria
 *   GET/PUT/DELETE /api/events/:id              → detalhes / edita / exclui (apaga também os arquivos)
 *   GET        /api/events/:id/photos           → fotos (para retomar envio e montar a grade)
 *   POST       /api/events/:id/photos           → registra até 25 nomes de arquivo (numeração #0001… pela ordem do nome)
 *   PUT        /api/events/:id/photos/:pid/:part → envia um arquivo (thumb | preview | sale) para o R2
 *   POST       /api/events/:id/photos/:pid/complete → marca a foto como pronta
 *   DELETE     /api/events/:id/photos/:pid      → remove a foto
 * Público:
 *   GET /api/public/events/:slug?after=<seq>    → dados do evento + fotos (paginado)
 *   GET /f/:eventId/:photoId/(thumb|preview).jpg → imagens com marca d'água (nunca a versão de venda)
 *   GET /e/:slug                                 → página da galeria (com título e capa para compartilhar)
 */
import {
  parseEvent, photoKey, PHOTO_PARTS, publicState, purgeAfter, saleEndsAt,
  type EventInput, type EventPhoto, type EventRecord, type PhotoPart,
} from '../src/lib/events.ts';
import { newId } from '../src/lib/crm.ts';
import { mpConfigured, type PaymentsEnv } from './payments.ts';
import { getWatermarkSettings } from './settings.ts';
import { jpegSize } from '../src/lib/jpeg.ts';
import { ORDER_SQL, ORIENTATION_SQL, parseGalleryQuery } from '../src/lib/gallery.ts';
import { imageKind } from '../src/lib/site-content.ts';
import { purgeFaces } from './faces.ts';
import { verifyPhotoAccess } from './auth.ts';

export interface EventsEnv extends PaymentsEnv {
  DB: D1Database;
  PHOTOS?: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
}

/** Fotos compradas com download ainda válido não podem ser apagadas. */
const ACTIVE_SALES = `SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id
  WHERE o.status = 'pago' AND o.download_until > ?`;

type Json = (data: unknown, status?: number, headers?: Record<string, string>) => Response;

/** Limite de tamanho por arquivo. */
export const PART_LIMITS: Record<PhotoPart, number> = { thumb: 400_000, preview: 2_000_000, sale: 25_000_000 };
const PAGE = 120;
export const MAX_REGISTER = 25;

type EventRow = Omit<EventRecord, 'listed' | 'face_only'> & { listed: number; face_only: number };
type PhotoRow = Omit<EventPhoto, 'ready'> & { ready: number };
const toEvent = (r: EventRow | null): EventRecord | null => (r ? { ...r, listed: !!r.listed, face_only: !!r.face_only } : null);
const toPhoto = (r: PhotoRow): EventPhoto => ({ ...r, ready: !!r.ready });
const now = () => new Date().toISOString();

export const getEvent = async (db: D1Database, id: string) => toEvent(await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first<EventRow>());
export const getBySlug = async (db: D1Database, slug: string) =>
  toEvent(await db.prepare('SELECT * FROM events WHERE slug = ?').bind(slug).first<EventRow>());

const slugTaken = async (db: D1Database, slug: string, exceptId = '') =>
  !!(await db.prepare('SELECT 1 FROM events WHERE slug = ? AND id != ?').bind(slug, exceptId).first());

const recount = (db: D1Database, eventId: string) =>
  db
    .prepare('UPDATE events SET photo_count = (SELECT COUNT(*) FROM event_photos WHERE event_id = ?1 AND ready = 1), updated_at = ?2 WHERE id = ?1')
    .bind(eventId, now())
    .run();

/**
 * Apaga todos os arquivos com um prefixo (em lotes de até 1000).
 * maxPages limita o trabalho por execução; devolve true quando não sobrou nada.
 */
/** Zera o valor guardado do armazenamento usado (o painel recalcula na próxima vez). */
const forgetStorage = (db: D1Database) => db.prepare("DELETE FROM settings WHERE key = 'storage_usage'");

async function purgePrefix(bucket: R2Bucket, prefix: string, maxPages = Infinity) {
  for (let i = 0; i < maxPages; i++) {
    // Sempre a primeira página: o que foi apagado some da listagem.
    const page = await bucket.list({ prefix, limit: 1000 });
    if (!page.objects.length) return true;
    await bucket.delete(page.objects.map((o) => o.key));
    if (!page.truncated) return true;
  }
  return false;
}

/**
 * LIMPEZA AUTOMÁTICA (roda 1×/dia): apaga os arquivos dos eventos cujo prazo terminou
 * (publicação + prazo de venda + prazo de download), como dizem os Termos de compra.
 * Nunca apaga se algum comprador ainda tem download válido (ex.: prazo estendido no painel).
 * Os dados do evento e dos pedidos ficam (relatórios); só as fotos saem.
 */
export async function purgeExpired(env: EventsEnv, now = new Date()) {
  if (!env.PHOTOS) return [];
  const db = env.DB;
  const rows = (await db.prepare("SELECT * FROM events WHERE published_at != '' AND purged_at = ''").all<EventRow>()).results;
  const done: string[] = [];
  for (const e of rows.map((r) => toEvent(r)!)) {
    const after = purgeAfter(e);
    if (!after || Date.parse(after) > now.getTime()) continue;
    if (await db.prepare(`${ACTIVE_SALES} AND o.event_id = ? LIMIT 1`).bind(now.toISOString(), e.id).first()) continue;
    // Até 20 lotes por dia (limite de chamadas do plano gratuito); o resto continua no dia seguinte.
    const finished = await purgePrefix(env.PHOTOS, `events/${e.id}/`, 20);
    if (!finished) break;
    const t = now.toISOString();
    await db.batch([
      db.prepare('DELETE FROM event_photos WHERE event_id = ?').bind(e.id),
      ...purgeFaces(db, e.id),
      forgetStorage(db),
      db.prepare("UPDATE events SET purged_at = ?, photo_count = 0, cover_photo_id = '', cover_image = '', status = 'encerrado', face_search = 0, face_pack_at = '', updated_at = ? WHERE id = ?").bind(t, t, e.id),
    ]);
    console.log('Limpeza: arquivos apagados do evento', e.id, e.name);
    done.push(e.id);
    break; // um evento por execução
  }
  return done;
}

const needBucket = (env: EventsEnv, json: Json) =>
  env.PHOTOS ? null : json({ error: 'Armazenamento de fotos (R2) não configurado nesta publicação.' }, 503);

// ───────── Painel ─────────

export async function eventsApi(req: Request, env: EventsEnv, path: string, json: Json, readJson: (r: Request) => Promise<unknown>) {
  const method = req.method;
  const db = env.DB;

  if (path === '/api/events') {
    if (method === 'GET') {
      // Com o resumo de vendas de cada evento (só pedidos pagos; pedidos de teste não contam).
      const rows = (
        await db
          .prepare(
            `SELECT e.*, COALESCE(s.total, 0) AS sales_total, COALESCE(s.n, 0) AS orders_paid, COALESCE(p.sold, 0) AS photos_sold
             FROM events e
             LEFT JOIN (SELECT event_id, SUM(total) AS total, COUNT(*) AS n FROM orders WHERE status = 'pago' GROUP BY event_id) s ON s.event_id = e.id
             LEFT JOIN (SELECT o.event_id, COUNT(DISTINCT i.photo_id) AS sold FROM orders o JOIN order_items i ON i.order_id = o.id
                        WHERE o.status = 'pago' GROUP BY o.event_id) p ON p.event_id = e.id
             ORDER BY e.date DESC, e.created_at DESC`,
          )
          .all<EventRow & { sales_total: number; orders_paid: number; photos_sold: number }>()
      ).results;
      return json(rows.map((r) => ({ ...toEvent(r), sales_total: Math.round(r.sales_total * 100) / 100, orders_paid: r.orders_paid, photos_sold: r.photos_sold })));
    }
    if (method === 'POST') {
      const parsed = parseEvent(await readJson(req));
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      const e = parsed.value;
      // Endereço já usado? Acrescenta -2, -3…
      let slug = e.slug;
      for (let i = 2; await slugTaken(db, slug); i++) slug = `${e.slug.slice(0, 56)}-${i}`;
      const id = newId('evt');
      await insertOrUpdate(db, id, { ...e, slug }, null);
      return json(await getEvent(db, id), 201);
    }
  }

  // Duplicar (ex.: treino semanal): mesmos dados e preços, sem fotos, como rascunho.
  const dup = /^\/api\/events\/(evt_[a-z0-9]{6,30})\/duplicate$/.exec(path);
  if (dup && method === 'POST') {
    const src = await getEvent(db, dup[1]!);
    if (!src) return json({ error: 'Evento não encontrado.' }, 404);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Manaus' }).format(new Date());
    const parsed = parseEvent({ ...src, name: `${src.name} (cópia)`.slice(0, 120), date: today, slug: '', status: 'rascunho', cover_photo_id: '' });
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    let slug = parsed.value.slug;
    for (let i = 2; await slugTaken(db, slug); i++) slug = `${parsed.value.slug.slice(0, 56)}-${i}`;
    const id = newId('evt');
    await insertOrUpdate(db, id, { ...parsed.value, slug }, null);
    return json(await getEvent(db, id), 201);
  }

  // Capa opcional da página do evento (não entra na galeria de vendas).
  const cov = /^\/api\/events\/(evt_[a-z0-9]{6,30})\/cover$/.exec(path);
  if (cov) {
    const ev = await getEvent(db, cov[1]!);
    if (!ev) return json({ error: 'Evento não encontrado.' }, 404);
    if (!env.PHOTOS) return json({ error: 'Armazenamento (R2) não configurado.' }, 503);
    const key = `events/${ev.id}/cover.jpg`;
    if (method === 'PUT') {
      const bytes = new Uint8Array(await req.arrayBuffer());
      if (!bytes.length || bytes.length > 3_000_000) return json({ error: 'Capa vazia ou grande demais (máx. 3 MB).' }, 413);
      const dims = imageKind(bytes) === 'jpg' ? jpegSize(bytes) : null;
      if (!dims) return json({ error: 'Envie a capa em JPG.' }, 415);
      if (Math.max(dims.width, dims.height) > 2400) return json({ error: 'Capa grande demais (máx. 2400 px).' }, 422);
      await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
      await db.prepare('UPDATE events SET cover_image = ?, updated_at = ? WHERE id = ?').bind(now(), now(), ev.id).run();
      return json(await getEvent(db, ev.id));
    }
    if (method === 'DELETE') {
      await env.PHOTOS.delete(key);
      await db.prepare("UPDATE events SET cover_image = '', updated_at = ? WHERE id = ?").bind(now(), ev.id).run();
      return json(await getEvent(db, ev.id));
    }
    return json({ error: 'Não encontrado.' }, 404);
  }

  const m = /^\/api\/events\/(evt_[a-z0-9]{6,30})(?:\/photos(?:\/(ph_[a-z0-9]{6,30})(?:\/(thumb|preview|sale|complete|original))?)?)?$/.exec(path);
  if (!m) return json({ error: 'Não encontrado.' }, 404);
  const [, eventId, photoId, part] = m as unknown as [string, string, string | undefined, string | undefined];
  const event = await getEvent(db, eventId);
  if (!event) return json({ error: 'Evento não encontrado.' }, 404);
  const isPhotos = path.includes('/photos');

  // ── Evento ──
  if (!isPhotos) {
    if (method === 'GET') return json(event);
    if (method === 'PUT') {
      const parsed = parseEvent(await readJson(req));
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      if (await slugTaken(db, parsed.value.slug, eventId)) return json({ error: 'Este endereço já é usado por outro evento.' }, 409);
      if (parsed.value.cover_photo_id && !(await db.prepare('SELECT 1 FROM event_photos WHERE id = ? AND event_id = ?').bind(parsed.value.cover_photo_id, eventId).first())) {
        parsed.value.cover_photo_id = '';
      }
      await insertOrUpdate(db, eventId, parsed.value, event);
      return json(await getEvent(db, eventId));
    }
    if (method === 'DELETE') {
      if (await db.prepare(`${ACTIVE_SALES} AND o.event_id = ? LIMIT 1`).bind(now(), eventId).first()) {
        return json({ error: 'Há compradores com download ainda válido neste evento. Exclua depois que o prazo de download terminar.' }, 409);
      }
      if (env.PHOTOS) await purgePrefix(env.PHOTOS, `events/${eventId}/`);
      await db.batch([db.prepare('DELETE FROM event_photos WHERE event_id = ?').bind(eventId), ...purgeFaces(db, eventId), forgetStorage(db), db.prepare('DELETE FROM events WHERE id = ?').bind(eventId)]);
      return json({ ok: true });
    }
    return json({ error: 'Não encontrado.' }, 404);
  }

  // ── Fotos ──
  if (!photoId) {
    if (method === 'GET') {
      // Com quantas vezes cada foto foi vendida (pedidos pagos; pedidos de teste não contam).
      const rows = (
        await db
          .prepare(
            `SELECT p.*, COALESCE(s.n, 0) AS sold FROM event_photos p
             LEFT JOIN (SELECT i.photo_id, COUNT(*) AS n FROM order_items i JOIN orders o ON o.id = i.order_id
                        WHERE o.event_id = ?1 AND o.status = 'pago' GROUP BY i.photo_id) s ON s.photo_id = p.id
             WHERE p.event_id = ?1 ORDER BY p.seq`,
          )
          .bind(eventId)
          .all<PhotoRow & { sold: number }>()
      ).results;
      return json(rows.map((r) => ({ ...toPhoto(r), sold: r.sold })));
    }
    if (method === 'POST') {
      // Registra até 25 nomes por vez (limite de consultas do D1 no plano gratuito); nomes já registrados devolvem o mesmo id (permite retomar o envio).
      const body = (await readJson(req)) as { names?: unknown };
      const names = Array.isArray(body.names) ? [...new Set(body.names.filter((n): n is string => typeof n === 'string').map((n) => n.trim().slice(0, 160)).filter(Boolean))] : [];
      if (!names.length || names.length > MAX_REGISTER) return json({ error: `Envie de 1 a ${MAX_REGISTER} nomes de arquivo por vez.` }, 400);
      names.sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
      const t = now();
      const stmts = names.map((n) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO event_photos (id, event_id, file_name, seq, created_at)
             SELECT ?1, ?2, ?3, COALESCE(MAX(seq), 0) + 1, ?4 FROM event_photos WHERE event_id = ?2`,
          )
          .bind(newId('ph'), eventId, n, t),
      );
      await db.batch(stmts); // um lote = uma transação: numeração sem buracos nem repetição
      // D1 aceita até 100 parâmetros por consulta: busca em blocos.
      const rows: PhotoRow[] = [];
      for (let i = 0; i < names.length; i += 90) {
        const chunk = names.slice(i, i + 90); // (com 25 nomes, uma consulta só)
        const q = `SELECT * FROM event_photos WHERE event_id = ? AND file_name IN (${chunk.map(() => '?').join(',')})`;
        rows.push(...(await db.prepare(q).bind(eventId, ...chunk).all<PhotoRow>()).results);
      }
      rows.sort((a, b) => a.seq - b.seq);
      return json(rows.map(toPhoto));
    }
    return json({ error: 'Não encontrado.' }, 404);
  }

  const photo = await db.prepare('SELECT * FROM event_photos WHERE id = ? AND event_id = ?').bind(photoId, eventId).first<PhotoRow>();
  if (!photo) return json({ error: 'Foto não encontrada.' }, 404);

  if (!part && method === 'DELETE') {
    if (await db.prepare(`${ACTIVE_SALES} AND i.photo_id = ? LIMIT 1`).bind(now(), photoId).first()) {
      return json({ error: 'Esta foto foi comprada e o download ainda está válido. Não dá para excluir agora.' }, 409);
    }
    if (env.PHOTOS) await env.PHOTOS.delete(PHOTO_PARTS.map((p) => photoKey(eventId, p, photoId)));
    await db.batch([db.prepare('DELETE FROM event_photos WHERE id = ?').bind(photoId), db.prepare('DELETE FROM face_index WHERE photo_id = ?').bind(photoId), forgetStorage(db)]);
    if (event.cover_photo_id === photoId) await db.prepare("UPDATE events SET cover_photo_id = '' WHERE id = ?").bind(eventId).run();
    await recount(db, eventId);
    return json({ ok: true });
  }

  if (part === 'complete' && method === 'POST') {
    const missing = needBucket(env, json);
    if (missing) return missing;
    const body = (await readJson(req)) as { width?: unknown; height?: unknown; sig?: unknown };
    const sig = typeof body.sig === 'string' && /^[a-z0-9-]{1,40}$/.test(body.sig) ? body.sig : '';
    const dim = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 30_000 ? v : 0);
    const heads = await Promise.all(PHOTO_PARTS.map((p) => env.PHOTOS!.head(photoKey(eventId, p, photoId))));
    if (heads.some((h) => !h)) return json({ error: 'Arquivos da foto incompletos. Envie de novo.' }, 409);
    await db.prepare('UPDATE event_photos SET ready = 1, width = ?, height = ?, wm_sig = ? WHERE id = ?').bind(dim(body.width), dim(body.height), sig, photoId).run();
    await recount(db, eventId);
    return json(toPhoto({ ...photo, ready: 1, width: dim(body.width), height: dim(body.height), wm_sig: sig }));
  }

  // Original (sem marca) só para o fotógrafo logado — usado para refazer as prévias com outra marca d'água.
  if (part === 'original' && method === 'GET') {
    if (!env.PHOTOS) return json({ error: 'Armazenamento não configurado.' }, 503);
    const obj = await env.PHOTOS.get(photoKey(eventId, 'sale', photoId));
    if (!obj) return json({ error: 'Original não encontrado.' }, 404);
    return new Response(obj.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' } });
  }

  if (part && part !== 'complete' && method === 'PUT') {
    const missing = needBucket(env, json);
    if (missing) return missing;
    const p = part as PhotoPart;
    const declared = Number(req.headers.get('Content-Length') ?? 0);
    if (declared > PART_LIMITS[p]) return json({ error: `Arquivo grande demais (máx. ${Math.round(PART_LIMITS[p] / 1_000_000)} MB).` }, 413);
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (!bytes.length || bytes.length > PART_LIMITS[p]) return json({ error: 'Arquivo vazio ou grande demais.' }, 413);
    if (imageKind(bytes) !== 'jpg') return json({ error: 'Envie fotos em JPG.' }, 415);
    // Prévia e miniatura públicas: o servidor confere o tamanho (proteção "pré-visualização reduzida").
    if (p !== 'sale') {
      const dims = jpegSize(bytes);
      const max = p === 'thumb' ? 640 : (await getWatermarkSettings(db)).protection.maxSize;
      if (!dims) return json({ error: 'Prévia inválida.' }, 415);
      if (Math.max(dims.width, dims.height) > max + 2) return json({ error: `Prévia maior que o permitido (${max} px). Recarregue a página e envie de novo.` }, 422);
    }
    await env.PHOTOS!.put(photoKey(eventId, p, photoId), bytes, {
      httpMetadata: { contentType: 'image/jpeg' },
      customMetadata: p === 'sale' ? { original: photo.file_name } : {},
    });
    return json({ ok: true });
  }

  return json({ error: 'Não encontrado.' }, 404);
}

async function insertOrUpdate(db: D1Database, id: string, e: EventInput, before: EventRecord | null) {
  const t = now();
  // Data de publicação: definida na primeira vez que o evento é publicado (conta o prazo de venda).
  const published_at = before?.published_at || (e.status === 'publicado' ? t : '');
  const values = [
    e.slug, e.name, e.date, e.location, e.category, e.description, e.cover_photo_id,
    e.price_single, e.price_pack, e.sale_days, e.download_days, e.status, e.listed ? 1 : 0, e.face_only ? 1 : 0, e.face_search, published_at, e.watermark_model, e.cover_position, t,
  ];
  if (before) {
    await db
      .prepare(
        `UPDATE events SET slug=?, name=?, date=?, location=?, category=?, description=?, cover_photo_id=?, price_single=?, price_pack=?,
         sale_days=?, download_days=?, status=?, listed=?, face_only=?, face_search=?, published_at=?, watermark_model=?, cover_position=?, updated_at=? WHERE id=?`,
      )
      .bind(...values, id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO events (slug, name, date, location, category, description, cover_photo_id, price_single, price_pack,
         sale_days, download_days, status, listed, face_only, face_search, published_at, watermark_model, cover_position, updated_at, id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(...values, id, t)
      .run();
  }
}

// ───────── Público ─────────

/** Dados que o público pode ver (sem datas internas). */
const publicEvent = (e: EventRecord, state: string, env: PaymentsEnv) => ({
  checkout: mpConfigured(env),
  id: e.id,
  slug: e.slug,
  name: e.name,
  date: e.date,
  location: e.location,
  description: e.description,
  cover: e.cover_photo_id,
  cover_image: e.cover_image ? `/f/${e.id}/cover.jpg?v=${encodeURIComponent(e.cover_image)}` : '',
  cover_position: e.cover_position || '50% 50%',
  price_single: e.price_single,
  price_pack: e.price_pack,
  photo_count: e.photo_count,
  sale_ends_at: saleEndsAt(e),
  state,
  // Busca por selfie: só com o recurso ligado, índice pronto e venda aberta.
  face_search: e.face_search === 1 && !!e.face_pack_at && (state === 'aberto' || state === 'rascunho'),
  // Galeria privada: o público não vê a lista; só as fotos que a selfie encontrar.
  face_only: e.face_only,
});

export async function publicEventApi(env: EventsEnv, slug: string, url: URL, admin: boolean, json: Json) {
  const e = await getBySlug(env.DB, slug);
  const state = e ? publicState(e) : 'oculto';
  if (!e || (state === 'oculto' && !admin)) return json({ error: 'Evento não encontrado.' }, 404);
  const cache: Record<string, string> = state === 'aberto' && !admin ? { 'Cache-Control': 'no-cache' } : {};
  if (state === 'encerrado' && !admin) return json({ event: publicEvent(e, state, env), photos: [], next: null }, 200, cache);
  // Galeria privada: nenhuma foto na lista pública (nem pela busca por número).
  if (e.face_only && !admin) return json({ event: publicEvent(e, state, env), photos: [], next: null, counts: null }, 200, cache);
  // Filtros (orientação real), ordenação, busca "a partir da foto nº" e paginação.
  const q = parseGalleryQuery(url.searchParams);
  const where = ['event_id = ?', 'ready = 1'];
  const binds: (string | number)[] = [e.id];
  if (q.orient !== 'all') where.push(ORIENTATION_SQL[q.orient]);
  if (q.from) {
    where.push('seq >= ?');
    binds.push(q.from);
  }
  const rows = (
    await env.DB
      .prepare(`SELECT id, seq, width, height FROM event_photos WHERE ${where.join(' AND ')} ORDER BY ${ORDER_SQL[q.from ? 'asc' : q.order]} LIMIT ? OFFSET ?`)
      .bind(...binds, PAGE + 1, q.offset)
      .all<{ id: string; seq: number; width: number; height: number }>()
  ).results;
  const more = rows.length > PAGE;
  const photos = rows.slice(0, PAGE).map((r) => ({ id: r.id, n: r.seq, w: r.width, h: r.height }));
  // Contagens por orientação (só na primeira página).
  const counts =
    q.offset === 0
      ? await env.DB
          .prepare(
            `SELECT COUNT(*) AS "all", SUM(CASE WHEN ${ORIENTATION_SQL.vertical} THEN 1 ELSE 0 END) AS vertical,
             SUM(CASE WHEN ${ORIENTATION_SQL.horizontal} THEN 1 ELSE 0 END) AS horizontal,
             SUM(CASE WHEN ${ORIENTATION_SQL.square} THEN 1 ELSE 0 END) AS square
             FROM event_photos WHERE event_id = ? AND ready = 1`,
          )
          .bind(e.id)
          .first<{ all: number; vertical: number; horizontal: number; square: number }>()
      : null;
  return json(
    // O fotógrafo logado vê a galeria inteira mesmo quando ela é privada.
    { event: { ...publicEvent(e, admin && state === 'oculto' ? 'rascunho' : state, env), face_only: e.face_only && !admin, private_admin: e.face_only && admin }, photos, next: more ? q.offset + PAGE : null, counts },
    200,
    cache,
  );
}

/** /f/:eventId/:photoId/(thumb|preview).jpg — só de eventos publicados (ou para o fotógrafo logado). */
export async function servePhoto(env: EventsEnv, path: string, admin: boolean, url?: URL) {
  const cover = /^\/f\/(evt_[a-z0-9]{6,30})\/cover\.jpg$/.exec(path);
  if (cover && env.PHOTOS) {
    const e = await getEvent(env.DB, cover[1]!);
    // Antes da publicação a capa enviada aparece só se o evento foi anunciado (página de espera do Cartão Digital).
    if (!e || !e.cover_image || (publicState(e) === 'oculto' && !admin && e.announced !== 1)) return new Response('Não encontrado', { status: 404 });
    const obj = await env.PHOTOS.get(`events/${e.id}/cover.jpg`);
    if (!obj) return new Response('Não encontrado', { status: 404 });
    // O endereço muda a cada nova capa (?v=), então pode ficar em cache.
    return new Response(obj.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': admin ? 'private, no-store' : 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
  }
  const m = /^\/f\/(evt_[a-z0-9]{6,30})\/(ph_[a-z0-9]{6,30})\/(thumb|preview)\.jpg$/.exec(path);
  if (!m || !env.PHOTOS) return new Response('Não encontrado', { status: 404 });
  const [, eventId, photoId, part] = m as unknown as [string, string, string, PhotoPart];
  const e = await getEvent(env.DB, eventId);
  if (!e || (publicState(e) !== 'aberto' && !admin)) return new Response('Não encontrado', { status: 404 });
  // Galeria privada: só com a chave entregue pela busca por selfie (a foto de capa escolhida continua pública).
  const locked = e.face_only && !admin && photoId !== e.cover_photo_id;
  if (locked && !(await verifyPhotoAccess(env.ADMIN_PASSWORD, photoId, url?.searchParams.get('x') ?? null, url?.searchParams.get('t') ?? null))) {
    return new Response('Não encontrado', { status: 404 });
  }
  const obj = await env.PHOTOS.get(photoKey(eventId, part, photoId));
  if (!obj) return new Response('Não encontrado', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      ETag: obj.httpEtag,
      // As prévias nunca mudam (cada foto tem id próprio): o navegador guarda por 1 dia.
      'Cache-Control': locked ? 'private, max-age=3600' : admin && publicState(e) !== 'aberto' ? 'private, no-store' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** /e/:slug — devolve a página estática da galeria com título e capa do evento (para o link ficar bonito no WhatsApp). */
export async function serveEventPage(req: Request, env: EventsEnv, url: URL, slug: string, admin: boolean) {
  const page = await env.ASSETS.fetch(new Request(new URL('/e/', url.origin), req));
  const e = /^[a-z0-9-]{1,60}$/.test(slug) ? await getBySlug(env.DB, slug) : null;
  const visible = e && (publicState(e) !== 'oculto' || admin);
  const res = visible ? page : new Response(page.body, { ...page, status: 404 });
  if (!visible || !e) return res;
  const title = `${e.name} — Fotos | Venart`;
  const desc = `${e.photo_count} fotos de ${e.name}${e.location ? ` (${e.location})` : ''}. Encontre as suas e compre em alta resolução.`;
  const image = e.cover_image
    ? `${url.origin}/f/${e.id}/cover.jpg?v=${encodeURIComponent(e.cover_image)}`
    : e.cover_photo_id
      ? `${url.origin}/f/${e.id}/${e.cover_photo_id}/preview.jpg`
      : '';
  const out = new HTMLRewriter()
    .on('title', { element: (el) => void el.setInnerContent(title) })
    .on('meta[property="og:title"], meta[name="twitter:title"]', { element: (el) => void el.setAttribute('content', title) })
    .on('meta[name="description"], meta[property="og:description"]', { element: (el) => void el.setAttribute('content', desc) })
    .on('meta[property="og:url"]', { element: (el) => void el.setAttribute('content', `${url.origin}/e/${e.slug}`) })
    .on('meta[property="og:image"], meta[name="twitter:image"]', { element: (el) => void (image && el.setAttribute('content', image)) })
    .on('link[rel="canonical"]', { element: (el) => void el.setAttribute('href', `${url.origin}/e/${e.slug}`) })
    .on('meta[property="og:image:width"], meta[property="og:image:height"]', { element: (el) => void (image && el.remove()) })
    .transform(res);
  const r = new Response(out.body, out);
  r.headers.set('Cache-Control', 'no-cache');
  return r;
}


/** Evento para a busca por selfie: publicado e aberto (ou rascunho para o fotógrafo logado testar). */
export async function faceSearchEvent(env: EventsEnv, slug: string, admin: boolean) {
  const e = await getBySlug(env.DB, slug);
  if (!e) return null;
  const state = publicState(e);
  if (state === 'oculto' && !admin) return null;
  const open = state === 'aberto' || (admin && state === 'oculto');
  return { id: e.id, face_search: e.face_search === 1 && !!e.face_pack_at && open, face_only: e.face_only && !admin, face_threshold: e.face_threshold };
}
