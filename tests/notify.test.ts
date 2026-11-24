import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from '../worker/db.ts';
import { cleanupNotices, notifyCancel, notifySignup, sendNotices } from '../worker/notify.ts';
import { maskEmail, normalizeEmail, noticeEmail } from '../src/lib/notify.ts';

/** D1 de mentira sobre SQLite real. */
function fakeD1(sqlite: DatabaseSync) {
  const stmt = (sql: string, binds: unknown[] = []) => ({
    bind: (...b: unknown[]) => stmt(sql, b),
    async first<T>() { return (sqlite.prepare(sql).get(...(binds as never[])) ?? null) as T; },
    async all<T>() { return { results: sqlite.prepare(sql).all(...(binds as never[])) as T[] }; },
    async run() { const r = sqlite.prepare(sql).run(...(binds as never[])); return { meta: { changes: Number(r.changes) } }; },
  });
  return {
    prepare: (sql: string) => stmt(sql),
    async batch(list: { run(): Promise<unknown> }[]) { for (const s of list) await s.run(); return []; },
  } as unknown as Parameters<typeof migrate>[0];
}

async function setup(status = 'rascunho') {
  const sqlite = new DatabaseSync(':memory:');
  const db = fakeD1(sqlite);
  for (let i = 0; i < 5; i++) await migrate(db);
  const t = new Date().toISOString();
  sqlite
    .prepare(`INSERT INTO events (id, slug, name, date, location, status, published_at, sale_days, download_days, announced, price_single, created_at, updated_at)
      VALUES ('evt_aaaaaa1', 'manaus-run', 'Manaus Run', '2026-11-22', 'Ponta Negra', ?, ?, 30, 30, 1, 10, ?, ?)`)
    .run(status, status === 'publicado' ? t : '', t, t);
  const env = { DB: db, RESEND_API_KEY: 're_test', EMAIL_FROM: 'Venart <avisos@exemplo.com.br>' };
  return { sqlite, db, env };
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const body = async (r: Response) => ({ s: r.status, j: (await r.json()) as Record<string, unknown> });
const allow = async () => true;
const count = (s: DatabaseSync) => (s.prepare('SELECT COUNT(*) AS n FROM notify_requests').get() as { n: number }).n;

test('e-mail: valida e normaliza', () => {
  assert.equal(normalizeEmail('  Ana.Silva@Gmail.com '), 'ana.silva@gmail.com');
  for (const bad of ['', 'ana', 'ana@', '@x.com', 'ana@x', 'a..b@x.com', 'ana@x.c', 'a b@x.com', '<x>@x.com']) assert.equal(normalizeEmail(bad), '', bad);
  assert.equal(maskEmail('joaquim@gmail.com'), 'jo****@gmail.com');
});

test('conteúdo do aviso: escapa o nome e leva à galeria', () => {
  const m = noticeEmail({ name: 'Corrida <b>X</b>', date: '2026-11-22', location: 'Manaus', url: 'https://site/e/corrida' });
  assert.ok(m.subject.includes('Corrida <b>X</b>'));
  assert.ok(m.html.includes('Corrida &lt;b&gt;X&lt;/b&gt;'));
  assert.ok(m.html.includes('href="https://site/e/corrida"'));
  assert.ok(m.text.includes('22/11/2026 · Manaus'));
});

test('pedido: exige consentimento, e-mail válido e envio configurado; não duplica', async () => {
  const { sqlite, env } = await setup();
  assert.equal((await body(await notifySignup({ DB: env.DB }, 'manaus-run', { email: 'a@b.com', consent: true }, allow, json))).s, 503);
  assert.equal((await body(await notifySignup(env, 'manaus-run', { email: 'a@b.com' }, allow, json))).s, 400);
  assert.equal((await body(await notifySignup(env, 'manaus-run', { email: 'xx', consent: true }, allow, json))).s, 400);
  assert.equal((await body(await notifySignup(env, 'nao-existe', { email: 'a@b.com', consent: true }, allow, json))).s, 404);
  assert.equal((await body(await notifySignup(env, 'manaus-run', { email: 'a@b.com', consent: true }, async () => false, json))).s, 429);
  const r1 = await body(await notifySignup(env, 'manaus-run', { email: 'Ana@B.com', consent: true }, allow, json));
  assert.equal(r1.s, 201);
  assert.match(String(r1.j.token), /^[A-Za-z0-9_-]{20,}$/);
  const r2 = await body(await notifySignup(env, 'manaus-run', { email: 'ana@b.com', consent: true }, allow, json));
  assert.equal(r2.j.token, ''); // já pedido: sem código de cancelamento
  assert.equal(count(sqlite), 1);
  // Robô (campo-armadilha) não grava.
  await notifySignup(env, 'manaus-run', { email: 'bot@b.com', consent: true, website: 'x' }, allow, json);
  assert.equal(count(sqlite), 1);
  // Cancelar apaga.
  await notifyCancel(env, { token: r1.j.token }, json);
  assert.equal(count(sqlite), 0);
});

test('rascunho não anunciado não aceita pedido', async () => {
  const { sqlite, env } = await setup();
  sqlite.prepare("UPDATE events SET announced = 0").run();
  assert.equal((await body(await notifySignup(env, 'manaus-run', { email: 'a@b.com', consent: true }, allow, json))).s, 404);
});

test('envio: só com o evento publicado; em lotes; apaga o e-mail depois; falhas tentam de novo', async () => {
  const { sqlite, env } = await setup();
  for (let i = 0; i < 130; i++) await notifySignup(env, 'manaus-run', { email: `p${i}@exemplo.com`, consent: true }, allow, json);
  assert.equal(count(sqlite), 130);
  const calls: { to: string[]; subject: string; html: string }[][] = [];
  const okFetch = (async (_u: string, init: RequestInit) => {
    const list = JSON.parse(String(init.body));
    calls.push(list);
    return new Response(JSON.stringify({ data: list.map(() => ({ id: 'x' })) }), { status: 200 });
  }) as typeof fetch;

  // Ainda rascunho: nada sai.
  assert.equal((await sendNotices(env, 'evt_aaaaaa1', 'https://site', 3, okFetch)).skipped, 'nao-publicado');
  assert.equal(calls.length, 0);

  sqlite.prepare("UPDATE events SET status = 'publicado', published_at = ?").run(new Date().toISOString());
  // 1 lote só (100); o resto fica para a próxima.
  const r1 = await sendNotices(env, 'evt_aaaaaa1', 'https://site', 1, okFetch);
  assert.deepEqual([r1.sent, r1.failed, r1.pending], [100, 0, 30]);
  assert.equal(calls[0]!.length, 100);
  assert.ok(calls[0]![0]!.html.includes('https://site/e/manaus-run'));
  // Serviço fora do ar: nada é apagado, conta tentativa.
  const down = (async () => new Response(JSON.stringify({ message: 'fora' }), { status: 500 })) as unknown as typeof fetch;
  const r2 = await sendNotices(env, 'evt_aaaaaa1', 'https://site', 3, down);
  assert.deepEqual([r2.sent, r2.failed, r2.pending], [0, 30, 30]);
  // Volta: um endereço recusado pelo serviço (modo permissivo), os outros saem.
  const partial = (async (_u: string, init: RequestInit) => {
    const list = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ data: list.slice(1).map(() => ({ id: 'x' })), errors: [{ index: 0, message: 'invalid' }] }), { status: 200 });
  }) as typeof fetch;
  const r3 = await sendNotices(env, 'evt_aaaaaa1', 'https://site', 3, partial);
  assert.equal(r3.sent, 29);
  assert.equal(count(sqlite), 1); // só o que falhou continua guardado
  const sent = (sqlite.prepare("SELECT notify_sent FROM events").get() as { notify_sent: number }).notify_sent;
  assert.equal(sent, 129);
  // Nenhum e-mail enviado continua no banco.
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS n FROM notify_requests WHERE email = 'p0@exemplo.com'").get() as { n: number }).n, 0);
});

test('limpeza: pedidos antigos e de eventos excluídos', async () => {
  const { sqlite, db, env } = await setup();
  await notifySignup(env, 'manaus-run', { email: 'a@b.com', consent: true }, allow, json);
  sqlite.prepare("INSERT INTO notify_requests (id, event_id, email, token, consent_version, created_at) VALUES ('x', 'evt_sumiu', 'c@d.com', 't', 'v', ?)").run(new Date().toISOString());
  sqlite.prepare("INSERT INTO notify_requests (id, event_id, email, token, consent_version, created_at) VALUES ('y', 'evt_aaaaaa1', 'e@f.com', 't2', 'v', '2020-01-01T00:00:00.000Z')").run();
  await cleanupNotices(db);
  assert.equal(count(sqlite), 1);
});
