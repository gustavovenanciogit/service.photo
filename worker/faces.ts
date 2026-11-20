/**
 * RECONHECIMENTO FACIAL — PILOTO (só no painel, exige login)
 * ------------------------------------------------------------------
 *   GET    /api/events/:id/faces                 → situação do índice (fotos indexadas, rostos)
 *   GET    /api/events/:id/faces/vectors         → assinaturas do evento (a comparação roda no navegador do fotógrafo)
 *   POST   /api/events/:id/photos/:pid/faces     → grava os rostos de uma foto (substitui)
 *   DELETE /api/events/:id/faces                 → apaga o índice do evento
 *   POST   /api/events/:id/faces/consent         → registra o consentimento do voluntário (versão do texto)
 *   POST   /api/faces/consent/:cid/revoke        → revoga um consentimento (e apaga as medições dele)
 *   GET/POST /api/events/:id/faces/pilot         → medições do piloto (acerto por limite)
 *   PUT    /api/events/:id/faces/pack            → pacote de busca (gerado no navegador do fotógrafo) → R2
 *   POST   /api/events/:id/faces/public          → liga/desliga a busca por selfie (exige aviso do evento confirmado)
 *   POST   /api/events/:id/faces/remove          → tira fotos da busca (pedido de exclusão de alguém)
 *   GET/PUT /api/faces/settings                  → nível de exigência da busca pública
 * Público (sem login):
 *   POST   /api/public/events/:slug/faces        → busca por selfie, com o termo aceito (registrado)
 * Nenhuma imagem de rosto é enviada ou guardada — só assinaturas (128 números) e caixas.
 * Selfies NUNCA chegam ao servidor: viram assinatura no navegador; a assinatura é usada na busca e descartada.
 */
import { COSINE_MATCH, decodeVec, packCount, searchPack, validThreshold } from '../src/lib/faces.ts';
import { store } from '../src/config/store.ts';
import { newId } from '../src/lib/crm.ts';

type Json = (data: unknown, status?: number, headers?: Record<string, string>) => Response;
const now = () => new Date().toISOString();
const MAX_FACES_PER_PHOTO = 60;

type Env = { DB: D1Database; PHOTOS?: R2Bucket };
const packKey = (eventId: string) => `events/${eventId}/faces.bin`;
const MAX_PACK = 26_000_000;

export async function faceThreshold(db: D1Database) {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'face_threshold'").first<{ value: string }>();
  return validThreshold(Number(row?.value)) ?? COSINE_MATCH;
}

/** Apaga tudo do reconhecimento facial de um evento (usado ao excluir/limpar o evento). */
export const purgeFaces = (db: D1Database, eventId: string) => [
  db.prepare('DELETE FROM face_index WHERE event_id = ?').bind(eventId),
  db.prepare('DELETE FROM face_pilot_runs WHERE event_id = ?').bind(eventId),
];

export async function facesApi(req: Request, env: Env, path: string, json: Json, readJson: (r: Request, max?: number) => Promise<unknown>) {
  const db = env.DB;
  const method = req.method;

  const revoke = /^\/api\/faces\/consent\/(fc_[a-z0-9]{6,30})\/revoke$/.exec(path);
  if (revoke && method === 'POST') {
    await db.batch([
      db.prepare("UPDATE face_consents SET revoked_at = ? WHERE id = ? AND revoked_at = ''").bind(now(), revoke[1]!),
      db.prepare('DELETE FROM face_pilot_runs WHERE consent_id = ?').bind(revoke[1]!),
    ]);
    return json({ ok: true });
  }

  if (path === '/api/faces/settings') {
    if (method === 'GET') return json({ threshold: await faceThreshold(db), default: COSINE_MATCH });
    if (method === 'PUT') {
      const t = validThreshold(((await readJson(req)) as { threshold?: unknown }).threshold);
      if (t === null) return json({ error: 'Nível inválido.' }, 400);
      await db
        .prepare("INSERT INTO settings (key, value, updated_at) VALUES ('face_threshold', ?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2")
        .bind(String(t), now())
        .run();
      return json({ threshold: t, default: COSINE_MATCH });
    }
  }

  const m = /^\/api\/events\/(evt_[a-z0-9]{6,30})\/(?:faces(?:\/(vectors|consent|pilot|pack|public|remove))?|photos\/(ph_[a-z0-9]{6,30})\/faces)$/.exec(path);
  if (!m) return null;
  const [, eventId, sub, photoId] = m as unknown as [string, string, string | undefined, string | undefined];
  const ev = await db.prepare('SELECT face_search, face_pack_at FROM events WHERE id = ?').bind(eventId).first<{ face_search: number; face_pack_at: string }>();
  if (!ev) return json({ error: 'Evento não encontrado.' }, 404);

  if (photoId && method === 'POST') {
    const photo = await db.prepare('SELECT id FROM event_photos WHERE id = ? AND event_id = ?').bind(photoId, eventId).first();
    if (!photo) return json({ error: 'Foto não encontrada.' }, 404);
    const body = (await readJson(req, 200_000)) as { faces?: unknown };
    const list = Array.isArray(body.faces) ? body.faces.slice(0, MAX_FACES_PER_PHOTO) : null;
    if (!list) return json({ error: 'Lista de rostos inválida.' }, 400);
    const rows: { vec: string; score: number; box: string }[] = [];
    for (const f of list as { vec?: unknown; score?: unknown; box?: unknown }[]) {
      if (typeof f.vec !== 'string' || !decodeVec(f.vec)) return json({ error: 'Assinatura inválida.' }, 400);
      const score = typeof f.score === 'number' && f.score >= 0 && f.score <= 1 ? f.score : 0;
      const box = Array.isArray(f.box) && f.box.length === 4 && f.box.every((v) => typeof v === 'number' && Number.isFinite(v)) ? f.box.map((v: number) => Math.round(v)).join(',') : '';
      rows.push({ vec: f.vec, score, box });
    }
    const t = now();
    await db.batch([
      db.prepare('DELETE FROM face_index WHERE photo_id = ?').bind(photoId),
      ...rows.map((r) => db.prepare('INSERT INTO face_index (id, event_id, photo_id, vec, score, box, created_at) VALUES (?,?,?,?,?,?,?)').bind(newId('fx'), eventId, photoId, r.vec, r.score, r.box, t)),
      db.prepare('UPDATE event_photos SET faces = ? WHERE id = ?').bind(rows.length, photoId),
    ]);
    return json({ ok: true, faces: rows.length });
  }

  if (!sub && method === 'GET') {
    const s = await db
      .prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN faces >= 0 THEN 1 ELSE 0 END) AS indexed, SUM(CASE WHEN faces > 0 THEN faces ELSE 0 END) AS faces FROM event_photos WHERE event_id = ? AND ready = 1')
      .bind(eventId)
      .first<{ total: number; indexed: number | null; faces: number | null }>();
    const pending = (await db.prepare('SELECT id, seq FROM event_photos WHERE event_id = ? AND ready = 1 AND faces < 0 ORDER BY seq').bind(eventId).all<{ id: string; seq: number }>()).results;
    return json({ total: s?.total ?? 0, indexed: s?.indexed ?? 0, faces: s?.faces ?? 0, pending, face_search: ev.face_search === 1, face_pack_at: ev.face_pack_at });
  }

  if (!sub && method === 'DELETE') {
    if (env.PHOTOS) await env.PHOTOS.delete(packKey(eventId));
    await db.batch([
      ...purgeFaces(db, eventId),
      db.prepare('UPDATE event_photos SET faces = -1 WHERE event_id = ?').bind(eventId),
      db.prepare("UPDATE events SET face_search = 0, face_pack_at = '' WHERE id = ?").bind(eventId),
    ]);
    return json({ ok: true });
  }

  if (sub === 'vectors' && method === 'GET') {
    const rows = (
      await db
        .prepare('SELECT f.photo_id AS p, e.seq AS n, f.vec AS v FROM face_index f JOIN event_photos e ON e.id = f.photo_id WHERE f.event_id = ?')
        .bind(eventId)
        .all<{ p: string; n: number; v: string }>()
    ).results;
    return json(rows);
  }

  if (sub === 'pack' && method === 'PUT') {
    if (!env.PHOTOS) return json({ error: 'Armazenamento de fotos não configurado.' }, 503);
    if (Number(req.headers.get('Content-Length') ?? 0) > MAX_PACK) return json({ error: 'Pacote grande demais.' }, 413);
    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX_PACK || packCount(buf) === null) return json({ error: 'Pacote inválido.' }, 400);
    await env.PHOTOS.put(packKey(eventId), buf, { httpMetadata: { contentType: 'application/octet-stream' } });
    const t = now();
    await db.prepare('UPDATE events SET face_pack_at = ? WHERE id = ?').bind(t, eventId).run();
    return json({ ok: true, faces: packCount(buf), face_pack_at: t });
  }

  if (sub === 'public' && method === 'POST') {
    const body = (await readJson(req)) as { enabled?: unknown; notice?: unknown };
    const on = body.enabled === true;
    if (on && body.notice !== true) return json({ error: 'Confirme que o público do evento foi avisado sobre o reconhecimento facial.' }, 400);
    if (on && !ev.face_pack_at) return json({ error: 'Indexe as fotos antes de ligar a busca.' }, 409);
    await db.prepare('UPDATE events SET face_search = ? WHERE id = ?').bind(on ? 1 : 0, eventId).run();
    return json({ ok: true, face_search: on });
  }

  if (sub === 'remove' && method === 'POST') {
    const nums = (((await readJson(req)) as { numbers?: unknown }).numbers as unknown[]) ?? [];
    const list = Array.isArray(nums) ? [...new Set(nums.filter((n): n is number => Number.isInteger(n) && (n as number) > 0))].slice(0, 500) : [];
    if (!list.length) return json({ error: 'Informe os números das fotos.' }, 400);
    const ids = (
      await db
        .prepare('SELECT id FROM event_photos WHERE event_id = ? AND seq IN (SELECT value FROM json_each(?))')
        .bind(eventId, JSON.stringify(list))
        .all<{ id: string }>()
    ).results.map((r) => r.id);
    if (!ids.length) return json({ error: 'Nenhuma foto com esses números.' }, 404);
    await db.batch([
      db.prepare('DELETE FROM face_index WHERE event_id = ? AND photo_id IN (SELECT value FROM json_each(?))').bind(eventId, JSON.stringify(ids)),
      // 0 rostos: não volta para a fila de indexação.
      db.prepare('UPDATE event_photos SET faces = 0 WHERE event_id = ? AND id IN (SELECT value FROM json_each(?))').bind(eventId, JSON.stringify(ids)),
    ]);
    return json({ ok: true, removed: ids.length });
  }

  if (sub === 'consent' && method === 'POST') {
    const body = (await readJson(req)) as { version?: unknown; label?: unknown; accept?: unknown };
    if (body.accept !== true || typeof body.version !== 'string' || !/^[\w.-]{3,40}$/.test(body.version)) return json({ error: 'É preciso marcar o consentimento.' }, 400);
    const id = newId('fc');
    const label = typeof body.label === 'string' ? body.label.trim().slice(0, 60) : '';
    await db.prepare('INSERT INTO face_consents (id, event_id, version, label, created_at) VALUES (?,?,?,?,?)').bind(id, eventId, body.version, label, now()).run();
    return json({ id });
  }

  if (sub === 'pilot') {
    if (method === 'GET') {
      const rows = (
        await db
          .prepare('SELECT r.id, r.consent_id, r.data, r.created_at, c.label, c.version FROM face_pilot_runs r LEFT JOIN face_consents c ON c.id = r.consent_id WHERE r.event_id = ? ORDER BY r.created_at DESC LIMIT 200')
          .bind(eventId)
          .all<{ id: string; consent_id: string; data: string; created_at: string; label: string | null; version: string | null }>()
      ).results;
      return json(rows.map((r) => ({ ...r, data: JSON.parse(r.data) as unknown })));
    }
    if (method === 'POST') {
      const body = (await readJson(req, 50_000)) as { consent_id?: unknown; data?: unknown };
      const consentId = typeof body.consent_id === 'string' ? body.consent_id : '';
      const ok = consentId && (await db.prepare("SELECT 1 FROM face_consents WHERE id = ? AND event_id = ? AND revoked_at = ''").bind(consentId, eventId).first());
      if (!ok) return json({ error: 'Consentimento não encontrado.' }, 400);
      const data = JSON.stringify(body.data ?? {});
      if (data.length > 40_000) return json({ error: 'Medição grande demais.' }, 413);
      await db.prepare('INSERT INTO face_pilot_runs (id, event_id, consent_id, data, created_at) VALUES (?,?,?,?,?)').bind(newId('fr'), eventId, consentId, data, now()).run();
      return json({ ok: true });
    }
  }
  return json({ error: 'Não encontrado.' }, 404);
}

/**
 * Busca pública por selfie. Recebe só a assinatura da selfie (gerada no aparelho do comprador)
 * e o aceite do termo. Registra o aceite (sem dados pessoais), compara com o pacote do evento e
 * devolve as fotos parecidas. A assinatura não é guardada.
 */
export async function publicFaceSearch(env: Env, event: { id: string; face_search: boolean }, body: unknown, json: Json) {
  const b = (body ?? {}) as { vec?: unknown; accept?: unknown; version?: unknown };
  if (!event.face_search) return json({ error: 'A busca por selfie não está disponível neste evento.' }, 404);
  if (b.accept !== true || b.version !== store.faceSearch.termsVersion) return json({ error: 'É preciso aceitar o termo para buscar por selfie.' }, 400);
  const vec = typeof b.vec === 'string' ? decodeVec(b.vec) : null;
  if (!vec) return json({ error: 'Não foi possível ler o rosto da selfie. Tente outra foto.' }, 400);
  const obj = env.PHOTOS ? await env.PHOTOS.get(packKey(event.id)) : null;
  if (!obj) return json({ error: 'A busca por selfie não está disponível neste evento.' }, 404);
  const db = env.DB;
  const consentId = newId('fc');
  const [threshold, buf] = await Promise.all([
    faceThreshold(db),
    obj.arrayBuffer(),
    db.prepare("INSERT INTO face_consents (id, event_id, version, label, created_at) VALUES (?,?,?,'comprador',?)").bind(consentId, event.id, store.faceSearch.termsVersion, now()).run(),
  ]);
  const found = searchPack(buf as ArrayBuffer, vec, threshold as number);
  vec.fill(0);
  if (!found.length) return json({ consent: consentId, photos: [] });
  const rows = (
    await db
      .prepare('SELECT id, seq, width, height FROM event_photos WHERE event_id = ? AND ready = 1 AND seq IN (SELECT value FROM json_each(?))')
      .bind(event.id, JSON.stringify(found.map((f) => f.n)))
      .all<{ id: string; seq: number; width: number; height: number }>()
  ).results;
  const byN = new Map(rows.map((r) => [r.seq, r]));
  // Mais parecidas primeiro; a pontuação não é enviada.
  const photos = found.flatMap((f) => {
    const r = byN.get(f.n);
    return r ? [{ id: r.id, n: r.seq, w: r.width, h: r.height }] : [];
  });
  return json({ consent: consentId, photos });
}
