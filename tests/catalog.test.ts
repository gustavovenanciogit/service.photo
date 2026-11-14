import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categories } from '../src/data/categories.ts';
import { packages, isPricePublic } from '../src/data/services.ts';
import { faq } from '../src/data/faq.ts';

test('IDs de pacotes são únicos e sem espaços', () => {
  const ids = packages.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  ids.forEach((id) => assert.match(id, /^[a-z0-9-]+$/, id));
});

test('todo pacote aponta para uma categoria existente', () => {
  const slugs = new Set(categories.map((c) => c.slug));
  packages.forEach((p) => assert.ok(slugs.has(p.category), `${p.id} → ${p.category}`));
});

test('preços são números positivos ou null', () => {
  packages.forEach((p) => assert.ok(p.price === null || (Number.isFinite(p.price) && p.price > 0), p.id));
});

test('preço não confirmado nunca é público', () => {
  packages.filter((p) => !p.confirmed).forEach((p) => assert.equal(isPricePublic(p), false, p.id));
});

test('todas as categorias têm pelo menos um item ativo', () => {
  categories.forEach((c) => assert.ok(packages.some((p) => p.active && p.category === c.slug), c.slug));
});

test('FAQ: IDs únicos', () => {
  assert.equal(new Set(faq.map((f) => f.id)).size, faq.length);
});

test('formato dos valores exibidos (independe dos preços atuais)', async () => {
  const { priceText } = await import('../src/data/services.ts');
  const { formatBRL } = await import('../src/lib/whatsapp.ts');
  for (const p of packages) {
    const t = priceText(p);
    if (!p.confirmed || (p.price === null && !p.priceLabel)) assert.equal(t, null, p.id);
    else if (p.priceLabel) assert.equal(t, p.priceLabel, p.id);
    else assert.equal(t, `${formatBRL(p.price!)}${p.priceUnit ?? ''}`, p.id);
  }
  const fake = { ...packages[0]!, price: 1000, priceUnit: '/mês', priceLabel: undefined, confirmed: true };
  assert.equal(priceText(fake), 'R$ 1.000/mês');
});
