/**
 * Configurações do painel guardadas no banco (tabela settings).
 *   GET/PUT /api/settings/watermark        → modelos, modelo padrão e proteção
 *   GET/PUT/DELETE /api/settings/watermark/logo → logotipo da marca d'água (PNG, só para o painel)
 * O logotipo é sempre PNG: SVGs são convertidos em PNG no navegador antes do envio
 * (assim nenhum SVG enviado é guardado ou servido).
 */
import { DEFAULT_SETTINGS, parseSettings, type WatermarkSettings } from '../src/lib/watermark-models.ts';
import { imageKind } from '../src/lib/site-content.ts';

type Json = (data: unknown, status?: number, headers?: Record<string, string>) => Response;
const LOGO_KEY = 'brand/watermark-logo.png';
const MAX_LOGO = 400_000;

export async function getWatermarkSettings(db: D1Database): Promise<WatermarkSettings> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'watermark'").first<{ value: string }>();
  if (!row) return DEFAULT_SETTINGS;
  try {
    return parseSettings(JSON.parse(row.value));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const save = (db: D1Database, s: WatermarkSettings) =>
  db
    .prepare("INSERT INTO settings (key, value, updated_at) VALUES ('watermark', ?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2")
    .bind(JSON.stringify(s), new Date().toISOString())
    .run();

export async function settingsApi(req: Request, env: { DB: D1Database; PHOTOS?: R2Bucket }, path: string, json: Json, readJson: (r: Request) => Promise<unknown>) {
  const db = env.DB;
  if (path === '/api/settings/watermark') {
    if (req.method === 'GET') return json(await getWatermarkSettings(db));
    if (req.method === 'PUT') {
      const current = await getWatermarkSettings(db);
      const next = parseSettings({ ...((await readJson(req)) as object), logoVersion: current.logoVersion });
      await save(db, next);
      return json(next);
    }
  }
  if (path === '/api/settings/watermark/logo') {
    if (!env.PHOTOS) return json({ error: 'Armazenamento (R2) não configurado.' }, 503);
    if (req.method === 'GET') {
      const obj = await env.PHOTOS.get(LOGO_KEY);
      if (!obj) return json({ error: 'Sem logotipo.' }, 404);
      return new Response(obj.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    if (req.method === 'PUT') {
      const bytes = new Uint8Array(await req.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_LOGO) return json({ error: 'Logotipo grande demais (máx. 400 KB).' }, 413);
      if (imageKind(bytes) !== 'png') return json({ error: 'Envie o logotipo em PNG (o painel converte SVG automaticamente).' }, 415);
      await env.PHOTOS.put(LOGO_KEY, bytes, { httpMetadata: { contentType: 'image/png' } });
      const s = { ...(await getWatermarkSettings(db)), logoVersion: new Date().toISOString() };
      await save(db, s);
      return json(s);
    }
    if (req.method === 'DELETE') {
      await env.PHOTOS.delete(LOGO_KEY);
      const s = { ...(await getWatermarkSettings(db)), logoVersion: '' };
      await save(db, s);
      return json(s);
    }
  }
  return json({ error: 'Não encontrado.' }, 404);
}
