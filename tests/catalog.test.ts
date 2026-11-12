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

test('valores transcritos da Tabela 2026 (amostra de conferência)', async () => {
  const { priceText } = await import('../src/data/services.ts');
  const byId = (id: string) => packages.find((p) => p.id === id)!;
  assert.equal(priceText(byId('foto-avulsa')), 'R$ 12,90');
  assert.equal(priceText(byId('todas-as-minhas-fotos')), 'R$ 119,90');
  assert.equal(priceText(byId('plano-mensal-assessoria')), 'R$ 1.500');
  assert.equal(priceText(byId('academia-cobertura-mensal')), 'R$ 1.000/mês');
  assert.equal(priceText(byId('plano-atleta')), 'R$ 590/mês');
  assert.equal(priceText(byId('evento-premium')), 'R$ 1.290');
  assert.equal(priceText(byId('evento-corporativo')), 'R$ 180/hora');
  assert.equal(priceText(byId('ensaio-intermediario')), 'R$ 490');
  assert.equal(priceText(byId('extra-deslocamento')), 'R$ 1,50/km');
  assert.equal(priceText(byId('extra-domingos-feriados')), '+20%');
  assert.equal(priceText(byId('extra-video-curto')), null);
});
