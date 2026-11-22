import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, deltaPP, metricsAt, personGroups, personPhotos, recommendThreshold, trend, validationSetId, type Label } from '../src/lib/face-validation.ts';

const L = (s: number, ans: Label['ans'], pair = `fx_${Math.round(s * 1e6)}|fx_z${ans}`): Label => ({ e: 'evt_a', pair, s, ans });

test('métricas por par: recall, precisão e FPR com denominadores corretos', () => {
  const labels = [L(0.7, 'same'), L(0.5, 'same'), L(0.3, 'same'), L(0.4, 'diff'), L(0.2, 'diff'), L(0.1, 'diff'), L(0.6, 'unsure')];
  const m = metricsAt(labels, 0.363);
  assert.deepEqual([m.tp, m.fn, m.fp, m.tn, m.unsure], [2, 1, 1, 2, 1]);
  assert.equal(m.recall, 2 / 3); // TP/(TP+FN)
  assert.equal(m.precision, 2 / 3); // TP/(TP+FP)
  assert.equal(m.fpr, 1 / 3); // FP/(FP+TN) — todos os pares "diferentes"
  assert.equal(m.enough, false);
  const empty = metricsAt([], 0.4);
  assert.deepEqual([empty.recall, empty.precision, empty.fpr], [null, null, null]);
});

test('recomendação só com amostra suficiente; respeita o máximo de falsos positivos', () => {
  const labels = [
    ...Array.from({ length: 20 }, (_, i) => L(Math.round((0.35 + i * 0.02) * 1000) / 1000, 'same', `fx_s${i}|fx_t${i}`)),
    ...Array.from({ length: 20 }, (_, i) => L(Math.round((0.05 + i * 0.015) * 1000) / 1000, 'diff', `fx_d${i}|fx_e${i}`)),
  ];
  assert.equal(recommendThreshold(labels, 0.01), 0.34);
  assert.equal(recommendThreshold(labels.slice(0, 5), 0.01), null);
});

test('variação e tendência (cinza sem evidência)', () => {
  assert.equal(deltaPP(0.866, 0.742), 12.4);
  assert.equal(deltaPP(null, 0.5), null);
  assert.equal(trend(12.4, true, true), 'better');
  assert.equal(trend(0.6, false, true), 'worse'); // FPR subiu
  assert.equal(trend(12.4, true, false), 'unknown');
  assert.equal(trend(0, true, true), 'same');
});

test('identificador do conjunto de validação muda só quando o conjunto muda', () => {
  const a = [L(0.5, 'same', 'fx_a|fx_b'), L(0.2, 'diff', 'fx_c|fx_d')];
  assert.equal(validationSetId(a), validationSetId([...a].reverse()));
  assert.notEqual(validationSetId(a), validationSetId([L(0.5, 'diff', 'fx_a|fx_b'), a[1]!]));
});

test('pessoa de teste: verdade por foto e grupos por limiar', () => {
  // ref = fx_r (foto ph_r). Rostos em outras fotos com suas pontuações:
  const scored = [
    { id: 'fx_1', p: 'ph_1', n: 1, s: 0.8 }, // mesma pessoa
    { id: 'fx_2', p: 'ph_2', n: 2, s: 0.45 }, // mesma pessoa
    { id: 'fx_3', p: 'ph_3', n: 3, s: 0.3 }, // mesma pessoa (perdida no limiar alto)
    { id: 'fx_4', p: 'ph_4', n: 4, s: 0.42 }, // outra pessoa
    { id: 'fx_5', p: 'ph_5', n: 5, s: 0.5 }, // não verificada
    { id: 'fx_6a', p: 'ph_6', n: 6, s: 0.2 }, { id: 'fx_6b', p: 'ph_6', n: 6, s: 0.25 }, // foto com 2 rostos; o de 0,2 é a pessoa
    { id: 'fx_r2', p: 'ph_r', n: 9, s: 0.9 }, // mesma foto da referência: ignorada
  ];
  const labels = [
    { pair: 'fx_1|fx_r', ans: 'same' as const }, { pair: 'fx_2|fx_r', ans: 'same' as const }, { pair: 'fx_3|fx_r', ans: 'same' as const },
    { pair: 'fx_4|fx_r', ans: 'diff' as const }, { pair: 'fx_6a|fx_r', ans: 'same' as const },
  ];
  const photos = personPhotos('fx_r', 'ph_r', scored, labels);
  assert.equal(photos.length, 6);
  assert.equal(photos.find((p) => p.p === 'ph_6')!.truth, 'same'); // algum rosto da foto é a pessoa
  assert.equal(photos.find((p) => p.p === 'ph_6')!.s, 0.25); // a busca usa o rosto de maior pontuação
  const hi = personGroups(photos, 0.44);
  assert.deepEqual([hi.found.length, hi.missed.length, hi.others.length, hi.unverified.length], [2, 2, 0, 1]);
  assert.equal(hi.recall, 0.5);
  assert.equal(hi.precision, 1);
  const lo = personGroups(photos, 0.29);
  assert.deepEqual([lo.found.length, lo.missed.length, lo.others.length], [3, 1, 1]);
  assert.equal(lo.precision, 0.75);
  assert.equal(lo.fpr, 1);
});

test('análise: números reais e alertas de risco', () => {
  const labels = [
    ...Array.from({ length: 16 }, (_, i) => L(0.3 + i * 0.03, 'same', `fx_s${i}|fx_t${i}`)),
    ...Array.from({ length: 16 }, (_, i) => L(0.02 + i * 0.025, 'diff', `fx_d${i}|fx_e${i}`)),
  ];
  const cur = metricsAt(labels, 0.5);
  const next = metricsAt(labels, 0.35);
  const a = analyze(cur, next);
  assert.match(a.lines[0]!, /reconhece 5 pares corretos a mais/);
  assert.match(a.lines[0]!, /aceita 2 pares de pessoas diferentes a mais/);
  assert.ok(a.alerts.some((x) => x.level === 'danger' && /falsos positivos aumenta/.test(x.text)));
  const same = analyze(cur, metricsAt(labels, 0.5));
  assert.match(same.lines[0]!, /mesmo em uso/);
  const few = analyze(metricsAt(labels.slice(0, 4), 0.5), metricsAt(labels.slice(0, 4), 0.4));
  assert.ok(few.alerts.some((x) => /Amostra insuficiente/.test(x.text)));
});

test('ajuste automático: travas de amostra, segurança e passo máximo', async () => {
  const { autoTuneDecision } = await import('../src/lib/face-validation.ts');
  const mk = (same: number[], diff: number[]) => [
    ...same.map((s, i) => ({ s, ans: 'same' as const, pair: `fx_s${i}|fx_t${i}`, e: '' })),
    ...diff.map((s, i) => ({ s, ans: 'diff' as const, pair: `fx_d${i}|fx_e${i}`, e: '' })),
  ];
  // Poucas respostas: não mexe
  assert.equal(autoTuneDecision(mk([0.5], [0.1]), 0.363).apply, false);
  // Diferentes todos abaixo de 0,30 → recomendado ~0,30; limiar atual 0,45 → desce no máximo 0,03
  const many = mk(Array.from({ length: 20 }, (_, i) => 0.32 + i * 0.02), Array.from({ length: 20 }, (_, i) => 0.02 + i * 0.014));
  const d1 = autoTuneDecision(many, 0.45);
  assert.equal(d1.apply, true);
  if (d1.apply) {
    assert.equal(d1.to, 0.42);
    assert.ok(d1.target < 0.42);
    assert.ok(d1.metrics.fpr! <= 0.005);
  }
  // Limiar permissivo demais (aceita diferentes): sobe
  const risky = mk(Array.from({ length: 20 }, (_, i) => 0.5 + i * 0.01), Array.from({ length: 20 }, (_, i) => 0.1 + i * 0.02));
  const d2 = autoTuneDecision(risky, 0.3);
  assert.equal(d2.apply, true);
  if (d2.apply) assert.ok(d2.to > 0.3 && d2.to <= 0.33);
  // Já no alvo: não mexe
  if (d1.apply) assert.equal(autoTuneDecision(many, d1.target).apply, false);
});
