import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibrate, pairKey, pickPairs, samePhotoNegatives, type IndexedFace } from '../src/lib/face-calibration.ts';
import { normalize } from '../src/lib/faces.ts';

const vec = (seed: number, noise = 0, base?: number) =>
  normalize(Array.from({ length: 128 }, (_, i) => Math.sin((base ?? seed) * 7.13 + i * 1.7) + noise * Math.sin(seed * 3.1 + i * 2.3)));

test('par: chave independe da ordem', () => {
  assert.equal(pairKey('fx_b', 'fx_a'), pairKey('fx_a', 'fx_b'));
});

test('calibragem recomenda o limite que acha mais sem passar do máximo de confusões', () => {
  const labels = [
    ...Array.from({ length: 20 }, (_, i) => ({ s: Math.round((0.35 + i * 0.02) * 1000) / 1000, ans: 'same' as const })), // 0,35 … 0,73
    ...Array.from({ length: 20 }, (_, i) => ({ s: Math.round((0.05 + i * 0.015) * 1000) / 1000, ans: 'diff' as const })), // 0,05 … 0,335
    { s: 0.5, ans: 'unsure' as const },
  ];
  const c = calibrate(labels);
  assert.equal(c.enough, true);
  assert.equal(c.positives, 20);
  assert.equal(c.negatives, 20);
  // Nenhuma dupla diferente ≥ 0,34 → recomenda 0,34 (acha todas as 20 "mesma pessoa")
  assert.equal(c.recommended!.t, 0.34);
  assert.equal(c.recommended!.found, 1);
  assert.equal(c.recommended!.mistaken, 0);
  assert.equal(c.at(0.363).found, 19 / 20);
});

test('calibragem pede mais respostas quando há poucas', () => {
  const c = calibrate([{ s: 0.5, ans: 'same' }, { s: 0.1, ans: 'diff' }]);
  assert.equal(c.enough, false);
  assert.equal(c.recommended, null);
});

test('rostos da mesma foto viram exemplos automáticos de pessoas diferentes', () => {
  const faces: IndexedFace[] = [
    { id: 'a', p: 'p1', vec: vec(1) },
    { id: 'b', p: 'p1', vec: vec(2) },
    { id: 'c', p: 'p2', vec: vec(3) },
  ];
  const neg = samePhotoNegatives(faces);
  assert.equal(neg.length, 2); // p2 tem um rosto só
});

test('pares: nunca da mesma foto, sem repetir, concentrados perto do limite', () => {
  // 30 pessoas, cada uma em 4 fotos com pequenas variações
  const faces: IndexedFace[] = [];
  for (let person = 0; person < 30; person++)
    for (let k = 0; k < 4; k++) faces.push({ id: `f${person}_${k}`, p: `ph${person}_${k}`, vec: vec(person * 10 + k, 0.6, person) });
  const pairs = pickPairs(faces, { threshold: 0.363, count: 20, seed: 7 });
  assert.ok(pairs.length > 0 && pairs.length <= 20);
  const keys = new Set(pairs.map((p) => pairKey(p.a, p.b)));
  assert.equal(keys.size, pairs.length);
  const photoOf = new Map(faces.map((f) => [f.id, f.p]));
  for (const p of pairs) assert.notEqual(photoOf.get(p.a), photoOf.get(p.b));
  // Pares já respondidos não voltam
  const again = pickPairs(faces, { threshold: 0.363, count: 20, seed: 7, exclude: keys });
  for (const p of again) assert.ok(!keys.has(pairKey(p.a, p.b)));
  // Mesma semente → mesmos pares
  assert.deepEqual(pickPairs(faces, { threshold: 0.363, count: 20, seed: 7 }), pairs);
});
