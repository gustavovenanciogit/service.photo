import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byEvent, isSale, manausMonth, meiLimit, meiStatus, monthlySummary, ordersCsv } from '../src/lib/reports.ts';

const base = { photo_count: 1, provider: 'infinitepay' as const, event_id: 'evt_a', event_name: 'Treino A' };
const orders = [
  { ...base, status: 'pago' as const, paid_at: '2026-11-16T18:00:00Z', total: 12.9, payment_method: 'pix' },
  { ...base, status: 'pago' as const, paid_at: '2026-11-20T10:00:00Z', total: 119.9, payment_method: 'credit_card', photo_count: 12, event_id: 'evt_b', event_name: 'Corrida B' },
  { ...base, status: 'pago' as const, paid_at: '2026-12-01T02:00:00Z', total: 25.8, payment_method: 'manual', photo_count: 2 }, // 30/11 em Manaus
  { ...base, status: 'teste' as const, paid_at: '2026-11-16T18:00:00Z', total: 12.9, payment_method: 'credit_card' },
  { ...base, status: 'reembolsado' as const, paid_at: '2026-11-16T18:00:00Z', total: 12.9, payment_method: 'pix' },
  { ...base, status: 'pendente' as const, paid_at: '', total: 50, payment_method: '' },
];

test('manausMonth usa o horário de Manaus', () => {
  assert.equal(manausMonth('2026-12-01T02:00:00Z'), '2026-11');
  assert.equal(manausMonth('2026-12-01T05:00:00Z'), '2026-12');
  assert.equal(isSale(orders[3]!), false);
});

test('monthlySummary só conta pagos, por forma de pagamento', () => {
  const rows = monthlySummary(orders, [{ month: '2026-11', amount: 1500 }, { month: '2025-11', amount: 99 }], 2026);
  assert.equal(rows.length, 12);
  const nov = rows[10]!;
  assert.deepEqual(nov, { month: '2026-11', orders: 3, photos: 15, total: 158.6, ticket: 52.87, pix: 12.9, cartao: 119.9, manual: 25.8, other: 1500 });
  assert.equal(rows[11]!.orders, 0);
});

test('byEvent ordena pelo total', () => {
  const ev = byEvent(orders, 2026);
  assert.equal(ev[0]!.event_name, 'Corrida B');
  assert.equal(ev[1]!.total, 38.7);
  assert.equal(byEvent(orders, 2025).length, 0);
});

test('limite do MEI e alerta', () => {
  const cfg = { annualLimit: 81000, monthlyLimit: 6750, openedAt: '2026-09-10' };
  assert.equal(meiLimit(2026, cfg), 6750 * 4);
  assert.equal(meiLimit(2027, cfg), 81000);
  assert.equal(meiLimit(2026, { ...cfg, openedAt: '' }), 81000);
  assert.equal(meiStatus(10000, 81000).level, 'ok');
  assert.equal(meiStatus(56700, 81000).level, 'atencao');
  assert.equal(meiStatus(73000, 81000).level, 'alerta');
  assert.equal(meiStatus(82000, 81000).level, 'excedido');
  assert.equal(meiStatus(80000, 81000).remaining, 1000);
});

test('ordersCsv: Excel em português e proteção contra fórmulas', () => {
  const csv = ordersCsv([{ ...orders[0]!, id: 'VNA-AAAAAA', created_at: '2026-11-16T17:00:00Z', buyer_name: '=HYPERLINK("x")', buyer_email: 'a@b.com', buyer_phone: '+5592999990000' }]);
  assert.ok(csv.startsWith('﻿Pedido;'));
  const line = csv.split('\r\n')[1]!;
  assert.match(line, /^VNA-AAAAAA;2026-11-16 13:00;2026-11-16 14:00;pago;Treino A;1;12,90;Pix;InfinitePay;/);
  assert.match(line, /"'=HYPERLINK\(""x""\)"/);
  assert.match(line, /"'\+5592999990000"$/);
});
