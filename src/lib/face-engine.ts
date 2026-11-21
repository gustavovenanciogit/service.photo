/**
 * MOTOR DE RECONHECIMENTO FACIAL (navegador)
 * ------------------------------------------------------------------
 * Carrega YuNet + SFace (pasta /models/face, servida pelo próprio site) no ONNX Runtime Web
 * e transforma uma foto em uma lista de rostos com "assinatura" (128 números).
 * A imagem nunca sai do aparelho: só as assinaturas são usadas.
 */
import * as ort from 'onnxruntime-web/wasm';
import { alignCrop, DET_SIZE, decodeYunet, detectorTensor, faceSharpness, MIN_SHARPNESS, normalize, recognizerTensor, REC_SIZE, scaleFace, usableFace, type Face } from './faces';

ort.env.wasm.wasmPaths = '/ort/';
ort.env.logLevel = 'error'; // o SFace gera muitos avisos inofensivos no console
// Várias threads só em página isolada (painel: cabeçalhos COOP/COEP); senão 1 (galeria pública, Safari).
ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) - 1)) : 1;

export interface FaceWithVec extends Face {
  vec: Float32Array;
  /** Nitidez no tamanho real do rosto (faceSharpness). */
  sharp: number;
}

type Engine = { det: ort.InferenceSession; rec: ort.InferenceSession };
/** full = modelo completo (painel, indexação); lite = modelo leve int8 (~10 MB, selfie no celular do comprador). */
export type EngineVariant = 'full' | 'lite';
const engines = new Map<EngineVariant, Promise<Engine>>();

async function fetchBytes(url: string, onProgress?: (loaded: number) => void) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok || !res.body) throw new Error(`Falha ao baixar o modelo (${res.status}).`);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded);
  }
  const out = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

const FILES: Record<EngineVariant, { urls: string[]; bytes: number }> = {
  full: { urls: ['/models/face/sface-2021dec.onnx.part0', '/models/face/sface-2021dec.onnx.part1'], bytes: 38_696_353 },
  lite: { urls: ['/models/face/sface-2021dec-int8.onnx'], bytes: 9_896_933 },
};
/** Canvas 2D (OffscreenCanvas quando existe; senão um canvas comum — iPhones mais antigos). */
function ctx2d(w: number, h: number) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true })!;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d', { willReadFrequently: true })!;
}

const opts = { executionProviders: ['wasm'], logSeverityLevel: 3 } as const;

/** Carrega os modelos uma vez (depois vêm do cache do navegador). */
export function loadEngine(onProgress?: (pct: number) => void, variant: EngineVariant = 'full') {
  let p = engines.get(variant);
  if (!p) {
    p = (async () => {
      const total = 232_589 + FILES[variant].bytes;
      let done = 0;
      const track = (base: number) => (n: number) => onProgress?.(Math.min(99, Math.round(((base + n) / total) * 100)));
      // Se o motor não abrir em 60 s (ex.: navegador que trava as threads), desiste com aviso em vez de ficar parado.
      const limit = <T,>(p: Promise<T>) =>
        Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('O reconhecimento facial não iniciou neste navegador. Tente o Chrome ou atualize a página.')), 60_000))]);
      const det = await limit(ort.InferenceSession.create(await fetchBytes('/models/face/yunet-2023mar.onnx', track(0)), opts));
      done += 232_589;
      const parts: Uint8Array[] = [];
      for (const url of FILES[variant].urls) {
        const b = await fetchBytes(url, track(done));
        done += b.length;
        parts.push(b);
      }
      const model = new Uint8Array(parts.reduce((s, b) => s + b.length, 0));
      parts.reduce((o, b) => (model.set(b, o), o + b.length), 0);
      const rec = await limit(ort.InferenceSession.create(model, opts));
      onProgress?.(100);
      return { det, rec };
    })().catch((e) => {
      engines.delete(variant);
      throw e;
    });
    engines.set(variant, p);
  }
  return p;
}

/** Detecta os rostos de uma imagem e gera a assinatura de cada um. */
export async function facesOf(
  img: ImageBitmap | HTMLImageElement | HTMLCanvasElement,
  o: { maxSide?: number; minScore?: number; variant?: EngineVariant; minSharpness?: number } = {},
): Promise<FaceWithVec[]> {
  const { det, rec } = await loadEngine(undefined, o.variant);
  const W = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const H = 'naturalHeight' in img ? img.naturalHeight : img.height;
  // Cópia em resolução boa para o recorte do rosto (até 2000 px no lado maior).
  const kFull = Math.min(1, (o.maxSide ?? 2000) / Math.max(W, H));
  const fw = Math.round(W * kFull);
  const fh = Math.round(H * kFull);
  const full = ctx2d(fw, fh);
  full.drawImage(img, 0, 0, fw, fh);
  const pixels = full.getImageData(0, 0, fw, fh).data;
  // Entrada do detector: 640×640, imagem reduzida no canto superior esquerdo.
  const k = DET_SIZE / Math.max(fw, fh);
  const dc = ctx2d(DET_SIZE, DET_SIZE);
  dc.fillStyle = '#000';
  dc.fillRect(0, 0, DET_SIZE, DET_SIZE);
  dc.drawImage(full.canvas, 0, 0, Math.round(fw * k), Math.round(fh * k));
  const out = await det.run({ input: new ort.Tensor('float32', detectorTensor(dc.getImageData(0, 0, DET_SIZE, DET_SIZE).data), [1, 3, DET_SIZE, DET_SIZE]) });
  const faces = decodeYunet(out as never, DET_SIZE, o.minScore ?? 0.6)
    .map((f) => scaleFace(f, k))
    .filter(usableFace);
  const result: FaceWithVec[] = [];
  for (const f of faces) {
    // Rosto desfocado (ex.: pessoa ao fundo fora de foco): não indexa. Medido no tamanho real do rosto.
    const sharp = faceSharpness(pixels, fw, fh, f);
    if (sharp < (o.minSharpness ?? MIN_SHARPNESS)) continue;
    const crop = alignCrop(pixels, fw, fh, f.landmarks);
    const r = await rec.run({ data: new ort.Tensor('float32', recognizerTensor(crop), [1, 3, REC_SIZE, REC_SIZE]) });
    // Coordenadas de volta ao tamanho original da imagem.
    result.push({ ...scaleFace(f, kFull), vec: normalize((r.fc1 as ort.Tensor).data as Float32Array), sharp: Math.round(sharp) });
  }
  return result;
}
