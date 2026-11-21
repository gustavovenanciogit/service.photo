import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  couponBlocker, couponStatus, customerKeys, describeDiscount, discountOn, generateCode, isoToManaus, manausToISO, normalizeCode, parseCoupon,
  priceWithCoupon, type Coupon,
} from '../src/lib/coupons.ts';

const base: Coupon = {
  id: 'cp_x', code: 'VENART10', kind: 'percent', value: 1000, max_uses: 0, per_customer: 0, starts_at: '', ends_at: '', scope: 'events',
  event_ids: ['evt_aaaaaa'], min_cents: 0, applies: 'both', stackable: false, active: true, created_at: '', updated_at: '',
};
const cp = (o: Partial<Coupon>) => ({ ...base, ...o });

test('código: maiúsculas, sem espaços/acentos, gerado legível', () => {
  assert.equal(normalizeCode('  venart 10 '), 'VENART10');
  assert.equal(normalizeCode('promoção'), 'PROMOCAO');
  const g = generateCode('corrida', () => 0.5);
  assert.match(g, /^CORRIDA[2-9A-Z]{5}$/);
});

test('fuso de Manaus (UTC−4)', () => {
  assert.equal(manausToISO('2026-11-21T14:30'), '2026-11-21T18:30:00.000Z');
  assert.equal(isoToManaus('2026-11-21T18:30:00.000Z'), '2026-11-21T14:30');
  assert.equal(manausToISO('21/11/2026'), '');
});

test('validação do formulário', () => {
  const ok = parseCoupon({ code: ' atleta20 ', kind: 'percent', value: '12,5', scope: 'events', event_ids: ['evt_aaaaaa'], min: '50,00', applies: 'single' });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.code, 'ATLETA20');
    assert.equal(ok.value.value, 1250);
    assert.equal(ok.value.min_cents, 5000);
    assert.equal(ok.value.applies, 'single');
    assert.equal(ok.value.stackable, false); // padrão: não acumula
  }
  const fixed = parseCoupon({ code: 'DESCONTO5', kind: 'fixed', value: '5', scope: 'all' });
  assert.ok(fixed.ok && fixed.value.value === 500 && fixed.value.event_ids.length === 0);
  assert.equal(parseCoupon({ code: 'AB', value: 10, scope: 'all' }).ok, false);
  assert.equal(parseCoupon({ code: 'BOM#1', value: 10, scope: 'all' }).ok, false);
  assert.equal(parseCoupon({ code: 'ZERO', value: 0, scope: 'all' }).ok, false);
  assert.equal(parseCoupon({ code: 'MUITO', value: 101, scope: 'all' }).ok, false);
  assert.equal(parseCoupon({ code: 'SEMEVENTO', value: 10, scope: 'events', event_ids: [] }).ok, false);
  assert.equal(parseCoupon({ code: 'DATAS', value: 10, scope: 'all', starts_at: '2026-12-02T10:00', ends_at: '2026-12-01T10:00' }).ok, false);
});

test('situação do cupom', () => {
  const now = new Date('2026-11-21T15:00:00Z');
  assert.equal(couponStatus(cp({}), 0, now), 'ativo');
  assert.equal(couponStatus(cp({ active: false }), 0, now), 'desativado');
  assert.equal(couponStatus(cp({ ends_at: '2026-11-21T15:00:00.000Z' }), 0, now), 'expirado');
  assert.equal(couponStatus(cp({ starts_at: '2026-11-22T00:00:00.000Z' }), 0, now), 'agendado');
  assert.equal(couponStatus(cp({ max_uses: 50 }), 50, now), 'esgotado');
  assert.equal(couponStatus(cp({ max_uses: 50 }), 49, now), 'ativo');
});

test('desconto em centavos, nunca maior que a base', () => {
  assert.equal(discountOn(3870, { kind: 'percent', value: 1000 }), 387); // 10% de 38,70
  assert.equal(discountOn(1290, { kind: 'percent', value: 1250 }), 161); // 12,5% de 12,90 = 1,6125 → 1,61
  assert.equal(discountOn(1290, { kind: 'percent', value: 10_000 }), 1290); // 100%
  assert.equal(discountOn(300, { kind: 'fixed', value: 500 }), 300); // não fica negativo
  assert.equal(describeDiscount({ kind: 'percent', value: 1250 }), '12,5%');
  assert.equal(describeDiscount({ kind: 'fixed', value: 500 }), 'R$ 5,00');
});

test('preço com cupom: avulsas, pacote, acumulação e mínimo', () => {
  // 3 fotos × 12,90 = 38,70; pacote 119,90 (não compensa)
  let r = priceWithCoupon(3, 12.9, 119.9, cp({}));
  assert.deepEqual([r.usePack, r.baseCents, r.discountCents, r.totalCents, r.couponApplied], [false, 3870, 387, 3483, true]);
  // 12 fotos = 154,80 → pacote 119,90 é o automático
  r = priceWithCoupon(12, 12.9, 119.9, null);
  assert.deepEqual([r.usePack, r.totalCents], [true, 11990]);
  // Cupom 10% "ambos" sem acumular: avulsas com cupom 139,32 > pacote 119,90 → fica o pacote, sem cupom
  r = priceWithCoupon(12, 12.9, 119.9, cp({}));
  assert.equal(r.couponApplied, false);
  assert.equal(r.totalCents, 11990);
  assert.match(r.reason, /pacote/);
  // Acumulando: pacote com 10% = 107,91
  r = priceWithCoupon(12, 12.9, 119.9, cp({ stackable: true }));
  assert.deepEqual([r.usePack, r.discountCents, r.totalCents], [true, 1199, 10791]);
  // Cupom só de pacote vale no pacote (regra explícita)
  r = priceWithCoupon(12, 12.9, 119.9, cp({ applies: 'pack' }));
  assert.deepEqual([r.usePack, r.totalCents, r.couponApplied], [true, 10791, true]);
  // Só de pacote numa compra de 2 fotos: não se aplica
  r = priceWithCoupon(2, 12.9, 119.9, cp({ applies: 'pack' }));
  assert.equal(r.couponApplied, false);
  // Fixo de R$ 50 em 3 fotos: total zero, nunca negativo
  r = priceWithCoupon(3, 12.9, 0, cp({ kind: 'fixed', value: 5000 }));
  assert.deepEqual([r.discountCents, r.totalCents], [3870, 0]);
  // Mínimo de R$ 50: 3 fotos (38,70) não atingem
  r = priceWithCoupon(3, 12.9, 0, cp({ min_cents: 5000 }));
  assert.equal(r.couponApplied, false);
  assert.match(r.reason, /a partir de R\$ 50,00/);
  r = priceWithCoupon(4, 12.9, 0, cp({ min_cents: 5000 }));
  assert.equal(r.couponApplied, true);
});

test('pode usar? evento, limites e cliente', () => {
  const now = new Date('2026-11-21T15:00:00Z');
  assert.equal(couponBlocker(cp({}), 'evt_aaaaaa', 0, 0, now), '');
  assert.match(couponBlocker(cp({}), 'evt_bbbbbb', 0, 0, now), /não vale para este evento/);
  assert.equal(couponBlocker(cp({ scope: 'all', event_ids: [] }), 'evt_bbbbbb', 0, 0, now), '');
  assert.match(couponBlocker(cp({ max_uses: 1 }), 'evt_aaaaaa', 1, 0, now), /esgotou/);
  assert.match(couponBlocker(cp({ per_customer: 1 }), 'evt_aaaaaa', 3, 1, now), /máximo de vezes/);
  assert.deepEqual(customerKeys(' Ana@Exemplo.com ', '+55 (92) 99999-0000'), { email: 'ana@exemplo.com', phone: '92999990000' });
});
