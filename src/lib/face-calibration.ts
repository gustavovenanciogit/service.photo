/**
 * TREINAR A IA — calibragem do reconhecimento facial (regras puras)
 * ------------------------------------------------------------------
 * O modelo (SFace) não é re-treinado: o que aprende com as respostas do fotógrafo é o
 * NÍVEL DE EXIGÊNCIA (limite de semelhança) ideal para os eventos dele.
 *  - pickPairs: escolhe pares de rostos de fotos diferentes, concentrando nos duvidosos
 *    (perto do limite atual), que são os que mais ensinam.
 *  - samePhotoNegatives: dois rostos na MESMA foto são pessoas diferentes — exemplos
 *    automáticos de "não é a mesma pessoa", sem precisar perguntar.
 *  - calibrate: com as respostas, mede acertos e erros por limite e recomenda o melhor.
 */
import { cosine } from './faces.ts';

export type Answer = 'same' | 'diff' | 'unsure';
export type LabeledPair = { s: number; ans: Answer };
export type IndexedFace = { id: string; p: string; vec: ArrayLike<number> };
export type Pair = { a: string; b: string; s: number };

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Gerador pseudoaleatório com semente (mesmos pares para a mesma semente). */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pares para conferir. 60% perto do limite (±0,12), 25% acima, 15% abaixo.
 * Para cada rosto-âncora sorteado, considera os 3 rostos mais parecidos em outras fotos.
 */
export function pickPairs(faces: IndexedFace[], o: { threshold: number; count: number; seed?: number; exclude?: Set<string>; anchors?: number }): Pair[] {
  const rand = rng(o.seed ?? 1);
  const idx = faces.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  const anchors = idx.slice(0, o.anchors ?? 300);
  const seen = new Set<string>(o.exclude ?? []);
  const cand: Pair[] = [];
  for (const ai of anchors) {
    const a = faces[ai]!;
    const top: Pair[] = [];
    for (const b of faces) {
      if (b.p === a.p) continue;
      const s = cosine(a.vec, b.vec);
      if (s < 0.1) continue;
      top.push({ a: a.id, b: b.id, s });
      if (top.length > 12) {
        top.sort((x, y) => y.s - x.s);
        top.length = 6;
      }
    }
    top.sort((x, y) => y.s - x.s);
    for (const p of top.slice(0, 3)) {
      const k = pairKey(p.a, p.b);
      if (!seen.has(k)) {
        seen.add(k);
        cand.push(p);
      }
    }
  }
  const t = o.threshold;
  const near = cand.filter((p) => Math.abs(p.s - t) <= 0.12);
  const high = cand.filter((p) => p.s > t + 0.12);
  const low = cand.filter((p) => p.s < t - 0.12);
  const quota = { near: Math.round(o.count * 0.6), high: Math.round(o.count * 0.25) };
  const take = (list: Pair[], n: number) => {
    const out: Pair[] = [];
    const used = new Map<string, number>();
    for (const p of list.sort(() => rand() - 0.5)) {
      if (out.length >= n) break;
      // Cada rosto aparece no máximo 2 vezes (variedade).
      if ((used.get(p.a) ?? 0) >= 2 || (used.get(p.b) ?? 0) >= 2) continue;
      used.set(p.a, (used.get(p.a) ?? 0) + 1);
      used.set(p.b, (used.get(p.b) ?? 0) + 1);
      out.push(p);
    }
    return out;
  };
  const picked = [...take(near, quota.near), ...take(high, quota.high)];
  picked.push(...take(low, o.count - picked.length));
  // Completa com o que sobrou, se faltar.
  if (picked.length < o.count) {
    const got = new Set(picked.map((p) => pairKey(p.a, p.b)));
    picked.push(...take(cand.filter((p) => !got.has(pairKey(p.a, p.b))), o.count - picked.length));
  }
  return picked.sort(() => rand() - 0.5);
}

/** Maior semelhança de cada rosto com outro rosto da MESMA foto (exemplos automáticos de pessoas diferentes). */
export function samePhotoNegatives(faces: IndexedFace[]) {
  const byPhoto = new Map<string, IndexedFace[]>();
  for (const f of faces) byPhoto.set(f.p, [...(byPhoto.get(f.p) ?? []), f]);
  const out: number[] = [];
  for (const list of byPhoto.values()) {
    if (list.length < 2) continue;
    for (const a of list) {
      let best = -1;
      for (const b of list) if (b !== a) best = Math.max(best, cosine(a.vec, b.vec));
      out.push(best);
    }
  }
  return out;
}

export type CalibrationRow = { t: number; found: number | null; mistaken: number | null };

/**
 * Acertos por limite:
 *  found    = das duplas "mesma pessoa", quantas o sistema reconhece (≥ limite)
 *  mistaken = das duplas "pessoas diferentes", quantas ele confundiria (≥ limite)
 * Recomendação: o limite que reconhece mais "mesma pessoa" mantendo as confusões
 * abaixo do máximo aceito (padrão 1%). Exige um mínimo de respostas de cada tipo.
 */
export function calibrate(labels: LabeledPair[], autoNegatives: number[] = [], o: { maxMistaken?: number; minEach?: number } = {}) {
  const maxMistaken = o.maxMistaken ?? 0.01;
  const minEach = o.minEach ?? 15;
  const pos = labels.filter((l) => l.ans === 'same').map((l) => l.s);
  const negHuman = labels.filter((l) => l.ans === 'diff').map((l) => l.s);
  const neg = [...negHuman, ...autoNegatives];
  const rows: CalibrationRow[] = [];
  for (let t = 0.25; t <= 0.6 + 1e-9; t += 0.005) {
    const tt = Math.round(t * 1000) / 1000;
    rows.push({
      t: tt,
      found: pos.length ? pos.filter((s) => s >= tt).length / pos.length : null,
      mistaken: neg.length ? neg.filter((s) => s >= tt).length / neg.length : null,
    });
  }
  const enough = pos.length >= minEach && negHuman.length + Math.min(autoNegatives.length, minEach) >= minEach;
  let recommended: CalibrationRow | null = null;
  if (enough) {
    for (const r of rows) {
      if (r.mistaken !== null && r.mistaken <= maxMistaken) {
        recommended = r; // o menor limite que respeita o máximo de confusões = o que acha mais fotos
        break;
      }
    }
    recommended ??= rows[rows.length - 1]!;
  }
  return { rows, recommended, enough, positives: pos.length, negatives: negHuman.length, autoNegatives: autoNegatives.length, at: (t: number) => rows.reduce((b, r) => (Math.abs(r.t - t) < Math.abs(b.t - t) ? r : b)) };
}
