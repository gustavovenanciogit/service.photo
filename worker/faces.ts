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
 * Nenhuma imagem de rosto é enviada ou guardada — só assinaturas (128 números) e caixas.
 * Selfies NUNCA chegam ao servidor: viram assinatura no navegador e são descartadas.
 */
import { decodeVec } from '../src/lib/faces.ts';
import { newId } from '../src/lib/crm.ts';

type Json = (data: unknown, status?: number, headers?: Record<string, string>) => Response;
const now = () => new Date().toISOString();
const MAX_FACES_PER_PHOTO = 60;

/** Apaga tudo do reconhecimento facial de um evento (usado ao excluir/limpar o evento). */
export const purgeFaces = (db: D1Database, eventId: string) => [
  db.prepare('DELETE FROM face_index WHERE event_id = ?').bind(eventId),
  db.prepare('DELETE FROM face_pilot_runs WHERE event_id = ?').bind(eventId),
];

export async function facesApi(req: Request, env: { DB: D1Database }, path: string, json: Json, readJson: (r: Request, max?: number) => Promise<unknown>) {
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

  const m = /^\/api\/events\/(evt_[a-z0-9]{6,30})\/(?:faces(?:\/(vectors|consent|pilot))?|photos\/(ph_[a-z0-9]{6,30})\/faces)$/.exec(path);
  if (!m) return null;
  const [, eventId, sub, photoId] = m as unknown as [string, string, string | undefined, string | undefined];
  if (!(await db.prepare('SELECT 1 FROM events WHERE id = ?').bind(eventId).first())) return json({ error: 'Evento não encontrado.' }, 404);

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
    return json({ total: s?.total ?? 0, indexed: s?.indexed ?? 0, faces: s?.faces ?? 0, pending });
  }

  if (!sub && method === 'DELETE') {
    await db.batch([...purgeFaces(db, eventId), db.prepare('UPDATE event_photos SET faces = -1 WHERE event_id = ?').bind(eventId)]);
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
