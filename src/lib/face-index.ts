/**
 * ÍNDICE DE ROSTOS (painel, navegador)
 * ------------------------------------------------------------------
 * Usado no envio das fotos (indexa enquanto envia, sem baixar o original de novo)
 * e na tela de Reconhecimento facial.
 * - indexPhoto: encontra os rostos de uma foto e grava as assinaturas.
 * - FaceQueue: fila em série (o modelo processa uma foto por vez), sem travar o envio.
 * - rebuildPack: junta as assinaturas do evento no pacote da busca pública.
 */
import { api } from './panel-api';
import { decodeVec, encodeVec, packIndex } from './faces';

let engine: typeof import('./face-engine') | null = null;
export const faceEngine = async (onProgress?: (pct: number) => void) => {
  engine ??= await import('./face-engine');
  await engine.loadEngine(onProgress);
  return engine;
};

/** Rostos de uma foto → servidor. Devolve quantos rostos foram encontrados. */
export async function indexPhoto(eventId: string, photoId: string, source: Blob) {
  const eng = await faceEngine();
  // Decodifica já reduzida (até 2000 px), mais rápido e com menos memória.
  const bmp = await createImageBitmap(source, { imageOrientation: 'from-image' });
  try {
    const faces = await eng.facesOf(bmp);
    await api.saveFaces(
      eventId,
      photoId,
      faces.map((f) => ({ vec: encodeVec(f.vec), score: Math.round(f.score * 1000) / 1000, box: [f.x, f.y, f.w, f.h] })),
    );
    return faces.length;
  } finally {
    bmp.close();
  }
}

/** Pacote compacto das assinaturas do evento (a busca pública usa só ele). */
export async function rebuildPack(eventId: string) {
  const rows = await api.faceVectors(eventId);
  const list = rows.flatMap((r) => {
    const vec = decodeVec(r.v);
    return vec ? [{ n: r.n, vec }] : [];
  });
  return api.uploadFacePack(eventId, packIndex(list));
}

/** Fila em série para o reconhecimento. Erros não param a fila (a foto fica para indexar depois). */
export class FaceQueue {
  private chain: Promise<unknown> = Promise.resolve();
  pending = 0;
  done = 0;
  faces = 0;
  failed = 0;
  constructor(private onChange: () => void = () => {}) {}
  add(eventId: string, photoId: string, source: Blob) {
    this.pending++;
    this.onChange();
    this.chain = this.chain.then(async () => {
      try {
        this.faces += await indexPhoto(eventId, photoId, source);
        this.done++;
      } catch (e) {
        console.warn('Reconhecimento facial falhou para', photoId, e);
        this.failed++;
      } finally {
        this.pending--;
        this.onChange();
      }
    });
  }
  /** Espera todas as fotos da fila. */
  idle() {
    return this.chain;
  }
}
