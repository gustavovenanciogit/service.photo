import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from '../worker/db.ts';

/** D1 de mentira sobre SQLite real, contando consultas por "acesso" (limite do plano gratuito: 50). */
function fakeD1(sqlite: DatabaseSync) {
  let count = 0;
  const stmt = (sql: string, binds: unknown[] = []) => ({
    bind: (...b: unknown[]) => stmt(sql, b),
    async first<T>() { count++; return (sqlite.prepare(sql).get(...(binds as never[])) ?? null) as T; },
    async all<T>() { count++; return { results: sqlite.prepare(sql).all(...(binds as never[])) as T[] }; },
    async run() { count++; sqlite.prepare(sql).run(...(binds as never[])); return { meta: { changes: 1 } }; },
  });
  const db = {
    prepare: (sql: string) => stmt(sql),
    async batch(list: { run(): Promise<unknown> }[]) { for (const s of list) await s.run(); return []; },
  };
  return { db: db as unknown as Parameters<typeof migrate>[0], used: () => count, reset: () => (count = 0) };
}

const columns = (sqlite: DatabaseSync, table: string) => (sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
const version = (sqlite: DatabaseSync) => (sqlite.prepare("SELECT value FROM settings WHERE key = 'schema_version'").get() as { value: string } | undefined)?.value;

async function runUntilDone(sqlite: DatabaseSync, maxAccesses = 5) {
  const f = fakeD1(sqlite);
  const per: number[] = [];
  for (let i = 0; i < maxAccesses; i++) {
    f.reset();
    await migrate(f.db);
    per.push(f.used());
    if (f.used() === 1) break; // só conferiu a versão: está pronto
  }
  return per;
}

test('banco novo: cria tudo em lotes, sem passar de 50 consultas por acesso', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const per = await runUntilDone(sqlite);
  console.log(`  banco novo → consultas por acesso: ${per.join(', ')}`);
  assert.ok(per.every((n) => n <= 40), `consultas por acesso: ${per}`);
  assert.equal(per.at(-1), 1);
  assert.ok(columns(sqlite, 'orders').includes('coupon_code'));
  assert.ok(columns(sqlite, 'face_index').includes('sharp'));
  assert.ok(columns(sqlite, 'coupons').includes('stackable'));
  assert.ok(version(sqlite));
});

test('banco de antes dos cupons (produção): aplica só o que falta, num acesso', async () => {
  const sqlite = new DatabaseSync(':memory:');
  // Estrutura completa e depois "volta no tempo": tira o que veio com os cupons (como estava o site).
  await runUntilDone(sqlite);
  for (const t of ['coupon_redemptions', 'coupon_events', 'coupons']) sqlite.exec(`DROP TABLE ${t}`);
  for (const c of ['coupon_code', 'discount', 'subtotal']) sqlite.exec(`ALTER TABLE orders DROP COLUMN ${c}`);
  sqlite.exec("UPDATE settings SET value = 'antiga' WHERE key = 'schema_version'");
  const per = await runUntilDone(sqlite);
  console.log(`  antes dos cupons → consultas por acesso: ${per.join(', ')}`);
  assert.ok(per[0]! <= 15, `primeiro acesso: ${per[0]} consultas`);
  assert.ok(columns(sqlite, 'orders').includes('discount'));
  assert.ok(columns(sqlite, 'coupons').length > 5);
  assert.equal(per.at(-1), 1);
});

test('banco já atualizado: uma consulta só', async () => {
  const sqlite = new DatabaseSync(':memory:');
  await runUntilDone(sqlite);
  const f = fakeD1(sqlite);
  await migrate(f.db);
  assert.equal(f.used(), 1);
});
