/**
 * Banco de dados (Cloudflare D1).
 * As tabelas são criadas automaticamente no primeiro acesso.
 * Todas as consultas usam parâmetros (?), nunca texto concatenado.
 */
import type { Client, ClientInput, Job, JobInput, Lead, LeadInput, ProposalInput, ProposalRecord } from '../src/lib/crm.ts';

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
  `CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'novo',
    source TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    service TEXT NOT NULL DEFAULT '',
    package_id TEXT NOT NULL DEFAULT '',
    event_date TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    total REAL NOT NULL DEFAULT 0,
    details TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS lead_attempts (
    ip_hash TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    first_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'trabalho',
    title TEXT NOT NULL,
    client_id TEXT NOT NULL DEFAULT '',
    client_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    proposal_id TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    start_time TEXT NOT NULL DEFAULT '',
    end_time TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    blocks_date INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'agendado',
    due_date TEXT NOT NULL DEFAULT '',
    delivery_link TEXT NOT NULL DEFAULT '',
    delivered_at TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS jobs_date ON jobs (date)`,
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

// ───────── Pedidos do site ─────────

export async function insertLead(db: D1Database, id: string, l: LeadInput) {
  const t = now();
  await db
    .prepare(
      `INSERT INTO leads (id, created_at, updated_at, status, source, name, phone, service, package_id, event_date, location, message, total, details)
       VALUES (?, ?, ?, 'novo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, t, t, l.source, l.name, l.phone, l.service, l.package_id, l.event_date, l.location, l.message, l.total, l.details)
    .run();
}

export const listLeads = async (db: D1Database) =>
  (await db.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT 500').all<Lead>()).results;

export const countNewLeads = async (db: D1Database) =>
  (await db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status = 'novo'").first<{ n: number }>())?.n ?? 0;

export async function setLeadStatus(db: D1Database, id: string, status: string) {
  const r = await db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?').bind(status, now(), id).run();
  return r.meta.changes ? db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first<Lead>() : null;
}

export const deleteLead = async (db: D1Database, id: string) =>
  (await db.prepare('DELETE FROM leads WHERE id = ?').bind(id).run()).meta.changes > 0;

/** Limite de pedidos por IP (anti-spam). Retorna true se ainda pode enviar. */
export async function allowLead(db: D1Database, ipHash: string, max = 6, windowMs = 60 * 60 * 1000) {
  const t = Date.now();
  const row = await db.prepare('SELECT count, first_at FROM lead_attempts WHERE ip_hash = ?').bind(ipHash).first<{ count: number; first_at: number }>();
  if (row && t - row.first_at < windowMs && row.count >= max) return false;
  await db
    .prepare(
      `INSERT INTO lead_attempts (ip_hash, count, first_at) VALUES (?1, 1, ?2)
       ON CONFLICT(ip_hash) DO UPDATE SET
         count = CASE WHEN ?2 - first_at > ?3 THEN 1 ELSE count + 1 END,
         first_at = CASE WHEN ?2 - first_at > ?3 THEN ?2 ELSE first_at END`,
    )
    .bind(ipHash, t, windowMs)
    .run();
  return true;
}

// ───────── Agenda de trabalhos ─────────

type JobRow = Omit<Job, 'blocks_date'> & { blocks_date: number };
const toJob = (r: JobRow | null): Job | null => (r ? { ...r, blocks_date: !!r.blocks_date } : null);

export const listJobs = async (db: D1Database) =>
  (await db.prepare('SELECT * FROM jobs ORDER BY date ASC, start_time ASC').all<JobRow>()).results.map((r) => toJob(r)!);

const getJob = async (db: D1Database, id: string) => toJob(await db.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first<JobRow>());

const JOB_COLS = ['kind', 'title', 'client_id', 'client_name', 'phone', 'proposal_id', 'date', 'start_time', 'end_time', 'location', 'blocks_date', 'status', 'due_date', 'delivery_link', 'delivered_at', 'notes'] as const;
const jobValues = (j: JobInput) => JOB_COLS.map((k) => (k === 'blocks_date' ? (j.blocks_date ? 1 : 0) : j[k]));

export async function insertJob(db: D1Database, id: string, j: JobInput) {
  const t = now();
  await db
    .prepare(`INSERT INTO jobs (id, ${JOB_COLS.join(', ')}, created_at, updated_at) VALUES (?, ${JOB_COLS.map(() => '?').join(', ')}, ?, ?)`)
    .bind(id, ...jobValues(j), t, t)
    .run();
  return getJob(db, id);
}

export async function updateJob(db: D1Database, id: string, j: JobInput) {
  const r = await db
    .prepare(`UPDATE jobs SET ${JOB_COLS.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
    .bind(...jobValues(j), now(), id)
    .run();
  return r.meta.changes ? getJob(db, id) : null;
}

export const deleteJob = async (db: D1Database, id: string) =>
  (await db.prepare('DELETE FROM jobs WHERE id = ?').bind(id).run()).meta.changes > 0;

/** Público: a data está ocupada? (só a resposta sim/não, sem detalhes) */
export const isDateBusy = async (db: D1Database, date: string) =>
  !!(await db.prepare("SELECT 1 AS x FROM jobs WHERE date = ? AND blocks_date = 1 AND status != 'cancelado' LIMIT 1").bind(date).first());
