/**
 * VALIDAÇÃO DO RECONHECIMENTO FACIAL — métricas, comparação e análise (regras puras)
 * ------------------------------------------------------------------
 * Conjunto de validação = avaliações HUMANAS de pares de rostos (face_labels), cada uma com a
 * pontuação (cosseno) gravada no momento. Como o modelo é fixo, qualquer limiar pode ser
 * recalculado sobre o MESMO conjunto — é isso que torna as comparações justas.
 *
 * Por par, num limiar t:
 *   TP = "mesma pessoa" com pontuação ≥ t     FN = "mesma pessoa" com pontuação < t
 *   FP = "diferentes"   com pontuação ≥ t     TN = "diferentes"   com pontuação < t
 *   Recuperação (recall)  = TP / (TP + FN)
 *   Precisão              = TP / (TP + FP)   ← depende da mistura da amostra (pares escolhidos perto do limiar)
 *   Falsos positivos (FPR) = FP / (FP + TN)  ← denominador: todos os pares "diferentes" avaliados
 * "Exemplos automáticos" (rostos da mesma foto) NÃO entram nessas métricas: são mostrados à parte.
 */
import { calibrate, type Answer } from './face-calibration.ts';
import { MIN_FACE_PX, MIN_SHARPNESS } from './faces.ts';

export const MODEL_VERSION = 'SFace 2021dec + YuNet 2023mar';
/** Versão dos filtros de qualidade do índice (muda quando os critérios mudam). */
export const PIPELINE_VERSION = `rosto≥${MIN_FACE_PX}px·nitidez≥${MIN_SHARPNESS}`;
/** Mínimo de avaliações de cada tipo para considerar uma métrica com evidência suficiente. */
export const MIN_EACH = 15;

export type Label = { e: string; pair: string; s: number; ans: Answer; at?: string };

export interface Metrics {
  t: number;
  tp: number;
  fn: number;
  fp: number;
  tn: number;
  same: number;
  diff: number;
  unsure: number;
  recall: number | null;
  precision: number | null;
  fpr: number | null;
  enough: boolean;
}

export function metricsAt(labels: Pick<Label, 's' | 'ans'>[], t: number): Metrics {
  let tp = 0, fn = 0, fp = 0, tn = 0, unsure = 0;
  for (const l of labels) {
    if (l.ans === 'same') l.s >= t ? tp++ : fn++;
    else if (l.ans === 'diff') l.s >= t ? fp++ : tn++;
    else unsure++;
  }
  const same = tp + fn;
  const diff = fp + tn;
  return {
    t, tp, fn, fp, tn, same, diff, unsure,
    recall: same ? tp / same : null,
    precision: tp + fp ? tp / (tp + fp) : null,
    fpr: diff ? fp / diff : null,
    enough: same >= MIN_EACH && diff >= MIN_EACH,
  };
}

/** Limiar recomendado: o que recupera mais mantendo a taxa de falsos positivos ≤ máximo. null = amostra insuficiente. */
export function recommendThreshold(labels: Pick<Label, 's' | 'ans'>[], maxFpr: number) {
  const c = calibrate(labels, [], { maxMistaken: maxFpr, minEach: MIN_EACH });
  return c.recommended ? c.recommended.t : null;
}

/** Variação em pontos percentuais (a − b) ou null. */
export const deltaPP = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((a - b) * 1000) / 10);

export type Trend = 'better' | 'worse' | 'same' | 'unknown';
/** Melhorou/piorou? Sem evidência suficiente → 'unknown' (cinza). */
export function trend(delta: number | null, higherIsBetter: boolean, enough: boolean): Trend {
  if (!enough || delta === null) return 'unknown';
  if (Math.abs(delta) < 0.05) return 'same';
  return delta > 0 === higherIsBetter ? 'better' : 'worse';
}

/** Identificador do conjunto de validação (FNV-1a sobre pares e respostas): muda se o conjunto mudar. */
export function validationSetId(labels: Pick<Label, 'pair' | 'ans'>[]) {
  let h = 0x811c9dc5;
  for (const l of [...labels].sort((a, b) => (a.pair < b.pair ? -1 : 1))) {
    for (const ch of `${l.pair}:${l.ans};`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}

// ───────── Pessoa de teste (comparação antes/depois) ─────────

export type PersonFace = { id: string; p: string; n: number; s: number };
export type PhotoTruth = 'same' | 'diff' | 'unverified';
export interface PhotoResult {
  p: string;
  n: number;
  face: string; // rosto com maior pontuação nesta foto (o que a busca usa)
  s: number;
  truth: PhotoTruth;
}

/**
 * Por foto: maior pontuação entre os rostos da foto e o rosto de referência, e a verdade conhecida:
 *  - 'same' se ALGUM rosto da foto foi avaliado "mesma pessoa" com a referência;
 *  - 'diff' se o rosto de maior pontuação foi avaliado "diferentes" (e nenhum "mesma");
 *  - 'unverified' caso contrário (não classificado como acerto nem erro).
 */
export function personPhotos(refId: string, refPhoto: string, scored: PersonFace[], labels: Pick<Label, 'pair' | 'ans'>[]) {
  const ans = new Map<string, Answer>();
  for (const l of labels) {
    const [a, b] = l.pair.split('|');
    if (a === refId) ans.set(b!, l.ans);
    else if (b === refId) ans.set(a!, l.ans);
  }
  const byPhoto = new Map<string, PersonFace[]>();
  for (const f of scored) if (f.p !== refPhoto) byPhoto.set(f.p, [...(byPhoto.get(f.p) ?? []), f]);
  const out: PhotoResult[] = [];
  for (const [p, list] of byPhoto) {
    const best = list.reduce((x, y) => (y.s > x.s ? y : x));
    const anySame = list.some((f) => ans.get(f.id) === 'same');
    const truth: PhotoTruth = anySame ? 'same' : ans.get(best.id) === 'diff' ? 'diff' : 'unverified';
    out.push({ p, n: best.n, face: best.id, s: best.s, truth });
  }
  return out.sort((a, b) => b.s - a.s);
}

export interface PersonGroups {
  t: number;
  found: PhotoResult[]; // corretas encontradas (TP)
  missed: PhotoResult[]; // corretas não encontradas (FN)
  others: PhotoResult[]; // outras pessoas incluídas (FP)
  unverified: PhotoResult[]; // acima do limiar, sem verificação
  recall: number | null;
  precision: number | null;
  fpr: number | null;
}

export function personGroups(photos: PhotoResult[], t: number): PersonGroups {
  const found = photos.filter((r) => r.truth === 'same' && r.s >= t);
  const missed = photos.filter((r) => r.truth === 'same' && r.s < t);
  const others = photos.filter((r) => r.truth === 'diff' && r.s >= t);
  const unverified = photos.filter((r) => r.truth === 'unverified' && r.s >= t);
  const diffAll = photos.filter((r) => r.truth === 'diff').length;
  return {
    t, found, missed, others, unverified,
    recall: found.length + missed.length ? found.length / (found.length + missed.length) : null,
    precision: found.length + others.length ? found.length / (found.length + others.length) : null,
    fpr: diffAll ? others.length / diffAll : null,
  };
}

// ───────── Análise automática ─────────

export type Alert = { level: 'warn' | 'danger' | 'info'; text: string };
const pp = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`);
const pc = (v: number | null) => (v === null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const th = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** Explicação e alertas calculados a partir das métricas reais (validação e, se houver, da pessoa de teste). */
export function analyze(cur: Metrics, next: Metrics, person?: { cur: PersonGroups; next: PersonGroups }) {
  const lines: string[] = [];
  const alerts: Alert[] = [];
  if (!cur.enough) {
    alerts.push({ level: 'warn', text: `Amostra insuficiente: são precisos ${MIN_EACH} pares "mesma pessoa" e ${MIN_EACH} "diferentes" (há ${cur.same} e ${cur.diff}). Continue em "Treinar reconhecimento".` });
  }
  if (Math.abs(next.t - cur.t) < 0.0005) {
    lines.push(`O limiar testado (${th(next.t)}) é o mesmo em uso: não há diferença a comparar.`);
    return { lines, alerts };
  }
  const dTp = next.tp - cur.tp;
  const dFp = next.fp - cur.fp;
  lines.push(
    `No conjunto de validação (${cur.same} pares da mesma pessoa e ${cur.diff} de pessoas diferentes), o limiar ${th(next.t)} ${
      dTp >= 0 ? `reconhece ${dTp} par${dTp === 1 ? '' : 'es'} correto${dTp === 1 ? '' : 's'} a mais` : `deixa de reconhecer ${-dTp} par${dTp === -1 ? '' : 'es'} correto${dTp === -1 ? '' : 's'}`
    } e ${dFp > 0 ? `aceita ${dFp} par${dFp === 1 ? '' : 'es'} de pessoas diferentes a mais` : dFp < 0 ? `aceita ${-dFp} par${dFp === -1 ? '' : 'es'} de pessoas diferentes a menos` : 'não muda os pares de pessoas diferentes aceitos'} em relação ao limiar atual (${th(cur.t)}).`,
  );
  lines.push(`Recuperação ${pc(cur.recall)} → ${pc(next.recall)} (${pp(deltaPP(next.recall, cur.recall))}); precisão ${pc(cur.precision)} → ${pc(next.precision)} (${pp(deltaPP(next.precision, cur.precision))}); falsos positivos ${pc(cur.fpr)} → ${pc(next.fpr)} (${pp(deltaPP(next.fpr, cur.fpr))}).`);
  if (person) {
    const df = person.next.found.length - person.cur.found.length;
    const dO = person.next.others.length - person.cur.others.length;
    const dU = person.next.unverified.length - person.cur.unverified.length;
    lines.push(
      `Pessoa de teste: ${df >= 0 ? `${df} foto${df === 1 ? '' : 's'} correta${df === 1 ? '' : 's'} a mais` : `${-df} foto${df === -1 ? '' : 's'} correta${df === -1 ? '' : 's'} a menos`}, ${
        dO > 0 ? `${dO} foto${dO === 1 ? '' : 's'} de outras pessoas a mais` : dO < 0 ? `${-dO} foto${dO === -1 ? '' : 's'} de outras pessoas a menos` : 'nenhuma foto de outra pessoa a mais'
      }${dU > 0 ? ` e ${dU} foto${dU === 1 ? '' : 's'} não verificada${dU === 1 ? '' : 's'} a mais (confira antes de aplicar)` : ''}.`,
    );
    if (dO > 0) alerts.push({ level: 'danger', text: `A pessoa de teste passaria a receber ${dO} foto${dO === 1 ? '' : 's'} de outra${dO === 1 ? '' : 's'} pessoa${dO === 1 ? '' : 's'}. Revise antes de aplicar.` });
  }
  const dPrec = deltaPP(next.precision, cur.precision);
  const dFpr = deltaPP(next.fpr, cur.fpr);
  if (dPrec !== null && dPrec < -0.05) alerts.push({ level: 'warn', text: `A precisão diminui ${pp(dPrec)}.` });
  if (dFpr !== null && dFpr > 0.05) alerts.push({ level: 'danger', text: `A taxa de falsos positivos aumenta ${pp(dFpr)}.` });
  if (next.fpr !== null && next.fpr > 0.02) alerts.push({ level: 'danger', text: `Risco elevado: ${pc(next.fpr)} dos pares de pessoas diferentes seriam aceitos (acima de 2%). Evite em galerias privadas.` });
  if (!alerts.length && cur.enough) alerts.push({ level: 'info', text: 'Nenhum risco identificado nas métricas disponíveis.' });
  return { lines, alerts };
}

// ───────── Ajuste automático do limiar geral ─────────

/** Travas do ajuste automático. */
export const AUTO_TUNE = {
  /** Máximo de pares "diferentes" aceitos: o nível mais seguro (galerias privadas). */
  maxFpr: 0.005,
  /** Maior mudança por vez (sem saltos bruscos). */
  maxStep: 0.03,
  /** Diferença mínima para valer a pena mudar. */
  minChange: 0.002,
} as const;

export type AutoTuneDecision =
  | { apply: true; from: number; to: number; target: number; metrics: Metrics; reason: string }
  | { apply: false; from: number; target: number | null; reason: string };

/**
 * Decide o próximo limiar GERAL a partir de TODAS as avaliações (todos os eventos):
 * só com evidência suficiente, mirando o limiar recomendado com no máximo 0,5% de falsos positivos,
 * e andando no máximo 0,03 por vez. Como a taxa de falsos positivos só cai quando o limiar sobe,
 * qualquer passo em direção ao recomendado mantém (ou melhora) a segurança.
 */
export function autoTuneDecision(labels: Pick<Label, 's' | 'ans'>[], current: number): AutoTuneDecision {
  const m = metricsAt(labels, current);
  if (!m.enough) return { apply: false, from: current, target: null, reason: `Amostra insuficiente (${m.same} "mesma pessoa" e ${m.diff} "diferentes"; mínimo ${MIN_EACH} de cada).` };
  const target = recommendThreshold(labels, AUTO_TUNE.maxFpr);
  if (target === null) return { apply: false, from: current, target: null, reason: 'Sem limiar recomendado ainda.' };
  const diff = target - current;
  if (Math.abs(diff) < AUTO_TUNE.minChange) return { apply: false, from: current, target, reason: 'O limiar geral já está no recomendado.' };
  const step = Math.max(-AUTO_TUNE.maxStep, Math.min(AUTO_TUNE.maxStep, diff));
  const to = Math.round(Math.min(0.6, Math.max(0.25, current + step)) * 1000) / 1000;
  return {
    apply: true,
    from: current,
    to,
    target,
    metrics: metricsAt(labels, to),
    reason: `${m.same + m.diff} avaliações de todos os eventos: ${diff < 0 ? 'dá para encontrar mais fotos' : 'é preciso reduzir confusões'} (alvo ${target.toFixed(3)}${to !== target ? `, passo de no máximo ${AUTO_TUNE.maxStep}` : ''}).`,
  };
}
