import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  buildPreference, canDownload, checkPayment, deliveryMessage, downloadName, downloadUntil, effectiveStatus,
  mapPaymentStatus, orderCode, orderToken, parseCheckout, pickPayment, TOKEN_RE, verifyMpSignature,
} from '../src/lib/orders.ts';

const valid = { slug: 'treino-kohe', photo_ids: ['ph_abc1234', 'ph_abc1234', 'ph_def5678'], name: 'Ana Souza', email: 'Ana@Mail.com ', phone: '(92) 99999-0000', accept: true };

test('parseCheckout valida e normaliza', () => {
  const r = parseCheckout(valid, 500);
  assert.ok(r.ok);
  assert.deepEqual(r.value.photo_ids, ['ph_abc1234', 'ph_def5678']);
  assert.equal(r.value.email, 'ana@mail.com');
  assert.equal(parseCheckout({ ...valid, accept: false }, 500).ok, false);
  assert.equal(parseCheckout({ ...valid, email: 'x@' }, 500).ok, false);
  assert.equal(parseCheckout({ ...valid, phone: '9999' }, 500).ok, false);
  assert.equal(parseCheckout({ ...valid, photo_ids: ['../../x'] }, 500).ok, false);
  assert.equal(parseCheckout({ ...valid, slug: 'A B' }, 500).ok, false);
  assert.equal(parseCheckout(valid, 1).ok, false);
});

test('códigos e tokens', () => {
  assert.match(orderCode(), /^VNA-[2-9A-HJ-NP-Z]{6}$/);
  const t = orderToken();
  assert.match(t, TOKEN_RE);
  assert.notEqual(t, orderToken());
});

test('mapPaymentStatus', () => {
  assert.equal(mapPaymentStatus('approved'), 'pago');
  assert.equal(mapPaymentStatus('pending'), 'pendente');
  assert.equal(mapPaymentStatus('in_process'), 'pendente');
  assert.equal(mapPaymentStatus('rejected'), 'recusado');
  assert.equal(mapPaymentStatus('refunded'), 'reembolsado');
  assert.equal(mapPaymentStatus('charged_back'), 'reembolsado');
});

test('checkPayment confere pedido, moeda e valor', () => {
  const o = { id: 'VNA-AAAAAA', total: 38.7 };
  const p = { id: 1, status: 'approved', external_reference: 'VNA-AAAAAA', transaction_amount: 38.7, currency_id: 'BRL' };
  assert.equal(checkPayment(o, p), 'pago');
  assert.equal(checkPayment(o, { ...p, transaction_amount: 1 }), 'divergente');
  assert.equal(checkPayment(o, { ...p, currency_id: 'USD' }), 'divergente');
  assert.equal(checkPayment(o, { ...p, external_reference: 'VNA-BBBBBB' }), 'divergente');
  assert.equal(checkPayment(o, { ...p, status: 'pending', transaction_amount: 1 }), 'pendente');
});

test('pickPayment prefere o aprovado', () => {
  const ps = [
    { id: 1, status: 'rejected', date_created: '2026-11-15T10:00:00Z' },
    { id: 2, status: 'approved', date_created: '2026-11-15T09:00:00Z' },
    { id: 3, status: 'pending', date_created: '2026-11-15T11:00:00Z' },
  ];
  assert.equal(pickPayment(ps)!.id, 2);
  assert.equal(pickPayment([ps[0]!, ps[2]!])!.id, 3);
  assert.equal(pickPayment([]), undefined);
});

test('expiração e download', () => {
  const created = '2026-11-15T00:00:00.000Z';
  assert.equal(effectiveStatus({ status: 'pendente', created_at: created }, 24, new Date('2026-11-15T23:00:00Z')), 'pendente');
  assert.equal(effectiveStatus({ status: 'pendente', created_at: created }, 24, new Date('2026-11-16T01:00:00Z')), 'expirado');
  assert.equal(effectiveStatus({ status: 'pago', created_at: created }, 24, new Date('2027-01-01')), 'pago');
  const until = downloadUntil(created, 30);
  assert.equal(until, '2026-12-15T00:00:00.000Z');
  assert.equal(canDownload({ status: 'pago', download_until: until }, new Date('2026-12-01')), true);
  assert.equal(canDownload({ status: 'pago', download_until: until }, new Date('2026-12-16')), false);
  assert.equal(canDownload({ status: 'reembolsado', download_until: until }, new Date('2026-12-01')), false);
  assert.equal(downloadName('corrida-da-ponte', 7), 'venart-corrida-da-ponte-0007.jpg');
});

test('buildPreference: valor do servidor, referência e retorno', () => {
  const pref = buildPreference(
    { id: 'VNA-AAAAAA', token: 'T'.repeat(43), total: 99.9, photo_count: 9, buyer_name: 'Ana Maria Souza', buyer_email: 'a@b.com', created_at: '2026-11-15T00:00:00.000Z' },
    { name: 'Treino' },
    'https://site',
    { maxInstallments: 1, pendingHours: 24, statementDescriptor: 'VENART' },
  );
  assert.equal(pref.items[0]!.unit_price, 99.9);
  assert.equal(pref.external_reference, 'VNA-AAAAAA');
  assert.equal(pref.back_urls.success, `https://site/pedido/${'T'.repeat(43)}`);
  assert.equal(pref.notification_url, 'https://site/api/webhooks/mercadopago');
  assert.equal(pref.payer.surname, 'Maria Souza');
  assert.equal(pref.expiration_date_to, '2026-11-16T00:00:00.000Z');
});

test('verifyMpSignature confere a assinatura do Mercado Pago', async () => {
  const secret = 'segredo';
  const manifest = 'id:123456;request-id:req-1;ts:1700000000;';
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
  assert.equal(await verifyMpSignature(`ts=1700000000,v1=${v1}`, 'req-1', '123456', secret), true);
  assert.equal(await verifyMpSignature(`ts=1700000001,v1=${v1}`, 'req-1', '123456', secret), false);
  assert.equal(await verifyMpSignature(`ts=1700000000,v1=${v1}`, 'req-1', '999', secret), false);
  assert.equal(await verifyMpSignature('lixo', 'req-1', '123456', secret), false);
});

test('deliveryMessage', () => {
  const m = deliveryMessage({ buyer_name: 'Ana Souza', event_name: 'Treino', download_until: '2026-12-15T12:00:00Z' }, 'https://x/pedido/abc');
  assert.match(m, /Oi, Ana!/);
  assert.match(m, /até 15\/12\/2026/);
});
