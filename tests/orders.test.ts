import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  buildPreference, canDownload, checkPayment, deliveryMessage, downloadName, downloadUntil, effectiveStatus,
  mapPaymentStatus, orderCode, orderToken, parseCheckout, paymentFinancials, pickPayment, TOKEN_RE, verifyMpSignature,
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
  assert.deepEqual(pref.payment_methods.excluded_payment_types, [{ id: 'ticket' }]); // sem boleto
});

test('paymentFinancials: tarifa, líquido e liberação informados pelo Mercado Pago', () => {
  const pix = paymentFinancials({ id: 1, status: 'approved', transaction_amount: 12.9, fee_details: [{ type: 'mercadopago_fee', amount: 0.13, fee_payer: 'collector' }], transaction_details: { net_received_amount: 12.77 }, money_release_date: '2026-11-17T10:00:00.000-04:00' });
  assert.deepEqual(pix, { fee: 0.13, net: 12.77, release: '2026-11-17T14:00:00.000Z' });
  // cartão com liberação em 30 dias; juros pagos pelo cliente não entram na sua tarifa
  const card = paymentFinancials({ id: 2, status: 'approved', transaction_amount: 119.9, fee_details: [{ type: 'mercadopago_fee', amount: 3.95, fee_payer: 'collector' }, { type: 'financing_fee', amount: 9.1, fee_payer: 'payer' }], money_release_date: '2026-12-17T10:00:00Z' });
  assert.deepEqual(card, { fee: 3.95, net: 115.95, release: '2026-12-17T10:00:00.000Z' });
  // pendente: ainda sem dados
  assert.deepEqual(paymentFinancials({ id: 3, status: 'pending', transaction_amount: 12.9 }), { fee: 0, net: 0, release: '' });
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

import { buildCardPayment, buildPixPayment, cardMessage, mpDate, parseCardInput, PIX_MINUTES } from '../src/lib/orders.ts';

const ord = { id: 'VNA-AAAAAA', total: 38.7, photo_count: 3, buyer_name: 'Ana Maria Souza', buyer_email: 'ana@b.com', event_name: 'Treino' };

test('mpDate no horário de Manaus', () => {
  assert.equal(mpDate(Date.parse('2026-11-17T19:30:00Z')), '2026-11-17T15:30:00.000-04:00');
});

test('Pix transparente: valor do pedido, referência e validade', () => {
  const p = buildPixPayment(ord, 'https://site', Date.parse('2026-11-17T19:00:00Z'));
  assert.equal(p.transaction_amount, 38.7);
  assert.equal(p.payment_method_id, 'pix');
  assert.equal(p.external_reference, 'VNA-AAAAAA');
  assert.equal(p.notification_url, 'https://site/api/webhooks/mercadopago');
  assert.equal(p.date_of_expiration, '2026-11-17T15:30:00.000-04:00');
  assert.equal(PIX_MINUTES, 30);
  assert.deepEqual(p.payer, { email: 'ana@b.com', first_name: 'Ana', last_name: 'Maria Souza' });
});

test('cartão: valida o que vem do formulário seguro e monta o pagamento', () => {
  const body = { token: 'ff8080814c11e237014c1ff593b57b4d', payment_method_id: 'master', issuer_id: '24', installments: 1, payer: { email: 'Ana@B.com', identification: { type: 'CPF', number: '123.456.789-09' } }, transaction_amount: 0.01 };
  const c = parseCardInput(body, 1);
  assert.ok(c.ok);
  const pay = buildCardPayment(ord, c.value, 'https://site', 'VENART');
  assert.equal(pay.transaction_amount, 38.7); // ignora o valor enviado pelo navegador
  assert.equal(pay.binary_mode, true);
  assert.equal(pay.issuer_id, 24);
  assert.deepEqual(pay.payer.identification, { type: 'CPF', number: '12345678909' });
  assert.equal(parseCardInput({ ...body, installments: 3 }, 1).ok, false);
  assert.equal(parseCardInput({ ...body, token: '<script>' }, 1).ok, false);
  assert.equal(parseCardInput({ ...body, payer: { email: 'a@b.com', identification: { type: 'CPF', number: '123' } } }, 1).ok, false);
  assert.equal(parseCardInput({ ...body, cardNumber: '4111111111111111' }, 1).ok, true); // campos extras são ignorados (nunca usados)
});

test('mensagens de recusa do cartão', () => {
  assert.match(cardMessage('rejected', 'cc_rejected_insufficient_amount'), /Limite insuficiente/);
  assert.match(cardMessage('rejected', 'xyz'), /recusado/);
  assert.match(cardMessage('approved', 'accredited'), /aprovado/);
});
