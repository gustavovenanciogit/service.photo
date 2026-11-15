import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_DEFAULTS, eventSlug, orderMessage, parseEvent, photoKey, photoLabel, publicState, purgeAfter, saleEndsAt, selectionPrice } from '../src/lib/events.ts';

test('parseEvent exige nome e data e aplica padrões', () => {
  assert.equal(parseEvent({ date: '2026-11-20' }).ok, false);
  assert.equal(parseEvent({ name: 'Treino' }).ok, false);
  const r = parseEvent({ name: '  Treino KOHË  ', date: '2026-11-20' });
  assert.ok(r.ok);
  assert.equal(r.value.name, 'Treino KOHË');
  assert.equal(r.value.slug, 'treino-kohe-20-11');
  assert.equal(r.value.status, 'rascunho');
  assert.equal(r.value.listed, false);
  assert.equal(r.value.price_single, EVENT_DEFAULTS.price_single);
  assert.equal(r.value.price_pack, EVENT_DEFAULTS.price_pack);
  assert.equal(r.value.sale_days, EVENT_DEFAULTS.sale_days);
});

test('parseEvent aceita preço com vírgula e rejeita valores fora da faixa', () => {
  const r = parseEvent({ name: 'X', date: '2026-01-02', price_single: '15,50', price_pack: 0, sale_days: -3, status: 'hack', slug: 'Meu Evento!' });
  assert.ok(r.ok);
  assert.equal(r.value.price_single, 15.5);
  assert.equal(r.value.price_pack, 0);
  assert.equal(r.value.sale_days, EVENT_DEFAULTS.sale_days);
  assert.equal(r.value.status, 'rascunho');
  assert.equal(r.value.slug, 'meu-evento');
});

test('eventSlug sem data', () => assert.equal(eventSlug('Corrida da Ponte'), 'corrida-da-ponte'));

test('publicState: rascunho oculto, publicado aberto até o fim da venda', () => {
  const base = { published_at: '2026-01-01T12:00:00.000Z', sale_days: 10 };
  assert.equal(publicState({ ...base, status: 'rascunho' }), 'oculto');
  assert.equal(publicState({ ...base, status: 'encerrado' }), 'encerrado');
  assert.equal(publicState({ ...base, status: 'publicado' }, new Date('2026-01-05')), 'aberto');
  assert.equal(publicState({ ...base, status: 'publicado' }, new Date('2026-01-12')), 'encerrado');
  assert.equal(saleEndsAt(base), '2026-01-11T12:00:00.000Z');
  assert.equal(purgeAfter({ ...base, download_days: 30 }), '2026-02-10T12:00:00.000Z');
  assert.equal(saleEndsAt({ published_at: '', sale_days: 10 }), '');
});

test('selectionPrice usa o pacote quando sai mais barato', () => {
  const e = { price_single: 12.9, price_pack: 119.9 };
  assert.deepEqual(selectionPrice(0, e), { total: 0, usePack: false, full: 0 });
  assert.deepEqual(selectionPrice(3, e), { total: 38.7, usePack: false, full: 38.7 });
  assert.equal(selectionPrice(10, e).total, 119.9);
  assert.equal(selectionPrice(10, e).usePack, true);
  assert.equal(selectionPrice(10, { price_single: 12.9, price_pack: 0 }).total, 129);
});

test('photoKey e photoLabel', () => {
  assert.equal(photoKey('evt_a', 'thumb', 'ph_b'), 'events/evt_a/thumb/ph_b.jpg');
  assert.equal(photoLabel(7), '#0007');
});

test('orderMessage lista fotos em ordem e o total', () => {
  const msg = orderMessage({ name: 'Treino', date: '2026-11-20', price_single: 12.9, price_pack: 119.9 }, [12, 3], 'https://x/e/treino');
  assert.match(msg, /"Treino" \(20\/11\)/);
  assert.match(msg, /Fotos \(2\): #0003, #0012/);
  assert.match(msg, /Total: R\$\s?25,80/);
  assert.match(msg, /https:\/\/x\/e\/treino/);
});
