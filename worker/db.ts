/**
 * Banco de dados (Cloudflare D1).
 * As tabelas são criadas automaticamente no primeiro acesso.
 * Todas as consultas usam parâmetros (?), nunca texto concatenado.
 */
import type { Client, ClientInput, ProposalInput, ProposalRecord } from '../src/lib/crm.ts';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT '',
    contact TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    instagram TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL DEFAULT 'prospect',
    next_followup TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL DEFAULT '',
    client_name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'enviada',
    total_once REAL NOT NULL DEFAULT 0,
    total_monthly REAL NOT NULL DEFAULT 0,
    valid_until TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL DEFAULT '{}',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    ip TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    first_at INTEGER NOT NULL
  )`,
];

let ready: Promise<unknown> | null = null;
export const ensureSchema = (db: D1Database) => (ready ??= db.batch(SCHEMA.map((s) => db.prepare(s))).catch((e) => ((ready = null), Promise.reject(e))));

const now = () => new Date().toISOString();

// ───────── Clientes ─────────

export const listClients = async (db: D1Database) =>
  (await db.prepare('SELECT * FROM clients ORDER BY updated_at DESC').all<Client>()).results;

export async function insertClient(db: D1Database, id: string, c: ClientInput) {
  const t = now();
  await db
    .prepare(
      `INSERT INTO clients (id, name, type, contact, phone, instagram, email, stage, next_followup, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, c.name, c.type, c.contact, c.phone, c.instagram, c.email, c.stage, c.next_followup, c.notes, t, t)
    .run();
  return db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first<Client>();
}

export async function updateClient(db: D1Database, id: string, c: ClientInput) {
  const r = await db
    .prepare(
      `UPDATE clients SET name = ?, type = ?, contact = ?, phone = ?, instagram = ?, email = ?, stage = ?,
       next_followup = ?, notes = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(c.name, c.type, c.contact, c.phone, c.instagram, c.email, c.stage, c.next_followup, c.notes, now(), id)
    .run();
  return r.meta.changes ? db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first<Client>() : null;
}

export const deleteClient = async (db: D1Database, id: string) =>
  (await db.prepare('DELETE FROM clients WHERE id = ?').bind(id).run()).meta.changes > 0;

// ───────── Propostas ─────────

/** Lista sem o JSON completo (mais leve). */
export const listProposals = async (db: D1Database) =>
  (
    await db
      .prepare(
        `SELECT id, client_id, client_name, type, status, total_once, total_monthly, valid_until, url, notes, created_at, updated_at
         FROM proposals ORDER BY created_at DESC`,
      )
      .all<Omit<ProposalRecord, 'data'>>()
  ).results;

export const getProposal = (db: D1Database, id: string) =>
  db.prepare('SELECT * FROM proposals WHERE id = ?').bind(id).first<ProposalRecord>();

/** Cria ou atualiza (o gerador salva a cada envio/cópia do link). Mantém status e anotações se já existir. */
export async function upsertProposal(db: D1Database, p: ProposalInput) {
  const t = now();
  await db
    .prepare(
      `INSERT INTO proposals (id, client_id, client_name, type, status, total_once, total_monthly, valid_until, url, data, notes, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)
       ON CONFLICT(id) DO UPDATE SET
         client_id = excluded.client_id, client_name = excluded.client_name, type = excluded.type,
         total_once = excluded.total_once, total_monthly = excluded.total_monthly, valid_until = excluded.valid_until,
         url = excluded.url, data = excluded.data, updated_at = excluded.updated_at`,
    )
    .bind(p.id, p.client_id, p.client_name, p.type, p.status, p.total_once, p.total_monthly, p.valid_until, p.url, p.data, p.notes, t)
    .run();
  return getProposal(db, p.id);
}

export async function patchProposal(db: D1Database, id: string, fields: { status?: string; notes?: string; client_id?: string }) {
  const sets: string[] = [];
  const values: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`); // chaves fixas (status/notes/client_id), validadas antes
    values.push(v);
  }
  if (!sets.length) return getProposal(db, id);
  const r = await db
    .prepare(`UPDATE proposals SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`)
    .bind(...values, now(), id)
    .run();
  return r.meta.changes ? getProposal(db, id) : null;
}

export const deleteProposal = async (db: D1Database, id: string) =>
  (await db.prepare('DELETE FROM proposals WHERE id = ?').bind(id).run()).meta.changes > 0;
