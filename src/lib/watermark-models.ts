/**
 * MARCA D'ÁGUA — 8 MODELOS (motor de composição)
 * ------------------------------------------------------------------
 * Este arquivo define os modelos, os parâmetros e o "layout" (onde cada marca vai).
 * O desenho é feito por renderWatermark() num <canvas>, e o resultado vira os PIXELS da prévia
 * (nunca é uma camada CSS por cima da foto). O editor do painel e o envio das fotos usam
 * exatamente esta mesma função: a prévia do editor é igual ao que é publicado.
 *
 * As classificações de "visibilidade" e "proteção" são RELATIVAS entre os modelos, para orientar
 * a escolha — não são medidas de segurança. Nenhuma marca impede print de tela ou remoção por IA.
 */

export const MODEL_IDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type ModelId = (typeof MODEL_IDS)[number];

export type Intensity = 'leve' | 'moderado' | 'forte' | 'maximo';
export type ColorMode = 'auto' | 'white' | 'black' | 'custom';

export interface ModelParams {
  opacity: number; // 0.05–0.9
  size: number; // % do lado menor da foto (tamanho da marca principal)
  density: number; // 1–10 (quantidade de marcas)
  spacing: number; // % do lado menor (distância entre repetições)
  rotation: number; // graus (-90 a 90)
  offsetX: number; // % da largura (-25 a 25) — desloca o padrão
  offsetY: number; // % da altura (-25 a 25)
  thickness: number; // % do lado menor (espessura das faixas, modelos 7 e 8)
  color: ColorMode;
  customColor: string; // #rrggbb
  text: string; // nome da marca
  useLogo: boolean; // usar o símbolo/logotipo além do texto
  intensity: Intensity;
}

export interface ProtectionSettings {
  maxSize: 800 | 1200 | 1600; // maior lado da prévia pública (px)
  blur: 'none' | 'leve' | 'moderado' | 'forte';
  blurRegion: 'all' | 'edges'; // toda a foto ou só as bordas (centro nítido)
}

export interface WatermarkSettings {
  defaultModel: ModelId;
  models: Record<ModelId, ModelParams>;
  protection: ProtectionSettings;
  logoVersion: string; // '' = símbolo padrão da Venart; senão, data do envio do logotipo
}

const base: ModelParams = {
  opacity: 0.35,
  size: 12,
  density: 5,
  spacing: 26,
  rotation: -30,
  offsetX: 0,
  offsetY: 0,
  thickness: 11,
  color: 'auto',
  customColor: '#8BE07A',
  text: 'VENART',
  useLogo: true,
  intensity: 'forte',
};

export const MODELS: Record<ModelId, { name: string; description: string; visibility: number; protection: number; defaults: ModelParams; uses: (keyof ModelParams)[] }> = {
  1: { name: 'Logotipos grandes', description: 'Logotipos grandes e semitransparentes espalhados por várias regiões da foto.', visibility: 4, protection: 3, defaults: { ...base, size: 30, density: 5, opacity: 0.4, rotation: 0 }, uses: ['opacity', 'size', 'density', 'rotation', 'offsetX', 'offsetY'] },
  2: { name: 'Central + repetições', description: 'Uma marca central e pequenas repetições em pontos estratégicos.', visibility: 3, protection: 2, defaults: { ...base, size: 34, density: 5, opacity: 0.42, rotation: 0 }, uses: ['opacity', 'size', 'density', 'rotation', 'offsetX', 'offsetY'] },
  3: { name: 'Grade de logotipos', description: 'Grade organizada de marcas cobrindo a foto inteira, inclusive o centro.', visibility: 3, protection: 4, defaults: { ...base, size: 10, spacing: 24, density: 5, opacity: 0.4, rotation: 0 }, uses: ['opacity', 'size', 'density', 'spacing', 'rotation', 'offsetX', 'offsetY'] },
  4: { name: 'Padrão diagonal', description: 'Logotipo + nome repetidos em linhas diagonais contínuas.', visibility: 3, protection: 4, defaults: { ...base, size: 8, spacing: 18, density: 5, opacity: 0.44, rotation: -30 }, uses: ['opacity', 'size', 'density', 'spacing', 'rotation', 'offsetX', 'offsetY'] },
  5: { name: 'Marcas distribuídas', description: 'Símbolos e nomes espalhados sem grade regular, com tamanhos e ângulos variados (sempre iguais para a mesma foto).', visibility: 3, protection: 4, defaults: { ...base, size: 9, spacing: 22, density: 6, opacity: 0.44, rotation: 0 }, uses: ['opacity', 'size', 'density', 'spacing', 'rotation'] },
  6: { name: 'Logotipos e textos', description: 'Símbolo e nome intercalados por toda a foto, em dois níveis de transparência.', visibility: 4, protection: 4, defaults: { ...base, size: 9, spacing: 20, density: 6, opacity: 0.46, rotation: -15 }, uses: ['opacity', 'size', 'density', 'spacing', 'rotation', 'offsetX', 'offsetY'] },
  7: { name: 'Faixas cruzadas', description: 'Duas faixas semitransparentes em X atravessando o centro, com nome e símbolo.', visibility: 4, protection: 3, defaults: { ...base, size: 8, density: 5, opacity: 0.46, rotation: 32, thickness: 12 }, uses: ['opacity', 'size', 'density', 'rotation', 'thickness', 'offsetX', 'offsetY'] },
  8: { name: 'Proteção intensa', description: 'O mais forte: padrão diagonal denso, faixa central, faixas cruzadas, logotipo grande e marcas claras e escuras alternadas.', visibility: 5, protection: 5, defaults: { ...base, size: 26, spacing: 16, density: 6, opacity: 0.5, rotation: -30, thickness: 10 }, uses: ['opacity', 'size', 'density', 'spacing', 'rotation', 'thickness', 'offsetX', 'offsetY'] },
};

/** Presets de intensidade: multiplicam opacidade e quantidade de marcas. */
export const INTENSITY: Record<Intensity, { label: string; alpha: number; density: number; delta: number }> = {
  leve: { label: 'Leve', alpha: 0.6, density: 0.65, delta: -1 },
  moderado: { label: 'Moderado', alpha: 0.82, density: 0.85, delta: 0 },
  forte: { label: 'Forte', alpha: 1, density: 1, delta: 0 },
  maximo: { label: 'Máximo', alpha: 1.3, density: 1.4, delta: 1 },
};

/** Classificação relativa (1–5) exibida nos cartões, já considerando a intensidade escolhida. */
export const ratings = (id: ModelId, p: Pick<ModelParams, 'intensity'>) => {
  const d = INTENSITY[p.intensity].delta;
  const c = (n: number) => Math.max(1, Math.min(5, n + d));
  return { visibility: c(MODELS[id].visibility), protection: c(MODELS[id].protection) };
};

export const DEFAULT_SETTINGS: WatermarkSettings = {
  defaultModel: 8,
  models: Object.fromEntries(MODEL_IDS.map((id) => [id, { ...MODELS[id].defaults }])) as Record<ModelId, ModelParams>,
  protection: { maxSize: 1200, blur: 'none', blurRegion: 'all' },
  logoVersion: '',
};

// ───────── Validação (servidor e painel usam a mesma) ─────────

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
export const isModelId = (v: unknown): v is ModelId => MODEL_IDS.includes(Number(v) as ModelId);

export function parseParams(input: unknown, fallback: ModelParams): ModelParams {
  const o = (input ?? {}) as Record<string, unknown>;
  const text = typeof o.text === 'string' ? o.text.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 30) : fallback.text;
  return {
    opacity: Math.round(clamp(o.opacity, 0.05, 0.9, fallback.opacity) * 100) / 100,
    size: Math.round(clamp(o.size, 3, 60, fallback.size)),
    density: Math.round(clamp(o.density, 1, 10, fallback.density)),
    spacing: Math.round(clamp(o.spacing, 8, 60, fallback.spacing)),
    rotation: Math.round(clamp(o.rotation, -90, 90, fallback.rotation)),
    offsetX: Math.round(clamp(o.offsetX, -25, 25, fallback.offsetX)),
    offsetY: Math.round(clamp(o.offsetY, -25, 25, fallback.offsetY)),
    thickness: Math.round(clamp(o.thickness, 3, 30, fallback.thickness)),
    color: oneOf(o.color, ['auto', 'white', 'black', 'custom'] as const, fallback.color),
    customColor: typeof o.customColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.customColor) ? o.customColor : fallback.customColor,
    text,
    useLogo: typeof o.useLogo === 'boolean' ? o.useLogo : fallback.useLogo,
    intensity: oneOf(o.intensity, ['leve', 'moderado', 'forte', 'maximo'] as const, fallback.intensity),
  };
}

export function parseSettings(input: unknown): WatermarkSettings {
  const o = (input ?? {}) as Record<string, unknown>;
  const models = (o.models ?? {}) as Record<string, unknown>;
  const p = (o.protection ?? {}) as Record<string, unknown>;
  return {
    defaultModel: isModelId(o.defaultModel) ? (Number(o.defaultModel) as ModelId) : DEFAULT_SETTINGS.defaultModel,
    models: Object.fromEntries(MODEL_IDS.map((id) => [id, parseParams(models[id], MODELS[id].defaults)])) as Record<ModelId, ModelParams>,
    protection: {
      maxSize: ([800, 1200, 1600] as const).find((s) => s === Number(p.maxSize)) ?? DEFAULT_SETTINGS.protection.maxSize,
      blur: oneOf(p.blur, ['none', 'leve', 'moderado', 'forte'] as const, 'none'),
      blurRegion: oneOf(p.blurRegion, ['all', 'edges'] as const, 'all'),
    },
    logoVersion: typeof o.logoVersion === 'string' ? o.logoVersion.slice(0, 40) : '',
  };
}

/** Assinatura curta da configuração usada numa foto (para saber quais precisam ser refeitas). */
export function signature(model: ModelId, params: ModelParams, protection: ProtectionSettings, logoVersion: string) {
  const s = JSON.stringify([model, params, protection, logoVersion, 2]);
  let h1 = 0x811c9dc5;
  let h2 = 0;
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 0x01000193) >>> 0;
    h2 = (h2 * 31 + s.charCodeAt(i)) >>> 0;
  }
  return `w${model}-${h1.toString(36)}${h2.toString(36)}`;
}

/** Modelo efetivo de uma galeria (0 = padrão). */
export const effectiveModel = (eventModel: number, s: WatermarkSettings): ModelId => (isModelId(eventModel) && eventModel ? (eventModel as ModelId) : s.defaultModel);

// ───────── Layout (onde cada marca vai) ─────────

export type Tone = 'light' | 'dark';
export type Mark =
  | { t: 'logo' | 'text' | 'combo'; x: number; y: number; s: number; r: number; a: number; tone: Tone }
  | { t: 'band'; x: number; y: number; len: number; thick: number; r: number; a: number; tone: Tone };

/** Gerador pseudoaleatório determinístico (mesma foto → mesmas posições). */
export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rad = (deg: number) => (deg * Math.PI) / 180;
/** Fator da densidade: 1 = padrão; maior densidade → marcas mais próximas. */
const densityScale = (d: number) => Math.min(1.5, Math.max(0.45, 1.5 - d * 0.1));

/**
 * Repete um elemento ao longo de linhas inclinadas cobrindo toda a foto.
 * stepAlong: distância entre repetições na linha; stepAcross: distância entre linhas.
 */
function rows(w: number, h: number, cx: number, cy: number, angle: number, stepAlong: number, stepAcross: number, make: (x: number, y: number, row: number, col: number) => Mark | null, stagger = true) {
  const out: Mark[] = [];
  const reach = Math.hypot(w, h) / 2 + Math.max(stepAlong, stepAcross);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const nRows = Math.ceil(reach / stepAcross);
  const nCols = Math.ceil(reach / stepAlong);
  const margin = Math.max(stepAlong, stepAcross);
  for (let i = -nRows; i <= nRows; i++) {
    const shift = stagger && i % 2 ? stepAlong / 2 : 0; // linhas alternadas deslocadas (padrão contínuo, sem colunas óbvias)
    for (let j = -nCols; j <= nCols; j++) {
      const u = j * stepAlong + shift;
      const v = i * stepAcross;
      const x = cx + u * cos - v * sin;
      const y = cy + u * sin + v * cos;
      if (x < -margin || y < -margin || x > w + margin || y > h + margin) continue;
      const m = make(x, y, i, j);
      if (m) out.push(m);
    }
  }
  return out;
}

export function layout(model: ModelId, w: number, h: number, p: ModelParams, seed: string): Mark[] {
  const S = Math.min(w, h);
  const I = INTENSITY[p.intensity];
  const A = Math.min(0.95, p.opacity * I.alpha);
  const dens = densityScale(p.density) / I.density; // menor = mais marcas
  const cx = w / 2 + (p.offsetX / 100) * w;
  const cy = h / 2 + (p.offsetY / 100) * h;
  const R = rad(p.rotation);
  const rand = seeded(seed);
  const jitter = (amount: number) => (rand() - 0.5) * 2 * amount;
  const count = (min: number, perDensity: number) => Math.max(1, Math.round((min + p.density * perDensity) * I.density));

  switch (model) {
    case 1: {
      // Logotipos grandes em várias regiões, tamanhos variados, sobrepondo o assunto.
      const anchors = [[0.27, 0.27], [0.73, 0.33], [0.5, 0.56], [0.24, 0.8], [0.78, 0.78], [0.5, 0.12], [0.5, 0.92], [0.08, 0.52], [0.92, 0.5], [0.3, 0.55], [0.7, 0.62], [0.6, 0.22]];
      const n = Math.min(anchors.length, count(2, 0.6));
      return anchors.slice(0, n).map(([ax, ay], i) => ({
        t: i % 3 === 2 ? 'combo' : 'logo',
        x: ax! * w + (cx - w / 2) + jitter(S * 0.04),
        y: ay! * h + (cy - h / 2) + jitter(S * 0.04),
        s: (p.size / 100) * S * (0.7 + 0.45 * rand()) * (i % 3 === 2 ? 0.55 : 1),
        r: R + jitter(rad(8)),
        a: A,
        tone: 'light' as Tone,
      }));
    }
    case 2: {
      // Marca central + pequenas repetições em pontos estratégicos (terços, bordas, cantos).
      const out: Mark[] = [{ t: 'combo', x: cx, y: cy, s: (p.size / 100) * S * 0.55, r: R, a: A, tone: 'light' }];
      const pts = [[1 / 3, 1 / 3], [2 / 3, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 2 / 3], [0.5, 0.1], [0.5, 0.9], [0.1, 0.5], [0.9, 0.5], [0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88], [0.3, 0.5], [0.7, 0.5]];
      const n = Math.min(pts.length, count(3, 1));
      pts.slice(0, n).forEach(([px, py], i) =>
        out.push({ t: i < 4 ? 'logo' : 'text', x: px! * w + (cx - w / 2), y: py! * h + (cy - h / 2), s: (p.size / 100) * S * (i < 4 ? 0.22 : 0.12), r: R, a: A * 0.85, tone: 'light' }),
      );
      return out;
    }
    case 3: {
      // Grade horizontal/vertical centrada (sempre há uma marca no centro).
      const step = Math.max(S * 0.06, (p.spacing / 100) * S * dens);
      return rows(w, h, cx, cy, R, step, step, (x, y) => ({ t: 'logo', x, y, s: (p.size / 100) * S, r: R, a: A, tone: 'light' as Tone }), false);
    }
    case 4: {
      // Diagonal contínua de "símbolo + nome".
      const unit = (p.size / 100) * S;
      const along = Math.max(unit * 3.2, unit * (2.6 + 4 * dens));
      const across = Math.max(unit * 1.4, (p.spacing / 100) * S * dens);
      return rows(w, h, cx, cy, R, along, across, (x, y) => ({ t: 'combo', x, y, s: unit, r: R, a: A, tone: 'light' as Tone }));
    }
    case 5: {
      // Grade irregular: posição, tamanho e ângulo variam (determinístico pela foto).
      const cell = Math.max(S * 0.07, (p.spacing / 100) * S * dens);
      const out: Mark[] = [];
      for (let y = cell / 2; y < h + cell / 2; y += cell)
        for (let x = cell / 2; x < w + cell / 2; x += cell) {
          const k = rand();
          out.push({
            t: k < 0.55 ? 'logo' : 'text',
            x: x + jitter(cell * 0.35),
            y: y + jitter(cell * 0.35),
            s: (p.size / 100) * S * (0.6 + 0.8 * rand()) * (k < 0.55 ? 1 : 0.55),
            r: R + jitter(rad(40)),
            a: A * (0.75 + 0.25 * rand()),
            tone: 'light',
          });
        }
      // Garante cobertura do centro.
      out.push({ t: 'logo', x: w / 2 + jitter(cell * 0.2), y: h / 2 + jitter(cell * 0.2), s: (p.size / 100) * S * 1.3, r: R, a: A, tone: 'light' });
      return out;
    }
    case 6: {
      // Símbolos e textos intercalados, dois níveis de transparência.
      const unit = (p.size / 100) * S;
      const along = Math.max(unit * 2.2, unit * (1.8 + 3 * dens));
      const across = Math.max(unit * 1.3, (p.spacing / 100) * S * dens);
      return rows(w, h, cx, cy, R, along, across, (x, y, i, j) => {
        const isText = (i + j) % 2 === 0;
        return { t: isText ? 'text' : 'logo', x, y, s: isText ? unit * 0.75 : unit, r: R, a: (i + j) % 3 === 0 ? A : A * 0.6, tone: 'light' as Tone };
      });
    }
    case 7: {
      // Duas faixas em X atravessando o centro, com nome e símbolo ao longo delas.
      const len = Math.hypot(w, h) * 1.2;
      const thick = (p.thickness / 100) * S;
      const unit = Math.min((p.size / 100) * S, thick * 0.7);
      const out: Mark[] = [];
      for (const ang of [R, -R]) {
        out.push({ t: 'band', x: cx, y: cy, len, thick, r: ang, a: A * 0.55, tone: 'dark' });
        const gap = unit * (2.6 + 3 * dens);
        for (let u = -len / 2; u <= len / 2; u += gap) {
          const x = cx + u * Math.cos(ang);
          const y = cy + u * Math.sin(ang);
          if (x < -unit * 3 || y < -unit * 3 || x > w + unit * 3 || y > h + unit * 3) continue;
          out.push({ t: 'combo', x, y, s: unit, r: ang, a: Math.min(0.95, A * 1.6), tone: 'light' });
        }
      }
      return out;
    }
    case 8: {
      // Proteção intensa: tudo combinado, alternando marcas claras e escuras.
      const out: Mark[] = [];
      const len = Math.hypot(w, h) * 1.2;
      const thick = (p.thickness / 100) * S;
      out.push({ t: 'band', x: cx, y: cy, len: w * 1.2, thick, r: 0, a: A * 0.5, tone: 'dark' });
      for (const ang of [R, -R]) out.push({ t: 'band', x: cx, y: cy, len, thick: thick * 0.45, r: ang, a: A * 0.4, tone: 'dark' });
      const unit = S * 0.075;
      const along = unit * (2.4 + 3 * dens);
      const across = Math.max(unit * 1.3, (p.spacing / 100) * S * dens);
      out.push(...rows(w, h, cx, cy, R, along, across, (x, y, i) => ({ t: 'combo', x, y, s: unit, r: R, a: A * (i % 2 ? 0.95 : 0.85), tone: (i % 2 ? 'dark' : 'light') as Tone })));
      // Nome repetido dentro da faixa horizontal central.
      const tunit = Math.min(thick * 0.6, S * 0.08);
      for (let x = cx - w; x <= cx + w; x += tunit * 5.5) out.push({ t: 'combo', x, y: cy, s: tunit, r: 0, a: Math.min(0.95, A * 1.7), tone: 'light' });
      // Marcas pequenas espalhadas.
      const n = Math.round((6 + p.density * 2) * INTENSITY[p.intensity].density);
      for (let k = 0; k < n; k++) out.push({ t: 'logo', x: rand() * w, y: rand() * h, s: S * (0.04 + 0.05 * rand()), r: jitter(rad(30)), a: A, tone: k % 2 ? 'dark' : 'light' });
      // Logotipo grande atravessando o centro.
      out.push({ t: 'logo', x: cx, y: cy, s: (p.size / 100) * S, r: 0, a: Math.min(0.9, A * 0.9), tone: 'light' });
      return out;
    }
  }
}
