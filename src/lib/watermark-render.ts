/**
 * MARCA D'ÁGUA — desenho no <canvas> (roda só no navegador: editor do painel e envio das fotos).
 * Usa o layout de watermark-models.ts; o resultado vira os pixels da prévia JPEG.
 */
import { layout, type ModelId, type ModelParams, type ProtectionSettings, type Tone } from './watermark-models';

export interface RenderAssets {
  /** Logotipo enviado (PNG). null = símbolo padrão da Venart (anel + ponto). */
  logo: CanvasImageSource | null;
  font: string; // família da fonte (já carregada)
}

function hexLuma(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** Cor do preenchimento e do contorno (o contorno garante leitura em fundos claros e escuros). */
export function markColors(p: Pick<ModelParams, 'color' | 'customColor'>, tone: Tone) {
  const light = { fill: '#FFFFFF', stroke: 'rgba(0,0,0,0.75)' };
  const dark = { fill: '#111111', stroke: 'rgba(255,255,255,0.8)' };
  if (p.color === 'white') return light;
  if (p.color === 'black') return dark;
  if (p.color === 'custom') return { fill: p.customColor, stroke: hexLuma(p.customColor) > 0.55 ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.8)' };
  return tone === 'dark' ? dark : light;
}

const tintCache = new WeakMap<object, Map<string, HTMLCanvasElement>>();
function tinted(logo: CanvasImageSource & { width: number; height: number }, color: string) {
  let m = tintCache.get(logo);
  if (!m) tintCache.set(logo, (m = new Map()));
  let c = m.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = logo.width;
    c.height = logo.height;
    const x = c.getContext('2d')!;
    x.drawImage(logo, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    m.set(color, c);
  }
  return c;
}

function drawLogo(ctx: CanvasRenderingContext2D, s: number, col: { fill: string; stroke: string }, assets: RenderAssets) {
  if (assets.logo) {
    const lg = assets.logo as CanvasImageSource & { width: number; height: number };
    const ratio = lg.width / lg.height || 1;
    const lw = ratio >= 1 ? s : s * ratio;
    const lh = ratio >= 1 ? s / ratio : s;
    ctx.shadowColor = col.stroke;
    ctx.shadowBlur = Math.max(1, s * 0.05);
    ctx.drawImage(tinted(lg, col.fill), -lw / 2, -lh / 2, lw, lh);
    ctx.shadowBlur = 0;
    return lw;
  }
  // Símbolo padrão (mesmo desenho do ícone do site): anel + ponto.
  const r = s * 0.5 * 0.72;
  const ring = s * 0.14;
  ctx.lineWidth = ring + Math.max(1.5, s * 0.06);
  ctx.strokeStyle = col.stroke;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.17 + s * 0.03, 0, Math.PI * 2);
  ctx.fillStyle = col.stroke;
  ctx.fill();
  ctx.lineWidth = ring;
  ctx.strokeStyle = col.fill;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.17, 0, Math.PI * 2);
  ctx.fillStyle = col.fill;
  ctx.fill();
  return s;
}

function drawText(ctx: CanvasRenderingContext2D, text: string, px: number, col: { fill: string; stroke: string }, assets: RenderAssets, align: CanvasTextAlign = 'center') {
  ctx.font = `800 ${px}px ${assets.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.2, px * 0.09);
  ctx.strokeStyle = col.stroke;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = col.fill;
  ctx.fillText(text, 0, 0);
  return ctx.measureText(text).width;
}

/** Desenha a marca d'água (no lugar) sobre o que já está no canvas. */
export function renderWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, model: ModelId, p: ModelParams, seed: string, assets: RenderAssets) {
  const marks = layout(model, w, h, p, seed);
  const text = p.text || 'VENART';
  // Faixas primeiro, marcas por cima.
  marks.sort((a, b) => Number(b.t === 'band') - Number(a.t === 'band'));
  for (const m of marks) {
    const col = markColors(p, m.tone);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, m.a));
    ctx.translate(m.x, m.y);
    ctx.rotate(m.r);
    if (m.t === 'band') {
      // Faixa "fosca": fundo claro + bordas escuras — aparece em fotos claras e escuras.
      const fill = p.color === 'custom' ? p.customColor : p.color === 'black' ? '#111111' : '#FFFFFF';
      ctx.fillStyle = fill;
      ctx.fillRect(-m.len / 2, -m.thick / 2, m.len, m.thick);
      ctx.globalAlpha = Math.min(1, m.a * 1.6);
      ctx.fillStyle = p.color === 'black' ? '#FFFFFF' : '#000000';
      const edge = Math.max(1, m.thick * 0.07);
      ctx.fillRect(-m.len / 2, -m.thick / 2 - edge, m.len, edge);
      ctx.fillRect(-m.len / 2, m.thick / 2, m.len, edge);
    } else if (m.t === 'logo') {
      if (p.useLogo) drawLogo(ctx, m.s, col, assets);
      else drawText(ctx, text, m.s * 0.55, col, assets);
    } else if (m.t === 'text') {
      drawText(ctx, text, m.s, col, assets);
    } else {
      // combo: símbolo + nome lado a lado (centralizados)
      const px = m.s * 0.78;
      ctx.font = `800 ${px}px ${assets.font}`;
      const tw = ctx.measureText(text).width;
      if (p.useLogo) {
        const gap = m.s * 0.28;
        const total = m.s + gap + tw;
        ctx.save();
        ctx.translate(-total / 2 + m.s / 2, 0);
        drawLogo(ctx, m.s, col, assets);
        ctx.restore();
        ctx.save();
        ctx.translate(-total / 2 + m.s + gap, 0);
        drawText(ctx, text, px, col, assets, 'left');
        ctx.restore();
      } else drawText(ctx, text, px, col, assets);
    }
    ctx.restore();
  }
  return marks.length;
}

/** Desenha a foto já com o desfoque de proteção (só na prévia; o original nunca é alterado). */
export function drawPhoto(ctx: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number, prot: Pick<ProtectionSettings, 'blur' | 'blurRegion'>) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  if (prot.blur === 'none') return;
  // Desfoque por redução e ampliação (resultado igual em todos os navegadores).
  const k = { leve: 0.18, moderado: 0.09, forte: 0.045 }[prot.blur];
  const small = document.createElement('canvas');
  small.width = Math.max(4, Math.round(w * k));
  small.height = Math.max(4, Math.round(h * k));
  const sx = small.getContext('2d')!;
  sx.imageSmoothingQuality = 'high';
  sx.drawImage(img, 0, 0, small.width, small.height);
  ctx.save();
  if (prot.blurRegion === 'edges') {
    // Mantém o centro nítido: desfoca só fora de uma elipse central.
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.ellipse(w / 2, h / 2, w * 0.32, h * 0.32, 0, 0, Math.PI * 2, true);
    ctx.clip('evenodd');
  }
  ctx.drawImage(small, 0, 0, w, h);
  ctx.restore();
}
