import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartSummary, columnsFor, distribute, orientationOf, packOffer, parseGalleryQuery, relativeHeight } from '../src/lib/gallery.ts';

test('orientação pela dimensão real', () => {
  assert.equal(orientationOf(2000, 3000), 'vertical'); // 2:3
  assert.equal(orientationOf(3000, 2000), 'horizontal'); // 3:2
  assert.equal(orientationOf(2400, 2400), 'square');
  assert.equal(orientationOf(2400, 2460), 'square'); // ~1:1 (2,4%)
  assert.equal(orientationOf(2400, 3000), 'vertical'); // 4:5
  assert.equal(orientationOf(0, 100), null);
});

test('consulta pública normalizada', () => {
  const q = parseGalleryQuery(new URLSearchParams('orient=square&order=new&offset=240&from=12'));
  assert.deepEqual(q, { orient: 'square', order: 'new', offset: 240, from: 12 });
  assert.deepEqual(parseGalleryQuery(new URLSearchParams('orient=x;DROP&order=evil&offset=-5')), { orient: 'all', order: 'asc', offset: 0, from: 0 });
});

test('pacote só é econômico quando sai mais barato que as avulsas', () => {
  const e = { price_single: 12.9, price_pack: 119.9 };
  assert.deepEqual(packOffer(e, 24), { show: true, worthFrom: 10, badge: true });
  assert.equal(packOffer(e, 5).badge, false); // evento com 5 fotos: avulsas (64,50) < pacote
  assert.equal(packOffer({ price_single: 12.9, price_pack: 0 }, 100).show, false);
  assert.equal(packOffer({ price_single: 10, price_pack: 100 }, 11).worthFrom, 11); // 10 fotos = 100 (empate, não economiza)
  assert.deepEqual(cartSummary(2, e), { total: 25.8, usePack: false, savings: 0 });
  assert.deepEqual(cartSummary(12, e), { total: 119.9, usePack: true, savings: 34.9 });
});

test('masonry: colunas por tela e distribuição equilibrada', () => {
  assert.equal(columnsFor(390), 2);
  assert.equal(columnsFor(820), 3);
  assert.equal(columnsFor(1440), 4);
  const items = [{ w: 2, h: 3 }, { w: 3, h: 2 }, { w: 1, h: 1 }, { w: 3, h: 2 }, { w: 2, h: 3 }, { w: 4, h: 5 }, { w: 3, h: 2 }, { w: 0, h: 0 }];
  const cols = distribute(items, 2);
  assert.equal(cols[0], 0);
  assert.equal(cols[1], 1);
  const heights = [0, 1].map((c) => items.reduce((s, it, i) => (cols[i] === c ? s + relativeHeight(it.w, it.h) : s), 0));
  assert.ok(Math.abs(heights[0]! - heights[1]!) < 1.6, heights.join(' x '));
  // milhares de fotos: linear e equilibrado
  const many = Array.from({ length: 5000 }, (_, i) => (i % 3 ? { w: 3, h: 2 } : { w: 2, h: 3 }));
  const t0 = Date.now();
  const c4 = distribute(many, 4);
  assert.ok(Date.now() - t0 < 200);
  const counts = [0, 1, 2, 3].map((c) => c4.filter((x) => x === c).length);
  assert.ok(Math.max(...counts) - Math.min(...counts) < 20, counts.join(','));
});
