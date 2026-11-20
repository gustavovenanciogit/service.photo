/**
 * MOTOR DE RECONHECIMENTO FACIAL (navegador)
 * ------------------------------------------------------------------
 * Carrega YuNet + SFace (pasta /models/face, servida pelo próprio site) no ONNX Runtime Web
 * e transforma uma foto em uma lista de rostos com "assinatura" (128 números).
 * A imagem nunca sai do aparelho: só as assinaturas são usadas.
 */
import * as ort from 'onnxruntime-web/wasm';
import { alignCrop, DET_SIZE, decodeYunet, detectorTensor, normalize, recognizerTensor, REC_SIZE, scaleFace, usableFace, type Face } from './faces';

ort.env.wasm.wasmPaths = '/ort/';
ort.env.logLevel = 'error'; // o SFace gera muitos avisos inofensivos no console
ort.env.wasm.numThreads = 1; // sem isolamento entre origens o navegador não permite várias threads

export interface FaceWithVec extends Face {
  vec: Float32Array;
}

let engine: Promise<{ det: ort.InferenceSession; rec: ort.InferenceSession }> | null = null;

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

/** Carrega os modelos uma vez (~39 MB na primeira vez; depois vem do cache do navegador). */
export function loadEngine(onProgress?: (pct: number) => void) {
  engine ??= (async () => {
    const total = 232_589 + 38_696_353;
    let done = 0;
    const track = (base: number) => (n: number) => onProgress?.(Math.min(99, Math.round(((base + n) / total) * 100)));
    const det = await ort.InferenceSession.create(await fetchBytes('/models/face/yunet-2023mar.onnx', track(0)), { executionProviders: ['wasm'], logSeverityLevel: 3 });
    done += 232_589;
    const p0 = await fetchBytes('/models/face/sface-2021dec.onnx.part0', track(done));
    done += p0.length;
    const p1 = await fetchBytes('/models/face/sface-2021dec.onnx.part1', track(done));
    const model = new Uint8Array(p0.length + p1.length);
    model.set(p0, 0);
    model.set(p1, p0.length);
    const rec = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], logSeverityLevel: 3 });
    onProgress?.(100);
    return { det, rec };
  })().catch((e) => {
    engine = null;
    throw e;
  });
  return engine;
}

/** Detecta os rostos de uma imagem e gera a assinatura de cada um. */
export async function facesOf(img: ImageBitmap | HTMLImageElement | HTMLCanvasElement, opts: { maxSide?: number; minScore?: number } = {}): Promise<FaceWithVec[]> {
  const { det, rec } = await loadEngine();
  const W = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const H = 'naturalHeight' in img ? img.naturalHeight : img.height;
  // Cópia em resolução boa para o recorte do rosto (até 2000 px no lado maior).
  const kFull = Math.min(1, (opts.maxSide ?? 2000) / Math.max(W, H));
  const fw = Math.round(W * kFull);
  const fh = Math.round(H * kFull);
  const full = new OffscreenCanvas(fw, fh).getContext('2d', { willReadFrequently: true })!;
  full.drawImage(img, 0, 0, fw, fh);
  const pixels = full.getImageData(0, 0, fw, fh).data;
  // Entrada do detector: 640×640, imagem reduzida no canto superior esquerdo.
  const k = DET_SIZE / Math.max(fw, fh);
  const dc = new OffscreenCanvas(DET_SIZE, DET_SIZE).getContext('2d', { willReadFrequently: true })!;
  dc.fillStyle = '#000';
  dc.fillRect(0, 0, DET_SIZE, DET_SIZE);
  dc.drawImage(full.canvas, 0, 0, Math.round(fw * k), Math.round(fh * k));
  const out = await det.run({ input: new ort.Tensor('float32', detectorTensor(dc.getImageData(0, 0, DET_SIZE, DET_SIZE).data), [1, 3, DET_SIZE, DET_SIZE]) });
  const faces = decodeYunet(out as never, DET_SIZE, opts.minScore ?? 0.6)
    .map((f) => scaleFace(f, k))
    .filter(usableFace);
  const result: FaceWithVec[] = [];
  for (const f of faces) {
    const crop = alignCrop(pixels, fw, fh, f.landmarks);
    const o = await rec.run({ data: new ort.Tensor('float32', recognizerTensor(crop), [1, 3, REC_SIZE, REC_SIZE]) });
    // Coordenadas de volta ao tamanho original da imagem.
    result.push({ ...scaleFace(f, kFull), vec: normalize((o.fc1 as ort.Tensor).data as Float32Array) });
  }
  return result;
}
