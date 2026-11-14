import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPricingEdits, imageKind, slugify, validatePortfolio } from '../src/lib/site-content.ts';
import pricing from '../src/data/pricing.json' with { type: 'json' };
import portfolio from '../src/data/portfolio.json' with { type: 'json' };

const current = structuredClone(pricing) as { packages: Record<string, unknown>[] };
const edit = (id: string, patch: Record<string, unknown>) => {
  const p = current.packages.find((x) => x.id === id)!;
  return { id, name: p.name, description: p.description, price: p.price, duration: p.duration, delivery: p.delivery, benefits: p.benefits, highlight: p.highlight, active: p.active, ...patch };
};

test('preços: altera só campos permitidos e lista o que mudou', () => {
  const r = applyPricingEdits(current, [edit('evento-classico', { price: '720,50', category: 'hackeado', confirmed: false })]);
  const original = current.packages.find((x) => x.id === 'evento-classico')!;
  assert.ok(r.ok);
  if (!r.ok) return;
  const p = r.value.packages.find((x) => x.id === 'evento-classico')!;
  assert.equal(p.price, 720.5);
  assert.equal(p.category, original.category); // não editável
  assert.equal(p.confirmed, original.confirmed); // não editável
  assert.deepEqual(r.value.changed, [current.packages.find((x) => x.id === 'evento-classico')!.name]);
  assert.equal(r.value.packages.length, current.packages.length);
});

test('preços: sem alteração, nada muda', () => {
  const r = applyPricingEdits(current, [edit('evento-classico', {})]);
  assert.ok(r.ok && r.value.changed.length === 0);
  if (r.ok) assert.deepEqual(r.value.packages, current.packages);
});

test('preços: rejeita pacote desconhecido, nome vazio e preço inválido', () => {
  assert.equal(applyPricingEdits(current, [{ id: 'novo-pacote', name: 'X' }]).ok, false);
  assert.equal(applyPricingEdits(current, [edit('evento-classico', { name: '  ' })]).ok, false);
  assert.equal(applyPricingEdits(current, [edit('evento-classico', { price: -1 })]).ok, false);
  assert.equal(applyPricingEdits(current, [edit('evento-classico', { price: 'abc' })]).ok, false);
  assert.equal(applyPricingEdits(current, 'x').ok, false);
});

test('preços: percentuais (+20%) não viram valor em reais', () => {
  const r = applyPricingEdits(current, [edit('extra-domingos-feriados', { price: 999 })]);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.packages.find((x) => x.id === 'extra-domingos-feriados')!.price, null);
});

test('preços: pausar pacote e limpar destaque', () => {
  const r = applyPricingEdits(current, [edit('evento-classico', { active: false, highlight: '' })]);
  assert.ok(r.ok);
  if (!r.ok) return;
  const p = r.value.packages.find((x) => x.id === 'evento-classico')!;
  assert.equal(p.active, false);
  assert.equal('highlight' in p, false);
});

const files = new Set(portfolio.photos.map((p) => p.file));

test('portfólio: valida fotos, ignora caminhos perigosos e exige 3 no mosaico', () => {
  const r = validatePortfolio(
    { photos: [...portfolio.photos, { file: '../../worker/index.ts', caption: 'x' }, { file: 'esportes/nao-existe.jpg', caption: 'x' }], hero: portfolio.hero },
    files,
  );
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.photos.length, portfolio.photos.length);
  assert.equal(validatePortfolio({ photos: portfolio.photos, hero: portfolio.hero.slice(0, 2) }, files).ok, false);
  const hidden = portfolio.photos.map((p) => (p.file === portfolio.hero[0]!.file ? { ...p, hidden: true } : p));
  assert.equal(validatePortfolio({ photos: hidden, hero: portfolio.hero }, files).ok, false);
});

test('tipo real da imagem e nome de arquivo', () => {
  assert.equal(imageKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'jpg');
  assert.equal(imageKind(new TextEncoder().encode('<svg onload=alert(1)>')), null);
  assert.equal(slugify('Corrida na Ponta Negra! 2026'), 'corrida-na-ponta-negra-2026');
  assert.equal(slugify('???'), 'foto');
});
