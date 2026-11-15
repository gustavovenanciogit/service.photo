/**
 * Prévia com marca d'água e miniatura, geradas NO NAVEGADOR na hora do envio.
 * Assim o fotógrafo exporta só uma versão (a de venda) no Lightroom.
 *   - preview: lado maior 1200 px, marca d'água repetida em diagonal + número da foto
 *   - thumb:   lado maior 520 px, marca d'água mais leve
 */
const PREVIEW = 1200;
const THUMB = 520;

function fit(w: number, h: number, max: number) {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

function draw(bitmap: ImageBitmap, max: number, label: string, strength: number) {
  const { w, h } = fit(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);

  // Marca d'água em diagonal, cobrindo a foto toda (difícil de recortar).
  const size = Math.round(Math.max(w, h) / 11);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 7);
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(1, size / 28);
  const stepX = size * 5.2;
  const stepY = size * 2.4;
  const span = Math.hypot(w, h);
  for (let y = -span / 2; y <= span / 2; y += stepY) {
    const offset = (Math.round(y / stepY) % 2) * (stepX / 2);
    for (let x = -span / 2 - offset; x <= span / 2; x += stepX) {
      ctx.fillStyle = `rgba(255,255,255,${0.22 * strength})`;
      ctx.strokeStyle = `rgba(0,0,0,${0.18 * strength})`;
      ctx.strokeText('VENART', x, y);
      ctx.fillText('VENART', x, y);
    }
  }
  ctx.restore();

  // Número da foto (o cliente informa no pedido).
  if (label) {
    const fs = Math.round(Math.max(12, w / 40));
    ctx.font = `700 ${fs}px system-ui, sans-serif`;
    const text = `${label} · venart`;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
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

export async function makeVariants(file: Blob, label: string) {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Não foi possível decodificar a foto (arquivo corrompido?).');
  }
  try {
    const preview = await toJpeg(draw(bitmap, PREVIEW, label, 1), 0.8);
    const thumb = await toJpeg(draw(bitmap, THUMB, '', 0.8), 0.72);
    return { preview, thumb, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}
