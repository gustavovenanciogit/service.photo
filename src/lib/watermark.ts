/**
 * PROCESSAMENTO DAS FOTOS (navegador do painel)
 * ------------------------------------------------------------------
 * A partir do original (que vai intacto para o armazenamento privado), gera:
 *   - preview: lado maior = "pré-visualização reduzida" da aba Proteção (800/1200/1600 px)
 *   - thumb:   lado maior 520 px
 * As duas recebem a marca d'água (modelo da galeria) e o desfoque configurado DIRETO NOS PIXELS.
 * O editor de marca d'água usa as mesmas funções (renderPreview) — o que você vê é o que é publicado.
 */
import { api } from './panel-api';
import { effectiveModel, MODELS, signature, type ModelId, type ModelParams, type ProtectionSettings, type WatermarkSettings } from './watermark-models';
import { drawPhoto, renderWatermark, type RenderAssets } from './watermark-render';

export const THUMB = 520;
export const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';

export interface WatermarkJob {
  model: ModelId;
  params: ModelParams;
  protection: ProtectionSettings;
  assets: RenderAssets;
  sig: string;
}

let fontsReady: Promise<unknown> | null = null;
export const loadFonts = () => (fontsReady ??= document.fonts.load(`800 40px ${FONT}`).catch(() => null));

/** Carrega o logotipo enviado (PNG). Sem logotipo, usa o símbolo padrão da Venart. */
export async function loadLogo(s: Pick<WatermarkSettings, 'logoVersion'>): Promise<ImageBitmap | null> {
  if (!s.logoVersion) return null;
  try {
    const res = await fetch('/api/settings/watermark/logo', { credentials: 'same-origin', cache: 'no-store' });
    return res.ok ? await createImageBitmap(await res.blob()) : null;
  } catch {
    return null;
  }
}

/** Configuração efetiva para uma galeria (modelo próprio ou o padrão). */
export async function loadWatermarkJob(eventModel: number, settings?: WatermarkSettings): Promise<WatermarkJob> {
  const s = settings ?? (await api.watermarkSettings());
  const [logo] = await Promise.all([loadLogo(s), loadFonts()]);
  const model = effectiveModel(eventModel, s);
  const params = s.models[model] ?? MODELS[model].defaults;
  return { model, params, protection: s.protection, assets: { logo, font: FONT }, sig: signature(model, params, s.protection, s.logoVersion) };
}

export const fit = (w: number, h: number, max: number) => {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
};

/** Desenha foto + proteção + marca d'água num canvas (usado no envio e no editor). */
export function renderPreview(
  canvas: HTMLCanvasElement,
  img: CanvasImageSource & { width: number; height: number },
  max: number,
  job: Pick<WatermarkJob, 'model' | 'params' | 'protection' | 'assets'>,
  seed: string,
  opts: { label?: string; watermark?: boolean } = {},
) {
  const { w, h } = fit(img.width, img.height, max);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  drawPhoto(ctx, img, w, h, opts.watermark === false ? { blur: 'none', blurRegion: 'all' } : job.protection);
  if (opts.watermark !== false) renderWatermark(ctx, w, h, job.model, job.params, seed, job.assets);
  if (opts.label) {
    // Número da foto (o cliente informa no pedido).
    const fs = Math.round(Math.max(12, w / 42));
    ctx.font = `700 ${fs}px system-ui, sans-serif`;
    const text = `${opts.label} · venart`;
    const tw = ctx.measureText(text).width;
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, h - fs * 1.8, tw + fs * 1.4, fs * 1.8);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, fs * 0.7, h - fs * 0.9);
  }
  return canvas;
}

const toJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a prévia.'))), 'image/jpeg', quality));

export async function decode(file: Blob) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Não foi possível decodificar a foto (arquivo corrompido?).');
  }
}

/** Gera prévia e miniatura protegidas. seed = id da foto (distribuição reproduzível). */
export async function makeVariants(file: Blob, label: string, seed: string, job: WatermarkJob) {
  const bitmap = await decode(file);
  try {
    const canvas = document.createElement('canvas');
    const preview = await toJpeg(renderPreview(canvas, bitmap, job.protection.maxSize, job, seed, { label }), 0.8);
    const thumb = await toJpeg(renderPreview(canvas, bitmap, THUMB, job, seed), 0.72);
    canvas.width = canvas.height = 0; // libera memória
    return { preview, thumb, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}
