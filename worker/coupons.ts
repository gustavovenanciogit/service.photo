/**
 * CUPONS DE DESCONTO — servidor
 * ------------------------------------------------------------------
 * Painel (com login):
 *   GET    /api/coupons[?event=evt_…]   → cupons (com utilizações e eventos)
 *   POST   /api/coupons                 → cria
 *   PUT    /api/coupons/:id             → edita
 *   PATCH  /api/coupons/:id {active}    → ativa/desativa
 *   DELETE /api/coupons/:id             → exclui (só se nunca foi usado em compra paga)
 * Público:
 *   POST   /api/public/coupons/check    → prévia do desconto na galeria (não reserva nada)
 * Pedido (createOrder): applyCouponToOrder valida, calcula e RESERVA a utilização de forma
 * atômica (um único INSERT … SELECT … WHERE contagem < limite), para o limite não estourar
 * com compras simultâneas. A reserva vale enquanto o pedido está pago ou aguardando pagamento.
 */
import {
  couponBlocker, couponStatus, customerKeys, normalizeCode, parseCoupon, priceWithCoupon, type Coupon, type CouponInput,
} from '../src/lib/coupons.ts';
import { newId } from '../src/lib/crm.ts';
import { store } from '../src/config/store.ts';

type Json = (data: unknown, status?: number, headers?: Record<string, string>) => Response;
const now = () => new Date().toISOString();

type CouponRow = Omit<Coupon, 'event_ids' | 'stackable' | 'active'> & { stackable: number; active: number };

/** Utilizações que contam para o limite: pedido pago/divergente, ou aguardando pagamento dentro do prazo. */
const ACTIVE_USE = `(o.status IN ('pago','divergente') OR (o.status IN ('pendente','recusado') AND o.created_at > ?2) OR (o.id IS NULL AND r.created_at > ?3))`;
const usesSql = `SELECT COUNT(*) FROM coupon_redemptions r LEFT JOIN orders o ON o.id = r.order_id WHERE r.coupon_id = ?1 AND ${ACTIVE_USE}`;
const cutoffs = () => [new Date(Date.now() - store.pendingHours * 3_600_000).toISOString(), new Date(Date.now() - 10 * 60_000).toISOString()] as const;

async function loadCoupons(db: D1Database, where = '', binds: unknown[] = []) {
  const rows = (await db.prepare(`SELECT * FROM coupons ${where} ORDER BY created_at DESC`).bind(...binds).all<CouponRow>()).results;
  if (!rows.length) return [];
  const links = (
    await db
      .prepare(`SELECT coupon_id, event_id FROM coupon_events WHERE coupon_id IN (SELECT value FROM json_each(?))`)
      .bind(JSON.stringify(rows.map((r) => r.id)))
      .all<{ coupon_id: string; event_id: string }>()
  ).results;
  return rows.map(
    (r): Coupon => ({ ...r, stackable: !!r.stackable, active: !!r.active, event_ids: links.filter((l) => l.coupon_id === r.id).map((l) => l.event_id) }),
  );
}

export async function couponByCode(db: D1Database, code: string) {
  const c = normalizeCode(code);
  return c ? ((await loadCoupons(db, 'WHERE code = ?', [c]))[0] ?? null) : null;
}

async function usage(db: D1Database, couponId: string, email = '', phone = '') {
  const [c1, c2] = cutoffs();
  const row = await db
    .prepare(
      `SELECT (${usesSql}) AS active_uses,
              (SELECT COUNT(*) FROM coupon_redemptions r JOIN orders o ON o.id = r.order_id WHERE r.coupon_id = ?1 AND o.status = 'pago') AS confirmed,
              (SELECT COUNT(*) FROM coupon_redemptions r LEFT JOIN orders o ON o.id = r.order_id WHERE r.coupon_id = ?1 AND ${ACTIVE_USE}
                 AND ((?4 != '' AND r.email = ?4) OR (?5 != '' AND r.phone = ?5))) AS customer_uses`,
    )
    .bind(couponId, c1, c2, email, phone)
    .first<{ active_uses: number; confirmed: number; customer_uses: number }>();
  return { active: row?.active_uses ?? 0, confirmed: row?.confirmed ?? 0, customer: row?.customer_uses ?? 0 };
}

// ───────── Painel ─────────

async function saveLinks(db: D1Database, id: string, c: CouponInput) {
  const stmts = [db.prepare('DELETE FROM coupon_events WHERE coupon_id = ?').bind(id)];
  if (c.scope === 'events') for (const e of c.event_ids) stmts.push(db.prepare('INSERT OR IGNORE INTO coupon_events (coupon_id, event_id) VALUES (?, ?)').bind(id, e));
  return stmts;
}

export async function couponsAdminApi(req: Request, env: { DB: D1Database }, path: string, url: URL, json: Json, readJson: (r: Request) => Promise<unknown>) {
  const db = env.DB;
  const method = req.method;

  if (path === '/api/coupons') {
    if (method === 'GET') {
      const ev = url.searchParams.get('event');
      const list =
        ev && /^evt_[a-z0-9]{6,30}$/.test(ev)
          ? await loadCoupons(db, "WHERE scope = 'all' OR id IN (SELECT coupon_id FROM coupon_events WHERE event_id = ?)", [ev])
          : await loadCoupons(db);
      const out = [];
      for (const c of list) {
        const u = await usage(db, c.id);
        out.push({ ...c, uses_confirmed: u.confirmed, uses_active: u.active, status: couponStatus(c, u.active) });
      }
      return json(out);
    }
    if (method === 'POST') {
      const p = parseCoupon(await readJson(req));
      if (!p.ok) return json({ error: p.error }, 400);
      const c = p.value;
      if (await db.prepare('SELECT 1 FROM coupons WHERE code = ?').bind(c.code).first()) return json({ error: `Já existe um cupom com o código ${c.code}.` }, 409);
      const id = newId('cp');
      const t = now();
      await db.batch([
        db
          .prepare(
            `INSERT INTO coupons (id, code, kind, value, max_uses, per_customer, starts_at, ends_at, scope, min_cents, applies, stackable, active, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .bind(id, c.code, c.kind, c.value, c.max_uses, c.per_customer, c.starts_at, c.ends_at, c.scope, c.min_cents, c.applies, c.stackable ? 1 : 0, c.active ? 1 : 0, t, t),
        ...(await saveLinks(db, id, c)),
      ]);
      return json({ id }, 201);
    }
  }

  const m = /^\/api\/coupons\/(cp_[a-z0-9]{6,30})$/.exec(path);
  if (!m) return json({ error: 'Não encontrado.' }, 404);
  const id = m[1]!;
  const cur = (await loadCoupons(db, 'WHERE id = ?', [id]))[0];
  if (!cur) return json({ error: 'Cupom não encontrado.' }, 404);

  if (method === 'PUT') {
    const p = parseCoupon(await readJson(req));
    if (!p.ok) return json({ error: p.error }, 400);
    const c = p.value;
    if (c.code !== cur.code && (await db.prepare('SELECT 1 FROM coupons WHERE code = ? AND id != ?').bind(c.code, id).first())) {
      return json({ error: `Já existe um cupom com o código ${c.code}.` }, 409);
    }
    await db.batch([
      db
        .prepare(
          `UPDATE coupons SET code=?, kind=?, value=?, max_uses=?, per_customer=?, starts_at=?, ends_at=?, scope=?, min_cents=?, applies=?, stackable=?, active=?, updated_at=? WHERE id=?`,
        )
        .bind(c.code, c.kind, c.value, c.max_uses, c.per_customer, c.starts_at, c.ends_at, c.scope, c.min_cents, c.applies, c.stackable ? 1 : 0, c.active ? 1 : 0, now(), id),
      ...(await saveLinks(db, id, c)),
    ]);
    return json({ ok: true });
  }
  if (method === 'PATCH') {
    const b = (await readJson(req)) as { active?: unknown };
    await db.prepare('UPDATE coupons SET active = ?, updated_at = ? WHERE id = ?').bind(b.active === true ? 1 : 0, now(), id).run();
    return json({ ok: true });
  }
  if (method === 'DELETE') {
    const used = await db.prepare("SELECT 1 FROM coupon_redemptions r JOIN orders o ON o.id = r.order_id WHERE r.coupon_id = ? AND o.status IN ('pago','reembolsado','divergente') LIMIT 1").bind(id).first();
    if (used) return json({ error: 'Este cupom já foi usado em compras. Desative-o em vez de excluir (o histórico das vendas fica guardado).' }, 409);
    await db.batch([
      db.prepare('DELETE FROM coupon_redemptions WHERE coupon_id = ?').bind(id),
      db.prepare('DELETE FROM coupon_events WHERE coupon_id = ?').bind(id),
      db.prepare('DELETE FROM coupons WHERE id = ?').bind(id),
    ]);
    return json({ ok: true });
  }
  return json({ error: 'Não encontrado.' }, 404);
}

// ───────── Galeria (prévia) e pedido ─────────

type EventPrice = { id: string; price_single: number; price_pack: number };

/** Valida o cupom para esta compra e calcula o preço. Não reserva nada. */
export async function evaluateCoupon(db: D1Database, code: string, ev: EventPrice, count: number, email = '', phone = '') {
  const c = await couponByCode(db, code);
  if (!c) return { error: 'Cupom não encontrado. Confira o código.' } as const;
  const keys = customerKeys(email, phone);
  const u = await usage(db, c.id, keys.email, keys.phone);
  const block = couponBlocker(c, ev.id, u.active, u.customer);
  if (block) return { error: block } as const;
  const price = priceWithCoupon(count, ev.price_single, ev.price_pack, c);
  if (!price.couponApplied) return { error: price.reason || 'Este cupom não se aplica a esta compra.' } as const;
  return { coupon: c, price, keys } as const;
}

export async function couponCheckApi(db: D1Database, ev: EventPrice, body: unknown, json: Json) {
  const b = (body ?? {}) as { code?: unknown; count?: unknown; email?: unknown; phone?: unknown };
  const count = Number(b.count);
  if (!Number.isInteger(count) || count < 1 || count > store.maxPhotosPerOrder) return json({ error: 'Selecione as fotos antes de aplicar o cupom.' }, 400);
  const r = await evaluateCoupon(db, String(b.code ?? ''), ev, count, String(b.email ?? ''), String(b.phone ?? ''));
  if ('error' in r) return json({ error: r.error }, 400);
  return json({
    code: r.coupon.code,
    use_pack: r.price.usePack,
    subtotal: r.price.baseCents / 100,
    discount: r.price.discountCents / 100,
    total: r.price.totalCents / 100,
  });
}

/**
 * Reserva a utilização do cupom para o pedido (antes de gravar o pedido). Um único comando:
 * só insere se ainda couber no limite total e no limite por cliente. Devolve false se esgotou.
 */
export async function reserveCoupon(db: D1Database, c: Coupon, orderId: string, keys: { email: string; phone: string }) {
  const [c1, c2] = cutoffs();
  const r = await db
    .prepare(
      `INSERT INTO coupon_redemptions (id, coupon_id, order_id, email, phone, created_at)
       SELECT ?6, ?1, ?7, ?4, ?5, ?8
       WHERE (?9 = 0 OR (${usesSql}) < ?9)
         AND (?10 = 0 OR (SELECT COUNT(*) FROM coupon_redemptions r LEFT JOIN orders o ON o.id = r.order_id WHERE r.coupon_id = ?1 AND ${ACTIVE_USE}
                           AND ((?4 != '' AND r.email = ?4) OR (?5 != '' AND r.phone = ?5))) < ?10)`,
    )
    .bind(c.id, c1, c2, keys.email, keys.phone, newId('cr'), orderId, now(), c.max_uses, c.per_customer)
    .run();
  return (r.meta.changes ?? 0) > 0;
}

export const releaseCoupon = (db: D1Database, orderId: string) => db.prepare('DELETE FROM coupon_redemptions WHERE order_id = ?').bind(orderId);
