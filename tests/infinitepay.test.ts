import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInfiniteLink, checkInfinite, infiniteMethod, infinitePhone, linkUrl, parseInfiniteRef, toCents } from '../src/lib/infinitepay.ts';

test('toCents sem erro de arredondamento', () => {
  assert.equal(toCents(12.9), 1290);
  assert.equal(toCents(119.9), 11990);
  assert.equal(toCents(0.1 + 0.2), 30);
});

test('buildInfiniteLink usa o valor do pedido em centavos', () => {
  const b = buildInfiniteLink({ id: 'VNA-AAAAAA', token: 'T'.repeat(43), total: 38.7, photo_count: 3, buyer_name: 'Ana', buyer_email: 'a@b.com' }, { name: 'Treino' }, 'https://site', 'venart');
  assert.equal(b.handle, 'venart');
  assert.equal(b.items[0]!.price, 3870);
  assert.equal(b.order_nsu, 'VNA-AAAAAA');
  assert.equal(b.redirect_url, `https://site/pedido/${'T'.repeat(43)}`);
  assert.equal(b.webhook_url, 'https://site/api/webhooks/infinitepay');
  assert.match(b.items[0]!.description, /3 fotos/);
  assert.equal('phone_number' in b.customer, false);
  const withPhone = buildInfiniteLink({ id: 'VNA-AAAAAA', token: 'T'.repeat(43), total: 12.9, photo_count: 1, buyer_name: 'Ana', buyer_email: 'a@b.com', buyer_phone: '(92) 98888-0000' }, { name: 'X' }, 'https://site', 'venart');
  assert.deepEqual(withPhone.customer, { name: 'Ana', email: 'a@b.com', phone_number: '+5592988880000' });
});

test('telefone do comprador no formato da InfinitePay', () => {
  assert.equal(infinitePhone('(92) 98888-0000'), '+5592988880000');
  assert.equal(infinitePhone('92 3234-5678'), '+559232345678');
  assert.equal(infinitePhone('+55 92 98888-0000'), '+5592988880000');
  assert.equal(infinitePhone('123'), '');
});

test('linkUrl aceita url ou checkout_url, só https', () => {
  assert.equal(linkUrl({ url: 'https://checkout.infinitepay.io/x' }), 'https://checkout.infinitepay.io/x');
  assert.equal(linkUrl({ checkout_url: 'https://y' }), 'https://y');
  assert.equal(linkUrl({ url: 'javascript:alert(1)' }), '');
  assert.equal(linkUrl({}), '');
});

test('parseInfiniteRef valida os campos', () => {
  assert.deepEqual(parseInfiniteRef({ order_nsu: 'VNA-AAAAAA', transaction_nsu: 'abc-123', invoice_slug: 'xyz' }), { order_nsu: 'VNA-AAAAAA', transaction_nsu: 'abc-123', slug: 'xyz' });
  assert.deepEqual(parseInfiniteRef({ order_nsu: 'VNA-AAAAAA', transaction_nsu: 'abc', slug: 's1' })?.slug, 's1');
  assert.equal(parseInfiniteRef({ order_nsu: 'X', transaction_nsu: 'a', slug: 'b' }), null);
  assert.equal(parseInfiniteRef({ order_nsu: 'VNA-AAAAAA', transaction_nsu: 'a b', slug: 'b' }), null);
  assert.equal(parseInfiniteRef({ order_nsu: 'VNA-AAAAAA', transaction_nsu: 'a' }), null);
});

test('checkInfinite exige pago E valor certo', () => {
  const o = { total: 38.7 };
  assert.equal(checkInfinite(o, { success: true, paid: true, amount: 3870 }), 'pago');
  assert.equal(checkInfinite(o, { success: true, paid: true, amount: 38.7 }), 'pago');
  assert.equal(checkInfinite(o, { success: true, paid: true, amount: 3870, paid_amount: 4100 }), 'pago');
  assert.equal(checkInfinite(o, { success: true, paid: true, amount: 100 }), 'divergente');
  assert.equal(checkInfinite(o, { success: true, paid: false, amount: 3870 }), 'pendente');
  assert.equal(checkInfinite(o, { success: false }), 'pendente');
  assert.equal(infiniteMethod('pix'), 'pix');
});

test('PAYMENT_PROVIDER aceita variações de escrita', async () => {
  const { preferred, provider } = await import('../worker/payments.ts');
  for (const v of ['mercadopago', ' mercadopago ', 'Mercado Pago', '"mercadopago"', 'MP', 'mercadopago\n']) assert.equal(preferred(v), 'mercadopago', JSON.stringify(v));
  assert.equal(preferred('InfinitePay'), 'infinitepay');
  assert.equal(preferred('outro'), null);
  const env = { INFINITEPAY_HANDLE: 'venart', MP_ACCESS_TOKEN: 'APP_USR-x' };
  assert.equal(provider(env), 'infinitepay');
  assert.equal(provider({ ...env, PAYMENT_PROVIDER: 'Mercado Pago ' }), 'mercadopago');
  assert.equal(provider({ ...env, PAYMENT_PROVIDER: 'mercadopago', MP_ACCESS_TOKEN: ' ' }), 'infinitepay');
});
