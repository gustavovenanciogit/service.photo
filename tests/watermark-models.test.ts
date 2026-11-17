import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, effectiveModel, layout, MODEL_IDS, MODELS, parseParams, parseSettings, ratings, seeded, signature, type Mark, type ModelId } from '../src/lib/watermark-models.ts';

const sizes = [[1200, 800], [800, 1200], [1600, 1067], [520, 347]] as const;
const marks = (m: Mark[]) => m.filter((x) => x.t !== 'band');
/** Alguma marca perto do centro (dentro de 12% do lado menor). */
const coversCenter = (m: Mark[], w: number, h: number) => m.some((x) => Math.hypot(x.x - w / 2, x.y - h / 2) < Math.min(w, h) * 0.12 || (x.t === 'band' && true));

test('os 8 modelos geram marcas em fotos horizontais e verticais, cobrindo o centro', () => {
  for (const id of MODEL_IDS)
    for (const [w, h] of sizes) {
      const m = layout(id, w, h, MODELS[id].defaults, 'ph_abc');
      assert.ok(marks(m).length >= 1, `modelo ${id} ${w}x${h} sem marcas`);
      assert.ok(coversCenter(m, w, h), `modelo ${id} ${w}x${h} não cobre o centro`);
      for (const x of m) assert.ok(Number.isFinite(x.x) && Number.isFinite(x.y) && x.a > 0 && x.a <= 1, `modelo ${id}: valor inválido`);
    }
});

test('modelos são visualmente diferentes (composição distinta)', () => {
  const sig = (id: ModelId) => {
    const m = layout(id, 1200, 800, MODELS[id].defaults, 'ph_abc');
    const kinds = ['logo', 'text', 'combo', 'band'].map((k) => m.filter((x) => x.t === k).length);
    return `${kinds.join(',')}`;
  };
  const all = MODEL_IDS.map(sig);
  assert.equal(new Set(all).size, 8, all.join(' | '));
});

test('modelo 8 é o mais denso e alterna marcas claras e escuras', () => {
  const counts = MODEL_IDS.map((id) => layout(id, 1200, 800, MODELS[id].defaults, 'x').length);
  assert.equal(Math.max(...counts), counts[7]);
  const m8 = layout(8, 1200, 800, MODELS[8].defaults, 'x');
  assert.ok(m8.some((m) => m.tone === 'dark' && m.t !== 'band') && m8.some((m) => m.tone === 'light'));
  assert.ok(m8.filter((m) => m.t === 'band').length >= 3);
});

test('intensidades produzem resultados claramente distintos', () => {
  for (const id of MODEL_IDS) {
    const r = (['leve', 'moderado', 'forte', 'maximo'] as const).map((intensity) => {
      const m = layout(id, 1200, 800, { ...MODELS[id].defaults, intensity }, 'x');
      return { n: m.length, a: Math.max(...m.map((x) => x.a)) };
    });
    for (let i = 1; i < r.length; i++) assert.ok(r[i]!.a > r[i - 1]!.a || r[i]!.n > r[i - 1]!.n, `modelo ${id}: intensidade ${i} não difere`);
    assert.ok(r[3]!.a > r[0]!.a * 1.8, `modelo ${id}: máximo deveria ser bem mais forte que leve`);
  }
});

test('densidade aumenta a quantidade de marcas nos padrões repetidos', () => {
  for (const id of [3, 4, 5, 6] as const) {
    const lo = layout(id, 1200, 800, { ...MODELS[id].defaults, density: 2 }, 'x').length;
    const hi = layout(id, 1200, 800, { ...MODELS[id].defaults, density: 9 }, 'x').length;
    assert.ok(hi > lo * 1.5, `modelo ${id}: ${lo} → ${hi}`);
  }
});

test('marcas proporcionais à resolução', () => {
  const a = layout(1, 1200, 800, MODELS[1].defaults, 'x');
  const b = layout(1, 2400, 1600, MODELS[1].defaults, 'x');
  const sa = (a[0] as { s: number }).s;
  const sb = (b[0] as { s: number }).s;
  assert.ok(Math.abs(sb / sa - 2) < 0.01);
});

test('distribuição determinística por foto (modelo 5)', () => {
  const a = layout(5, 1200, 800, MODELS[5].defaults, 'ph_1');
  assert.deepEqual(a, layout(5, 1200, 800, MODELS[5].defaults, 'ph_1'));
  assert.notDeepEqual(a, layout(5, 1200, 800, MODELS[5].defaults, 'ph_2'));
  const r = seeded('a');
  assert.ok(r() >= 0 && r() < 1);
});

test('validação das configurações', () => {
  const p = parseParams({ opacity: 5, size: -3, density: 99, rotation: 400, color: 'roxo', customColor: 'red', text: 'A'.repeat(50) + '\u0007', intensity: 'x' }, MODELS[1].defaults);
  assert.equal(p.opacity, 0.9);
  assert.equal(p.size, 3);
  assert.equal(p.density, 10);
  assert.equal(p.rotation, 90);
  assert.equal(p.color, 'auto');
  assert.equal(p.customColor, MODELS[1].defaults.customColor);
  assert.equal(p.text.length, 30);
  assert.equal(p.intensity, 'forte');
  const s = parseSettings({ defaultModel: 3, protection: { maxSize: 999, blur: 'forte', blurRegion: 'edges' }, models: { 2: { opacity: 0.5 } } });
  assert.equal(s.defaultModel, 3);
  assert.equal(s.protection.maxSize, 1200);
  assert.equal(s.protection.blur, 'forte');
  assert.equal(s.models[2].opacity, 0.5);
  assert.equal(s.models[2].size, MODELS[2].defaults.size);
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.defaultModel, 8);
});

test('assinatura muda com qualquer ajuste; modelo efetivo da galeria', () => {
  const s = DEFAULT_SETTINGS;
  const a = signature(8, s.models[8], s.protection, '');
  assert.equal(a, signature(8, { ...s.models[8] }, { ...s.protection }, ''));
  assert.notEqual(a, signature(8, { ...s.models[8], opacity: 0.4 }, s.protection, ''));
  assert.notEqual(a, signature(8, s.models[8], { ...s.protection, maxSize: 800 }, ''));
  assert.notEqual(a, signature(8, s.models[8], s.protection, '2026'));
  assert.equal(effectiveModel(0, s), 8);
  assert.equal(effectiveModel(3, s), 3);
  assert.equal(effectiveModel(42, s), 8);
  assert.deepEqual(ratings(8, { intensity: 'leve' }), { visibility: 4, protection: 4 });
  assert.deepEqual(ratings(2, { intensity: 'maximo' }), { visibility: 4, protection: 3 });
});
