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
  // Loja de fotos: eventos e fotos (arquivos ficam no R2).
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    cover_photo_id TEXT NOT NULL DEFAULT '',
    price_single REAL NOT NULL,
    price_pack REAL NOT NULL DEFAULT 0,
    sale_days INTEGER NOT NULL,
    download_days INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'rascunho',
    listed INTEGER NOT NULL DEFAULT 0,
    photo_count INTEGER NOT NULL DEFAULT 0,
    published_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS event_photos (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    seq INTEGER NOT NULL,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    ready INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE (event_id, file_name)
  )`,
  `CREATE INDEX IF NOT EXISTS event_photos_seq ON event_photos (event_id, seq)`,
  // Loja de fotos: pedidos (Fase 2).
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    event_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_slug TEXT NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    buyer_phone TEXT NOT NULL,
    total REAL NOT NULL,
    use_pack INTEGER NOT NULL DEFAULT 0,
    photo_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    checkout_url TEXT NOT NULL DEFAULT '',
    preference_id TEXT NOT NULL DEFAULT '',
    payment_id TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL DEFAULT '',
    paid_at TEXT NOT NULL DEFAULT '',
    download_days INTEGER NOT NULL DEFAULT 30,
    download_until TEXT NOT NULL DEFAULT '',
    checked_at INTEGER NOT NULL DEFAULT 0,
    terms_version TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS orders_event ON orders (event_id)`,
  `CREATE INDEX IF NOT EXISTS orders_created ON orders (created_at)`,
  `CREATE TABLE IF NOT EXISTS order_items (
    order_id TEXT NOT NULL,
    photo_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    PRIMARY KEY (order_id, photo_id)
  )`,
  // Faturamento lançado à mão (serviços etc.), para o controle do limite do MEI.
  `CREATE TABLE IF NOT EXISTS revenue_entries (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  // Configurações do painel (ex.: marca d'água), em JSON.
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  // Reconhecimento facial (piloto): só assinaturas numéricas, nunca imagens de rosto.
  `CREATE TABLE IF NOT EXISTS face_index (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    photo_id TEXT NOT NULL,
    vec TEXT NOT NULL,
    score REAL NOT NULL DEFAULT 0,
    box TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS face_index_event ON face_index (event_id)`,
  // Aviso de publicação por e-mail (pedido voluntário, com consentimento). Apagado após o envio.
  `CREATE TABLE IF NOT EXISTS notify_requests (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    consent_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '',
    claimed_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS notify_event_email ON notify_requests (event_id, email)`,
  `CREATE INDEX IF NOT EXISTS notify_token ON notify_requests (token)`,
  `CREATE TABLE IF NOT EXISTS face_consents (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    version TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    revoked_at TEXT NOT NULL DEFAULT ''
  )`,
  // Treinar a IA: respostas do fotógrafo sobre pares de rostos (só números e a resposta;
  // continuam valendo para a calibragem mesmo depois que o evento é apagado).
  `CREATE TABLE IF NOT EXISTS face_labels (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    pair TEXT NOT NULL UNIQUE,
    score REAL NOT NULL,
    answer TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  // Cupons de desconto (valores em centavos; percentual em centésimos de %).
  `CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,
    value INTEGER NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 0,
    per_customer INTEGER NOT NULL DEFAULT 0,
    starts_at TEXT NOT NULL DEFAULT '',
    ends_at TEXT NOT NULL DEFAULT '',
    scope TEXT NOT NULL DEFAULT 'events',
    min_cents INTEGER NOT NULL DEFAULT 0,
    applies TEXT NOT NULL DEFAULT 'both',
    stackable INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS coupon_events (
    coupon_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    PRIMARY KEY (coupon_id, event_id)
  )`,
  `CREATE INDEX IF NOT EXISTS coupon_events_event ON coupon_events (event_id)`,
  `CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id TEXT PRIMARY KEY,
    coupon_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon ON coupon_redemptions (coupon_id)`,
  // Validação facial: sessões (fotografia das métricas) e alterações do limiar (com o anterior, para restaurar).
  `CREATE TABLE IF NOT EXISTS face_sessions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL,
    model TEXT NOT NULL,
    pipeline TEXT NOT NULL,
    threshold REAL NOT NULL,
    recommended REAL NOT NULL DEFAULT -1,
    same INTEGER NOT NULL,
    diff INTEGER NOT NULL,
    unsure INTEGER NOT NULL,
    recall REAL NOT NULL DEFAULT -1,
    precision REAL NOT NULL DEFAULT -1,
    fpr REAL NOT NULL DEFAULT -1,
    set_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS face_threshold_log (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL DEFAULT '',
    old_value REAL NOT NULL,
    new_value REAL NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS face_pilot_runs (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    consent_id TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    ip TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    first_at INTEGER NOT NULL
  )`,
];

let ready: Promise<unknown> | null = null;
/**
 * Colunas adicionadas depois da criação da tabela (bancos já em uso recebem sem perder dados).
 * "duplicate column" significa que já foi aplicada: é ignorado.
 */
const MIGRATIONS = [
  `ALTER TABLE clients ADD COLUMN hook TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE clients ADD COLUMN outreach_step INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE clients ADD COLUMN last_contact TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE orders ADD COLUMN provider TEXT NOT NULL DEFAULT 'mercadopago'`,
  `ALTER TABLE orders ADD COLUMN payment_ref TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE events ADD COLUMN purged_at TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE events ADD COLUMN watermark_model INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE event_photos ADD COLUMN wm_sig TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE events ADD COLUMN cover_image TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE events ADD COLUMN cover_position TEXT NOT NULL DEFAULT '50% 50%'`,
  `ALTER TABLE orders ADD COLUMN fee_amount REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN net_amount REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN release_date TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE orders ADD COLUMN pix_code TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE orders ADD COLUMN pix_expires TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE orders ADD COLUMN pay_attempts INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE event_photos ADD COLUMN faces INTEGER NOT NULL DEFAULT -1`,
  `ALTER TABLE events ADD COLUMN face_search INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE events ADD COLUMN face_pack_at TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE events ADD COLUMN face_only INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE face_index ADD COLUMN sharp REAL NOT NULL DEFAULT -1`,
  `ALTER TABLE orders ADD COLUMN subtotal REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN discount REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN coupon_code TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE events ADD COLUMN face_threshold REAL NOT NULL DEFAULT -1`,
  // Cartão Digital: página permanente de espera (antes de publicar) e previsão de publicação.
  `ALTER TABLE events ADD COLUMN announced INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE events ADD COLUMN publish_forecast TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE events ADD COLUMN notify_sent INTEGER NOT NULL DEFAULT 0`,
];

/**
 * Versão da estrutura do banco. Muda sozinha quando entra uma tabela ou coluna nova
 * (as listas acima só crescem). Assim a conferência roda UMA vez por versão, e não a cada
 * vez que o servidor acorda (o plano gratuito limita as consultas por acesso).
 */
const SCHEMA_VERSION = `${SCHEMA.length}.${MIGRATIONS.length}`;

/** Quantos comandos de estrutura no máximo por acesso (o plano gratuito permite 50 consultas no total). */
const MIGRATION_BUDGET = 30;

/** Nome da tabela/índice criado por um comando CREATE … IF NOT EXISTS. */
const createdName = (sql: string) => /CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s+IF\s+NOT\s+EXISTS\s+(\w+)/i.exec(sql)?.[1] ?? '';
/** Tabela e coluna de um ALTER TABLE … ADD COLUMN. */
const alterTarget = (sql: string) => {
  const m = /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/i.exec(sql);
  return m ? { table: m[1]!, column: m[2]! } : null;
};

/**
 * O que falta aplicar, olhando a estrutura atual do banco (sqlite_master guarda o CREATE de
 * cada tabela, já com as colunas adicionadas depois). Puro: usado também nos testes.
 */
export function pendingMigrations(existing: { name: string; sql: string | null }[]) {
  const names = new Set(existing.map((e) => e.name));
  const tableSql = new Map(existing.map((e) => [e.name, (e.sql ?? '').toLowerCase()]));
  const out: string[] = [];
  for (const s of SCHEMA) if (!names.has(createdName(s))) out.push(s);
  for (const m of MIGRATIONS) {
    const t = alterTarget(m);
    if (!t) continue;
    const sql = tableSql.get(t.table);
    // Tabela ainda não existe (vai ser criada agora, já sem a coluna) ou coluna ausente.
    if (sql === undefined || !new RegExp(`[(,\\s]${t.column.toLowerCase()}\\s`).test(sql)) out.push(m);
  }
  return out;
}

export async function migrate(db: D1Database) {
  // Já está na versão atual? Uma consulta só.
  try {
    const row = await db.prepare("SELECT value FROM settings WHERE key = 'schema_version'").first<{ value: string }>();
    if (row?.value === SCHEMA_VERSION) return;
  } catch {
    // tabela settings ainda não existe (banco novo): segue para criar tudo
  }
  // Só o que falta, em lotes pequenos: se não couber neste acesso, continua no próximo.
  const existing = (await db.prepare("SELECT name, sql FROM sqlite_master WHERE type IN ('table', 'index')").all<{ name: string; sql: string | null }>()).results;
  const pending = pendingMigrations(existing);
  const now = pending.slice(0, MIGRATION_BUDGET);
  let allOk = pending.length <= MIGRATION_BUDGET;
  for (const m of now) {
    try {
      await db.prepare(m).run();
    } catch (e) {
      const msg = String((e as Error).message);
      if (/duplicate column|already exists/i.test(msg)) continue; // já aplicada
      // Não derruba o site por causa de uma coluna: registra no log e tenta de novo no próximo acesso.
      allOk = false;
      console.error('Migração falhou:', m, msg);
    }
  }
  if (allOk) {
    await db
      .prepare("INSERT INTO settings (key, value, updated_at) VALUES ('schema_version', ?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2")
      .bind(SCHEMA_VERSION, new Date().toISOString())
      .run();
  } else if (pending.length > MIGRATION_BUDGET) {
    console.log(`Estrutura do banco: ${now.length} aplicadas, ${pending.length - now.length} ficam para o próximo acesso.`);
  }
}

export const ensureSchema = (db: D1Database) => (ready ??= migrate(db).catch((e) => ((ready = null), Promise.reject(e))));

const now = () => new Date().toISOString();

// ───────── Clientes ─────────

export const listClients = async (db: D1Database) =>
  (await db.prepare('SELECT * FROM clients ORDER BY updated_at DESC').all<Client>()).results;

export async function insertClient(db: D1Database, id: string, c: ClientInput) {
  const t = now();
  await db
    .prepare(
      `INSERT INTO clients (id, name, type, contact, phone, instagram, email, stage, next_followup, notes, hook, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, c.name, c.type, c.contact, c.phone, c.instagram, c.email, c.stage, c.next_followup, c.notes, c.hook, t, t)
    .run();
  return db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first<Client>();
}

export async function updateClient(db: D1Database, id: string, c: ClientInput) {
  const r = await db
    .prepare(
      `UPDATE clients SET name = ?, type = ?, contact = ?, phone = ?, instagram = ?, email = ?, stage = ?,
       next_followup = ?, notes = ?, hook = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(c.name, c.type, c.contact, c.phone, c.instagram, c.email, c.stage, c.next_followup, c.notes, c.hook, now(), id)
    .run();
  return r.meta.changes ? db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first<Client>() : null;
}

/** Atualiza só o estado da Fila de abordagem (não mexe nos outros dados do cliente). */
export async function setOutreach(db: D1Database, id: string, o: { stage: string; outreach_step: number; next_followup: string; last_contact: string }) {
  const r = await db
    .prepare('UPDATE clients SET stage = ?, outreach_step = ?, next_followup = ?, last_contact = ?, updated_at = ? WHERE id = ?')
    .bind(o.stage, o.outreach_step, o.next_followup, o.last_contact, now(), id)
    .run();
  return r.meta.changes ? db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first<Client>() : null;
}

export const getClient = (db: D1Database, id: string) => db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first<Client>();

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
