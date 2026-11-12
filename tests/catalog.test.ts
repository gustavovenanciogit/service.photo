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

test('todas as categorias têm pelo menos um pacote ativo', () => {
  categories.forEach((c) => assert.ok(packages.some((p) => p.active && p.category === c.slug), c.slug));
});

test('FAQ: IDs únicos', () => {
  assert.equal(new Set(faq.map((f) => f.id)).size, faq.length);
});
