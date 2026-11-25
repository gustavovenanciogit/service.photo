/**
 * CARTÃO DIGITAL — servidor
 * ------------------------------------------------------------------
 * Painel (exige login):
 *   GET/PUT /api/cartao               → configuração do cartão (+ previsão de publicação do evento em destaque)
 *   POST    /api/cartao/unannounce    → tira a página de espera de um evento ainda não publicado
 * Público:
 *   GET /api/public/cartao            → o que o cartão mostra
 *   GET /api/public/eventos/:slug     → página permanente do evento (sem nenhuma foto antes da publicação)
 *   GET /api/public/eventos           → outros eventos (só com "Ver outros eventos" ligado)
 *   GET /eventos/:slug                → página permanente (título e capa para compartilhar)
 *
 * Antes da publicação só saem nome, data, local, capa enviada (cover_image) e previsão.
 * Nenhuma foto do evento, nenhum download: só o status real "publicado" libera a galeria (/e/…).
 */
import { defaultCartao, loadCartao, parseCartao, parseForecast, teaserState, type CartaoConfig } from '../src/lib/cartao.ts';
import type { CartaoApi, CartaoFeatured } from '../src/lib/cartao-view.ts';
import { publicState, type EventRecord } from '../src/lib/events.ts';
import { site } from '../src/config/site.ts';
import { messages, whatsappLink } from '../src/lib/whatsapp.ts';
import { getBySlug, getEvent, type EventsEnv } from './events.ts';
import { emailConfigured } from '../src/lib/notify.ts';

type Json = (data: unknown, status?: number, headers?: Record<string, string>) => Response;

const fallback = () => defaultCartao(whatsappLink(site.whatsappNumber, messages.quote()), '/', site.instagramUser);

export async function getCartao(db: D1Database): Promise<CartaoConfig> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'cartao'").first<{ value: string }>();
  return loadCartao(row?.value, fallback());
}

type Teaser = Pick<EventRecord, 'id' | 'slug' | 'name' | 'date' | 'location' | 'status' | 'published_at' | 'sale_days' | 'cover_image' | 'cover_photo_id'> & {
  announced?: number;
  publish_forecast?: string;
};

/** Estado público (null = rascunho não anunciado: não aparece). */
const stateOf = (e: Teaser) => teaserState(publicState(e), e.announced === 1);

/**
 * Capa para a página permanente: a capa enviada (cover_image) sempre; a foto escolhida como capa
 * (uma foto do evento) só depois de publicado.
 */
function coverUrl(e: Teaser, state: ReturnType<typeof stateOf>) {
  if (e.cover_image) return `/f/${e.id}/cover.jpg?v=${encodeURIComponent(e.cover_image)}`;
  if (state === 'disponivel' && e.cover_photo_id) return `/f/${e.id}/${e.cover_photo_id}/preview.jpg`;
  return '';
}

function featuredOf(e: Teaser, cfg: CartaoConfig, admin: boolean): CartaoFeatured | null {
  const state = stateOf(e) ?? (admin ? 'preparando' : null);
  if (!state) return null;
  return {
    slug: e.slug, name: e.name, date: e.date, location: e.location, state,
    forecast: state === 'preparando' ? (e.publish_forecast ?? '') : '',
    text: cfg.featured.text, label: cfg.featured.label, cover: coverUrl(e, state),
  };
}

export async function cartaoPublicApi(env: EventsEnv, json: Json) {
  const cfg = await getCartao(env.DB);
  const e = cfg.featured.active && cfg.featured.event_id ? await getEvent(env.DB, cfg.featured.event_id) : null;
  const out: CartaoApi = {
    name: site.shortName, tagline: site.tagline, headline: cfg.headline, intro: cfg.intro, show_past: cfg.show_past,
    hire: cfg.hire, work: cfg.work, featured: e ? featuredOf(e as Teaser, cfg, false) : null,
    // As fotos da vitrine são do portfólio do site: a página converte as chaves em endereços.
    showcase: { title: cfg.showcase.title, always: cfg.showcase.always, files: cfg.showcase.photos },
    social: cfg.social,
  };
  return json(out, 200, { 'Cache-Control': 'no-cache' });
}

export async function eventoPublicApi(env: EventsEnv, slug: string, admin: boolean, json: Json) {
  const e = (await getBySlug(env.DB, slug)) as (EventRecord & Teaser) | null;
  const state = e ? stateOf(e) : null;
  if (!e || (!state && !admin)) return json({ error: 'Evento não encontrado.' }, 404);
  const cfg = await getCartao(env.DB);
  const s = state ?? 'preparando';
  const isFeatured = cfg.featured.active && cfg.featured.event_id === e.id;
  return json(
    {
      event: {
        slug: e.slug, name: e.name, date: e.date, location: e.location, state: s,
        forecast: s === 'preparando' ? (e.publish_forecast ?? '') : '',
        // Texto de apresentação do destaque (se for o evento do cartão) ou a descrição do evento.
        text: isFeatured && cfg.featured.text ? cfg.featured.text : s === 'preparando' ? '' : e.description,
        cover: coverUrl(e, s),
        photo_count: s === 'disponivel' && !e.face_only ? e.photo_count : 0,
        face_search: s === 'disponivel' && e.face_search === 1 && !!e.face_pack_at,
        face_only: s === 'disponivel' && e.face_only,
      },
      // Formulário "Avise-me por e-mail": só antes da publicação e com o envio configurado.
      notify: s === 'preparando' && emailConfigured(env),
      show_past: cfg.show_past,
      preview: !state, // rascunho visto pelo fotógrafo logado (o público recebe 404)
    },
    200,
    { 'Cache-Control': 'no-cache' },
  );
}

export async function eventosListApi(env: EventsEnv, json: Json) {
  const cfg = await getCartao(env.DB);
  if (!cfg.show_past) return json({ events: [], enabled: false }, 200, { 'Cache-Control': 'no-cache' });
  const rows = (
    await env.DB
      .prepare(
        `SELECT id, slug, name, date, location, status, published_at, sale_days, cover_image, cover_photo_id, announced, publish_forecast
         FROM events WHERE listed = 1 AND (status != 'rascunho' OR announced = 1) ORDER BY date DESC, created_at DESC LIMIT 60`,
      )
      .all<Teaser>()
  ).results;
  const events = rows.flatMap((e) => {
    const state = stateOf(e);
    return state ? [{ slug: e.slug, name: e.name, date: e.date, location: e.location, state, cover: coverUrl(e, state) }] : [];
  });
  return json({ events, enabled: true }, 200, { 'Cache-Control': 'no-cache' });
}

export async function cartaoAdminApi(req: Request, env: EventsEnv, path: string, json: Json, readJson: (r: Request) => Promise<unknown>) {
  const db = env.DB;
  if (path === '/api/cartao' && req.method === 'GET') return json({ config: await getCartao(db), defaults: fallback() });
  if (path === '/api/cartao' && req.method === 'PUT') {
    const body = (await readJson(req)) as Record<string, unknown> | null;
    const r = parseCartao(body, fallback());
    if (!r.ok) return json({ error: r.error }, 400);
    const cfg = r.value;
    const fc = parseForecast(body?.forecast);
    if (!fc.ok) return json({ error: fc.error }, 400);
    const now = new Date().toISOString();
    const stmts: D1PreparedStatement[] = [];
    if (cfg.featured.event_id) {
      const e = await getEvent(db, cfg.featured.event_id);
      if (!e) return json({ error: 'Evento não encontrado.' }, 404);
      // O evento escolhido ganha a página permanente de espera (antes de publicar) e a previsão.
      stmts.push(db.prepare('UPDATE events SET announced = 1, publish_forecast = ?, updated_at = ? WHERE id = ?').bind(fc.value, now, e.id));
    }
    stmts.push(
      db
        .prepare("INSERT INTO settings (key, value, updated_at) VALUES ('cartao', ?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2")
        .bind(JSON.stringify(cfg), now),
    );
    await db.batch(stmts);
    return json({ config: cfg });
  }
  if (path === '/api/cartao/unannounce' && req.method === 'POST') {
    const body = (await readJson(req)) as { event_id?: string } | null;
    const id = String(body?.event_id ?? '');
    if (!/^evt_[a-z0-9]{6,30}$/.test(id)) return json({ error: 'Evento inválido.' }, 400);
    const cfg = await getCartao(db);
    if (cfg.featured.active && cfg.featured.event_id === id)
      return json({ error: 'Este é o evento em destaque no cartão. Troque o evento ou desative o destaque antes.' }, 409);
    await db.prepare("UPDATE events SET announced = 0, publish_forecast = '', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
    return json({ ok: true });
  }
  return json({ error: 'Não encontrado.' }, 404);
}

/** /eventos/:slug — página estática com título, descrição e capa do evento (link bonito no WhatsApp). */
export async function serveEventoPage(req: Request, env: EventsEnv, url: URL, slug: string, admin: boolean) {
  const page = await env.ASSETS.fetch(new Request(new URL('/eventos/pagina/', url.origin), req));
  const e = /^[a-z0-9-]{1,60}$/.test(slug) ? ((await getBySlug(env.DB, slug)) as (EventRecord & Teaser) | null) : null;
  const state = e ? stateOf(e) : null;
  const visible = !!e && (!!state || admin);
  const res = visible ? page : new Response(page.body, { ...page, status: 404 });
  if (!visible || !e) return res;
  const title = `${e.name} — Fotos | Venart`;
  const desc =
    state === 'disponivel'
      ? `Fotografias disponíveis de ${e.name}${e.location ? ` (${e.location})` : ''}. Encontre as suas.`
      : state === 'encerrado'
        ? `${e.name}${e.location ? ` (${e.location})` : ''}: vendas encerradas.`
        : `Fotografias de ${e.name} em preparação. Confira a previsão de publicação.`;
  const cover = coverUrl(e, state);
  const image = cover ? `${url.origin}${cover}` : '';
  const out = new HTMLRewriter()
    .on('title', { element: (el) => void el.setInnerContent(title) })
    .on('meta[property="og:title"], meta[name="twitter:title"]', { element: (el) => void el.setAttribute('content', title) })
    .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', { element: (el) => void el.setAttribute('content', desc) })
    .on('meta[property="og:url"]', { element: (el) => void el.setAttribute('content', `${url.origin}/eventos/${e.slug}`) })
    .on('link[rel="canonical"]', { element: (el) => void el.setAttribute('href', `${url.origin}/eventos/${e.slug}`) })
    .on('meta[property="og:image"], meta[name="twitter:image"]', { element: (el) => void (image && el.setAttribute('content', image)) })
    .on('meta[property="og:image:width"], meta[property="og:image:height"]', { element: (el) => void (image && el.remove()) })
    .transform(res);
  const r = new Response(out.body, out);
  r.headers.set('Cache-Control', 'no-cache');
  return r;
}
