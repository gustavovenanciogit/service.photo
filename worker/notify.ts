/**
 * AVISO DE PUBLICAÇÃO POR E-MAIL — servidor
 * ------------------------------------------------------------------
 * Público:
 *   POST /api/public/eventos/:slug/avise  {email, consent:true} → pede o aviso (só antes da publicação)
 *   POST /api/public/avise/cancelar        {token}               → cancela antes do envio
 * Painel:
 *   GET  /api/cartao/notices               → pedidos por evento + se o envio está configurado
 *   POST /api/cartao/notify {event_id}     → envia agora (inclui os que falharam antes)
 * Automático:
 *   - Ao publicar o evento (PUT /api/events/:id) envia na hora os primeiros lotes.
 *   - A tarefa a cada 10 min envia o que sobrou e tenta de novo o que falhou.
 *   - A tarefa diária apaga pedidos antigos (RETENTION_DAYS) e de eventos excluídos.
 * Envio pelo Resend (https://resend.com): segredo RESEND_API_KEY e variável EMAIL_FROM
 * (ex.: "Venart <avisos@seudominio.com.br>", com o domínio verificado no Resend).
 * Depois do envio o e-mail é APAGADO; fica só a contagem em events.notify_sent.
 */
import { publicState } from '../src/lib/events.ts';
import { BATCH, emailConfigured, MAX_ATTEMPTS, normalizeEmail, noticeEmail, NOTIFY_CONSENT_VERSION, RETENTION_DAYS } from '../src/lib/notify.ts';
import { newId } from '../src/lib/crm.ts';

export interface NotifyEnv {
  DB: D1Database;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  SITE_URL?: string;
}

type Json = (data: unknown, status?: number, headers?: Record<string, string>) => Response;
type Fetch = typeof fetch;

const DEFAULT_SITE = 'https://venart.gustavovesss.workers.dev';
const now = () => new Date().toISOString();
const token = () => {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

type EvRow = { id: string; slug: string; name: string; date: string; location: string; status: 'rascunho' | 'publicado' | 'encerrado'; published_at: string; sale_days: number; announced: number };
const getEv = (db: D1Database, where: 'id' | 'slug', v: string) =>
  db.prepare(`SELECT id, slug, name, date, location, status, published_at, sale_days, announced FROM events WHERE ${where} = ?`).bind(v).first<EvRow>();

/** Pedido de aviso feito na página de espera. */
export async function notifySignup(env: NotifyEnv, slug: string, body: Record<string, unknown> | null, allow: () => Promise<boolean>, json: Json) {
  if (!emailConfigured(env)) return json({ error: 'Aviso por e-mail indisponível no momento.' }, 503);
  // Campo-armadilha: invisível para pessoas, robôs costumam preencher.
  if (typeof body?.website === 'string' && body.website.trim()) return json({ ok: true });
  const e = await getEv(env.DB, 'slug', slug);
  const state = e ? publicState(e) : 'oculto';
  if (!e || (state === 'oculto' && e.announced !== 1)) return json({ error: 'Evento não encontrado.' }, 404);
  if (state !== 'oculto') return json({ ok: true, available: true });
  if (body?.consent !== true) return json({ error: 'Marque a autorização para receber o aviso.' }, 400);
  const email = normalizeEmail(body?.email);
  if (!email) return json({ error: 'Confira o e-mail digitado.' }, 400);
  if (!(await allow())) return json({ error: 'Muitos pedidos seguidos. Tente mais tarde.' }, 429);
  const t = token();
  const r = await env.DB
    .prepare(
      `INSERT INTO notify_requests (id, event_id, email, token, consent_version, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(event_id, email) DO NOTHING`,
    )
    .bind(newId('avs'), e.id, email, t, NOTIFY_CONSENT_VERSION, now())
    .run();
  // Já pedido antes: mesma resposta (sem o código de cancelamento, que é só de quem pediu).
  return json({ ok: true, token: r.meta.changes ? t : '' }, 201);
}

export async function notifyCancel(env: NotifyEnv, body: Record<string, unknown> | null, json: Json) {
  const t = String(body?.token ?? '');
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(t)) return json({ error: 'Código inválido.' }, 400);
  await env.DB.prepare("DELETE FROM notify_requests WHERE token = ? AND status != 'sending'").bind(t).run();
  return json({ ok: true });
}

/**
 * Envia os avisos pendentes de um evento publicado, em lotes de até BATCH.
 * Cada lote é "reservado" antes (status sending) para dois envios simultâneos não repetirem e-mails.
 */
export async function sendNotices(env: NotifyEnv, eventId: string, origin: string, maxBatches = 3, fetcher: Fetch = fetch) {
  const out = { sent: 0, failed: 0, pending: 0, skipped: '' };
  if (!emailConfigured(env)) return { ...out, skipped: 'nao-configurado' };
  const e = await getEv(env.DB, 'id', eventId);
  if (!e || publicState(e) !== 'aberto') return { ...out, skipped: 'nao-publicado' };
  const mail = noticeEmail({ name: e.name, date: e.date, location: e.location, url: `${origin}/e/${e.slug}` });
  for (let b = 0; b < maxBatches; b++) {
    const stale = new Date(Date.now() - 15 * 60_000).toISOString(); // reserva abandonada (falha no meio)
    const claimed = (
      await env.DB
        .prepare(
          `UPDATE notify_requests SET status = 'sending', claimed_at = ?1
           WHERE id IN (SELECT id FROM notify_requests WHERE event_id = ?2 AND (status = 'pending' OR (status = 'sending' AND claimed_at < ?3)) LIMIT ?4)
           RETURNING id, email`,
        )
        .bind(now(), eventId, stale, BATCH)
        .all<{ id: string; email: string }>()
    ).results;
    if (!claimed.length) break;
    let ok: string[] = [];
    let bad: { id: string; error: string }[] = [];
    try {
      const res = await fetcher('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          // Um endereço com problema não derruba o lote inteiro.
          'x-batch-validation': 'permissive',
          'Idempotency-Key': `avs-${claimed.map((c) => c.id).join('').slice(-200)}`,
        },
        body: JSON.stringify(claimed.map((c) => ({ from: env.EMAIL_FROM, to: [c.email], subject: mail.subject, html: mail.html, text: mail.text }))),
      });
      const data = (await res.json().catch(() => ({}))) as { errors?: { index: number; message: string }[]; message?: string };
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      const errIdx = new Map((data.errors ?? []).map((x) => [x.index, x.message]));
      claimed.forEach((c, i) => (errIdx.has(i) ? bad.push({ id: c.id, error: errIdx.get(i)! }) : ok.push(c.id)));
    } catch (err) {
      ok = [];
      bad = claimed.map((c) => ({ id: c.id, error: String((err as Error).message).slice(0, 200) }));
    }
    const stmts: D1PreparedStatement[] = [];
    if (ok.length) {
      // Enviado: o e-mail é apagado; fica só a contagem.
      stmts.push(env.DB.prepare(`DELETE FROM notify_requests WHERE id IN (${ok.map(() => '?').join(',')})`).bind(...ok));
      stmts.push(env.DB.prepare('UPDATE events SET notify_sent = notify_sent + ? WHERE id = ?').bind(ok.length, eventId));
    }
    for (const x of bad)
      stmts.push(
        env.DB
          .prepare(`UPDATE notify_requests SET attempts = attempts + 1, error = ?, status = CASE WHEN attempts + 1 >= ? THEN 'failed' ELSE 'pending' END WHERE id = ?`)
          .bind(x.error, MAX_ATTEMPTS, x.id),
      );
    if (stmts.length) await env.DB.batch(stmts);
    out.sent += ok.length;
    out.failed += bad.length;
    if (bad.length && !ok.length) break; // serviço fora do ar: tenta de novo na próxima tarefa
  }
  out.pending = (await env.DB.prepare("SELECT COUNT(*) AS n FROM notify_requests WHERE event_id = ? AND status != 'failed'").bind(eventId).first<{ n: number }>())?.n ?? 0;
  return out;
}

/** Tarefa a cada 10 min: envia o que ficou pendente de eventos já publicados. */
export async function processNotices(env: NotifyEnv, fetcher: Fetch = fetch) {
  if (!emailConfigured(env)) return;
  const rows = (
    await env.DB
      .prepare(
        `SELECT DISTINCT n.event_id FROM notify_requests n JOIN events e ON e.id = n.event_id
         WHERE n.status IN ('pending', 'sending') AND e.status = 'publicado' LIMIT 5`,
      )
      .all<{ event_id: string }>()
  ).results;
  for (const r of rows) await sendNotices(env, r.event_id, (env.SITE_URL || DEFAULT_SITE).replace(/\/$/, ''), 2, fetcher);
}

/** Tarefa diária: apaga pedidos antigos e de eventos que não existem mais. */
export async function cleanupNotices(db: D1Database, nowMs = Date.now()) {
  const limit = new Date(nowMs - RETENTION_DAYS * 86_400_000).toISOString();
  await db.batch([
    db.prepare('DELETE FROM notify_requests WHERE created_at < ?').bind(limit),
    db.prepare('DELETE FROM notify_requests WHERE event_id NOT IN (SELECT id FROM events)'),
  ]);
}

export async function noticesAdminApi(req: Request, env: NotifyEnv, path: string, json: Json, readJson: (r: Request) => Promise<unknown>) {
  if (path === '/api/cartao/notices' && req.method === 'GET') {
    const rows = (
      await env.DB
        .prepare(
          `SELECT event_id, SUM(CASE WHEN status != 'failed' THEN 1 ELSE 0 END) AS pending, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
           MAX(error) AS error
           FROM notify_requests GROUP BY event_id`,
        )
        .all<{ event_id: string; pending: number; failed: number; error: string }>()
    ).results;
    const sent = (await env.DB.prepare('SELECT id, notify_sent FROM events WHERE notify_sent > 0').all<{ id: string; notify_sent: number }>()).results;
    return json({ configured: emailConfigured(env), requests: rows, sent });
  }
  if (path === '/api/cartao/notify' && req.method === 'POST') {
    const body = (await readJson(req)) as { event_id?: string } | null;
    const id = String(body?.event_id ?? '');
    if (!/^evt_[a-z0-9]{6,30}$/.test(id)) return json({ error: 'Evento inválido.' }, 400);
    if (!emailConfigured(env)) return json({ error: 'Envio de e-mail não configurado (RESEND_API_KEY e EMAIL_FROM).' }, 503);
    // Pedido manual: dá nova chance aos que falharam.
    await env.DB.prepare("UPDATE notify_requests SET status = 'pending', attempts = 0 WHERE event_id = ? AND status = 'failed'").bind(id).run();
    const r = await sendNotices(env, id, new URL(req.url).origin, 5);
    if (r.skipped === 'nao-publicado') return json({ error: 'Publique o evento antes: o aviso só sai com as fotos disponíveis.' }, 409);
    return json(r);
  }
  return null;
}
