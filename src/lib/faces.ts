/**
 * RECONHECIMENTO FACIAL — regras puras (navegador, servidor e testes)
 * ------------------------------------------------------------------
 * Modelos (OpenCV Zoo):
 *   - YuNet  (face_detection_yunet_2023mar.onnx, licença MIT): encontra rostos e 5 pontos
 *     (olho dir., olho esq., nariz, canto dir. e esq. da boca). Entrada fixa 640×640, BGR 0–255.
 *   - SFace  (face_recognition_sface_2021dec_int8.onnx, licença Apache 2.0): gera a "assinatura"
 *     (128 números) de um rosto alinhado 112×112, RGB 0–255.
 * Mesma lógica do OpenCV (FaceDetectorYN / FaceRecognizerSF): decodificação por grade de passos 8/16/32,
 * NMS, alinhamento por semelhança nos 5 pontos e comparação por cosseno (limite de referência 0,363).
 *
 * Nada aqui guarda imagens: só números (caixas, pontos e assinaturas).
 */

export const DET_SIZE = 640;
export const REC_SIZE = 112;
/** Limite de referência do OpenCV para "mesma pessoa" (cosseno). Ajustável no piloto. */
export const COSINE_MATCH = 0.363;

export interface Face {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
  /** 5 pontos: [x0,y0, x1,y1, …] */
  landmarks: number[];
}

// ───────── Detector (YuNet) ─────────

/** RGBA 640×640 (imagem reduzida no canto superior esquerdo, resto preto) → tensor NCHW BGR 0–255. */
export function detectorTensor(rgba: Uint8ClampedArray | Uint8Array, size = DET_SIZE) {
  const n = size * size;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = rgba[i * 4 + 2]!; // B
    out[n + i] = rgba[i * 4 + 1]!; // G
    out[2 * n + i] = rgba[i * 4]!; // R
  }
  return out;
}

type Outputs = Record<string, { data: ArrayLike<number> }>;

/** Decodifica as saídas do YuNet (coordenadas no espaço 640×640). */
export function decodeYunet(out: Outputs, size = DET_SIZE, scoreThreshold = 0.6, nmsThreshold = 0.3, topK = 200): Face[] {
  const faces: Face[] = [];
  for (const s of [8, 16, 32]) {
    const cols = size / s;
    const rows = size / s;
    const cls = out[`cls_${s}`]!.data;
    const obj = out[`obj_${s}`]!.data;
    const box = out[`bbox_${s}`]!.data;
    const kps = out[`kps_${s}`]!.data;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const clsS = Math.min(1, Math.max(0, cls[i]!));
        const objS = Math.min(1, Math.max(0, obj[i]!));
        const score = Math.sqrt(clsS * objS);
        if (score < scoreThreshold) continue;
        const cx = (c + box[i * 4]!) * s;
        const cy = (r + box[i * 4 + 1]!) * s;
        const w = Math.exp(box[i * 4 + 2]!) * s;
        const h = Math.exp(box[i * 4 + 3]!) * s;
        const landmarks: number[] = [];
        for (let n = 0; n < 5; n++) landmarks.push((kps[i * 10 + 2 * n]! + c) * s, (kps[i * 10 + 2 * n + 1]! + r) * s);
        faces.push({ x: cx - w / 2, y: cy - h / 2, w, h, score, landmarks });
      }
  }
  return nms(faces, nmsThreshold).slice(0, topK);
}

const iou = (a: Face, b: Face) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / (a.w * a.h + b.w * b.h - inter || 1);
};

export function nms(faces: Face[], threshold: number) {
  const sorted = [...faces].sort((a, b) => b.score - a.score);
  const keep: Face[] = [];
  for (const f of sorted) if (keep.every((k) => iou(k, f) <= threshold)) keep.push(f);
  return keep;
}

/** Converte do espaço 640 para a imagem original (escala usada ao reduzir). */
export const scaleFace = (f: Face, k: number): Face => ({
  x: f.x / k,
  y: f.y / k,
  w: f.w / k,
  h: f.h / k,
  score: f.score,
  landmarks: f.landmarks.map((v) => v / k),
});

// ───────── Alinhamento (como FaceRecognizerSF.alignCrop) ─────────

/** Posições de referência dos 5 pontos no rosto 112×112 (padrão ArcFace/SFace). */
export const REF_POINTS = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

/** Transformação de semelhança (escala + rotação + deslocamento) que leva os 5 pontos ao padrão. */
export function similarityTransform(landmarks: number[], ref = REF_POINTS) {
  const src = [0, 1, 2, 3, 4].map((i) => [landmarks[2 * i]!, landmarks[2 * i + 1]!]);
  const n = src.length;
  const ms = [0, 0];
  const md = [0, 0];
  for (let i = 0; i < n; i++) {
    ms[0]! += src[i]![0]! / n;
    ms[1]! += src[i]![1]! / n;
    md[0]! += ref[i]![0]! / n;
    md[1]! += ref[i]![1]! / n;
  }
  let num1 = 0;
  let num2 = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const xs = src[i]![0]! - ms[0]!;
    const ys = src[i]![1]! - ms[1]!;
    const xd = ref[i]![0]! - md[0]!;
    const yd = ref[i]![1]! - md[1]!;
    num1 += xs * xd + ys * yd;
    num2 += xs * yd - ys * xd;
    den += xs * xs + ys * ys;
  }
  const a = num1 / (den || 1);
  const b = num2 / (den || 1);
  // destino = [a -b; b a]·origem + t
  return { a, b, tx: md[0]! - (a * ms[0]! - b * ms[1]!), ty: md[1]! - (b * ms[0]! + a * ms[1]!) };
}

/** Recorta e alinha o rosto (112×112 RGBA) a partir da imagem original, com interpolação bilinear. */
export function alignCrop(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, landmarks: number[], size = REC_SIZE) {
  const k = size / REC_SIZE;
  const { a, b, tx, ty } = similarityTransform(landmarks, k === 1 ? REF_POINTS : REF_POINTS.map(([x, y]) => [x! * k, y! * k]));
  // inversa de [a -b; b a]
  const det = a * a + b * b || 1;
  const out = new Uint8ClampedArray(size * size * 4);
  for (let yd = 0; yd < size; yd++)
    for (let xd = 0; xd < size; xd++) {
      const u = xd - tx;
      const v = yd - ty;
      const xs = (a * u + b * v) / det;
      const ys = (-b * u + a * v) / det;
      const o = (yd * size + xd) * 4;
      const x0 = Math.floor(xs);
      const y0 = Math.floor(ys);
      if (x0 < 0 || y0 < 0 || x0 + 1 >= w || y0 + 1 >= h) {
        out[o + 3] = 255;
        continue;
      }
      const fx = xs - x0;
      const fy = ys - y0;
      for (let ch = 0; ch < 3; ch++) {
        const p00 = rgba[(y0 * w + x0) * 4 + ch]!;
        const p10 = rgba[(y0 * w + x0 + 1) * 4 + ch]!;
        const p01 = rgba[((y0 + 1) * w + x0) * 4 + ch]!;
        const p11 = rgba[((y0 + 1) * w + x0 + 1) * 4 + ch]!;
        out[o + ch] = p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy;
      }
      out[o + 3] = 255;
    }
  return out;
}

/** Rosto alinhado (RGBA 112×112) → tensor NCHW RGB 0–255 (entrada do SFace). */
export function recognizerTensor(rgba: Uint8ClampedArray | Uint8Array, size = REC_SIZE) {
  const n = size * size;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = rgba[i * 4]!; // R
    out[n + i] = rgba[i * 4 + 1]!; // G
    out[2 * n + i] = rgba[i * 4 + 2]!; // B
  }
  return out;
}

// ───────── Assinaturas e comparação ─────────

export const VEC_LEN = 128;

export function normalize(v: ArrayLike<number>) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i]! * v[i]!;
  const k = 1 / (Math.sqrt(s) || 1);
  return Float32Array.from(v, (x) => x * k);
}

/** Cosseno entre assinaturas já normalizadas (1 = idênticas). */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

/** Assinatura ↔ texto (base64 de 128 float32 = 684 caracteres). */
export function encodeVec(v: Float32Array) {
  const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

export function decodeVec(b64: string): Float32Array | null {
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    return null;
  }
  if (bin.length !== VEC_LEN * 4) return null;
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const v = new Float32Array(bytes.buffer);
  for (const x of v) if (!Number.isFinite(x) || Math.abs(x) > 1.0001) return null;
  return v;
}

/**
 * Nitidez de um recorte quadrado RGBA (variância do Laplaciano em tons de cinza).
 * Use faceSharpness para medir um rosto: ela mede no tamanho real dele.
 */
export function sharpness(rgba: Uint8ClampedArray | Uint8Array, size = REC_SIZE) {
  const g = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) g[i] = 0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!;
  let s = 0;
  let s2 = 0;
  let c = 0;
  for (let y = 1; y < size - 1; y++)
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      const v = 4 * g[i]! - g[i - 1]! - g[i + 1]! - g[i - size]! - g[i + size]!;
      s += v;
      s2 += v * v;
      c++;
    }
  return s2 / c - (s / c) ** 2;
}
/**
 * Nitidez do rosto NO TAMANHO REAL dele (recorte alinhado com o lado ≈ largura do rosto,
 * entre 112 e 256 px). Reduzir um rosto grande para 112 px "esconde" o desfoque:
 * rosto de 239 px com desfoque leve dava 162 reduzido e 15 no tamanho real.
 * Medido no portfólio: rostos em foco 130–313; com desfoque leve (σ2) ≤ 18.
 */
export function faceSharpness(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, f: Pick<Face, 'w' | 'landmarks'>) {
  const size = Math.max(REC_SIZE, Math.min(256, Math.round(f.w)));
  return sharpness(alignCrop(rgba, w, h, f.landmarks, size), size);
}
/** Nitidez mínima para indexar rostos das fotos do evento (só rostos bem focados). */
export const MIN_SHARPNESS = 100;
/** Na selfie do comprador, mais tolerante (câmera de celular com pouca luz). */
export const MIN_SHARPNESS_SELFIE = 20;
/** Rosto guardado com nitidez conhecida abaixo do mínimo (índices refeitos). -1 = medido antes do filtro. */
export const blurryStored = (sharp: number | null | undefined) => typeof sharp === 'number' && sharp >= 0 && sharp < MIN_SHARPNESS;

/** Rosto principal de uma selfie: o maior com boa confiança. */
export const mainFace = (faces: Face[]) => [...faces].sort((a, b) => b.w * b.h - a.w * a.h)[0] ?? null;

/**
 * Tamanho mínimo do rosto (lado menor, em px na imagem analisada, até 2000 px).
 * Medido nas fotos de evento: abaixo de ~50 px as assinaturas de pessoas diferentes ficam
 * parecidas entre si (190 de 541 pares confundidos com 24 px; 1 de 52 com 50 px).
 */
export const MIN_FACE_PX = 48;
export const ANALYSIS_MAX_SIDE = 2000;
/** Rosto grande o bastante para reconhecer com segurança (coordenadas da imagem analisada). */
export const usableFace = (f: Face) => Math.min(f.w, f.h) >= MIN_FACE_PX;
/** O mesmo critério a partir da caixa guardada (coordenadas da foto original, de largura w e altura h). */
export const reliableBox = (box: ArrayLike<number>, w: number, h: number) =>
  Math.min(box[2]!, box[3]!) * Math.min(1, ANALYSIS_MAX_SIDE / Math.max(w || 1, h || 1)) >= MIN_FACE_PX;

/** Taxa de acerto do piloto: das fotos marcadas, quantas certas (precisão) e quantas da pessoa foram achadas (cobertura). */
export function pilotMetrics(results: { photo: string; score: number }[], correct: Set<string>, wrong: Set<string>, missing: Set<string>, threshold: number) {
  const found = results.filter((r) => r.score >= threshold);
  const tp = found.filter((r) => correct.has(r.photo)).length;
  const fp = found.filter((r) => wrong.has(r.photo)).length;
  // Fotos da pessoa que ficaram abaixo do limite também contam como não encontradas.
  const belowCorrect = results.filter((r) => r.score < threshold && correct.has(r.photo)).length;
  const fn = belowCorrect + missing.size;
  return {
    found: found.length,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
  };
}

// ───────── Pacote de busca (servidor) ─────────
/**
 * Todas as assinaturas de um evento num arquivo só (guardado no R2), para a busca pública ser rápida:
 *   "VF1\0" | quantidade N (uint32) | nº da foto[N] (uint32) | escala[N] (float32) | assinaturas N×128 (int8)
 * Cada assinatura vira 128 bytes (int8 com escala própria): ~1,1 MB para 9 mil rostos.
 */
const PACK_MAGIC = 0x00314656; // "VF1\0" (little-endian)

export function packIndex(rows: { n: number; vec: ArrayLike<number> }[]) {
  const N = rows.length;
  const buf = new ArrayBuffer(8 + N * 8 + N * VEC_LEN);
  const dv = new DataView(buf);
  dv.setUint32(0, PACK_MAGIC, true);
  dv.setUint32(4, N, true);
  const seqs = new Uint32Array(buf, 8, N);
  const scales = new Float32Array(buf, 8 + N * 4, N);
  const q = new Int8Array(buf, 8 + N * 8, N * VEC_LEN);
  rows.forEach((r, i) => {
    let max = 0;
    for (let j = 0; j < VEC_LEN; j++) max = Math.max(max, Math.abs(r.vec[j]!));
    const s = max / 127 || 1;
    seqs[i] = r.n;
    scales[i] = s;
    for (let j = 0; j < VEC_LEN; j++) q[i * VEC_LEN + j] = Math.round(r.vec[j]! / s);
  });
  return new Uint8Array(buf);
}

/** Confere o formato do pacote; devolve a quantidade de rostos ou null. */
export function packCount(buf: ArrayBuffer) {
  if (buf.byteLength < 8) return null;
  const dv = new DataView(buf);
  const N = dv.getUint32(4, true);
  if (dv.getUint32(0, true) !== PACK_MAGIC || N > 200_000 || buf.byteLength !== 8 + N * 8 + N * VEC_LEN) return null;
  return N;
}

/** Compara a assinatura da selfie com o pacote: melhor pontuação por foto, acima do limite, da maior para a menor. */
export function searchPack(buf: ArrayBuffer, query: ArrayLike<number>, threshold: number, max = 300) {
  const N = packCount(buf);
  if (N === null) return [];
  const seqs = new Uint32Array(buf, 8, N);
  const scales = new Float32Array(buf, 8 + N * 4, N);
  const q = new Int8Array(buf, 8 + N * 8, N * VEC_LEN);
  const qv = Float32Array.from(query);
  const best = new Map<number, number>();
  for (let i = 0; i < N; i++) {
    let s = 0;
    const o = i * VEC_LEN;
    for (let j = 0; j < VEC_LEN; j++) s += q[o + j]! * qv[j]!;
    s *= scales[i]!;
    if (s >= threshold && s > (best.get(seqs[i]!) ?? -1)) best.set(seqs[i]!, s);
  }
  return [...best]
    .map(([n, score]) => ({ n, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

/** Limite padrão da busca pública e a faixa permitida no painel. */
export const THRESHOLD_RANGE = { min: 0.25, max: 0.6 } as const;
export const validThreshold = (v: unknown) => (typeof v === 'number' && v >= THRESHOLD_RANGE.min && v <= THRESHOLD_RANGE.max ? Math.round(v * 1000) / 1000 : null);
