import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  alignCrop, COSINE_MATCH, cosine, decodeVec, decodeYunet, detectorTensor, encodeVec, mainFace, nms, normalize,
  pilotMetrics, recognizerTensor, REF_POINTS, scaleFace, similarityTransform, usableFace, type Face,
} from '../src/lib/faces.ts';

const face = (x: number, y: number, w: number, h: number, score: number): Face => ({ x, y, w, h, score, landmarks: Array(10).fill(0) });

test('decodifica a saída do YuNet (grade, caixa e pontos)', () => {
  const out: Record<string, { data: Float32Array }> = {};
  for (const s of [8, 16, 32]) {
    const n = (640 / s) ** 2;
    out[`cls_${s}`] = { data: new Float32Array(n) };
    out[`obj_${s}`] = { data: new Float32Array(n) };
    out[`bbox_${s}`] = { data: new Float32Array(n * 4) };
    out[`kps_${s}`] = { data: new Float32Array(n * 10) };
  }
  // Uma detecção no passo 16, linha 5, coluna 10.
  const i = 5 * 40 + 10;
  out.cls_16!.data[i] = 0.9;
  out.obj_16!.data[i] = 1.2; // acima de 1 é limitado
  out.bbox_16!.data.set([0.5, 0.5, Math.log(4), Math.log(5)], i * 4);
  out.kps_16!.data.set([0, 0, 1, 0, 0.5, 0.5, 0, 1, 1, 1], i * 10);
  // Uma fraca, abaixo do limite.
  out.cls_8!.data[3] = 0.3;
  out.obj_8!.data[3] = 0.3;
  const faces = decodeYunet(out);
  assert.equal(faces.length, 1);
  const f = faces[0]!;
  assert.ok(Math.abs(f.score - Math.sqrt(0.9)) < 1e-6);
  // centro (10.5·16, 5.5·16) = (168, 88); tamanho 64×80
  assert.deepEqual([f.x, f.y, f.w, f.h].map((v) => Math.round(v)), [136, 48, 64, 80]);
  assert.deepEqual(f.landmarks.slice(0, 4), [160, 80, 176, 80]);
});

test('NMS remove duplicadas e mantém a de maior confiança', () => {
  const kept = nms([face(0, 0, 100, 100, 0.8), face(5, 5, 100, 100, 0.9), face(300, 300, 50, 50, 0.7)], 0.3);
  assert.equal(kept.length, 2);
  assert.equal(kept[0]!.score, 0.9);
});

test('escala, rosto principal e tamanho mínimo', () => {
  const f = scaleFace({ ...face(10, 20, 30, 40, 1), landmarks: [2, 4, 0, 0, 0, 0, 0, 0, 0, 0] }, 0.5);
  assert.deepEqual([f.x, f.y, f.w, f.h, f.landmarks[0], f.landmarks[1]], [20, 40, 60, 80, 4, 8]);
  assert.equal(mainFace([face(0, 0, 30, 30, 0.9), face(0, 0, 80, 80, 0.7)])!.w, 80);
  assert.equal(mainFace([]), null);
  assert.equal(usableFace(face(0, 0, 23, 60, 1)), false);
  assert.equal(usableFace(face(0, 0, 24, 24, 1)), true);
});

test('transformação de semelhança recupera rotação, escala e deslocamento conhecidos', () => {
  // Pontos de origem = inversa de uma transformação conhecida aplicada aos pontos de referência.
  const ang = 0.3;
  const k = 2.5;
  const a = Math.cos(ang) / k;
  const b = Math.sin(ang) / k;
  const tx = 12;
  const ty = -7;
  const det = a * a + b * b;
  const src: number[] = [];
  for (const [xd, yd] of REF_POINTS) {
    const u = xd! - tx;
    const v = yd! - ty;
    src.push((a * u + b * v) / det, (-b * u + a * v) / det);
  }
  const t = similarityTransform(src);
  for (const [got, want] of [[t.a, a], [t.b, b], [t.tx, tx], [t.ty, ty]] as const) assert.ok(Math.abs(got - want) < 1e-6, `${got} ≠ ${want}`);
});

test('recorte alinhado: pontos já na referência copiam a imagem; fora da imagem fica preto', () => {
  const w = 112;
  const h = 112;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba.set([i % 256, (i * 7) % 256, (i * 13) % 256, 255], i * 4);
  const crop = alignCrop(rgba, w, h, REF_POINTS.flat());
  const o = (50 * 112 + 40) * 4;
  assert.deepEqual([...crop.slice(o, o + 4)], [...rgba.slice(o, o + 4)]);
  // Rosto deslocado para fora: borda preta, alfa opaco.
  const off = alignCrop(rgba, w, h, REF_POINTS.flat().map((v, i) => (i % 2 ? v : v + 200)));
  assert.deepEqual([...off.slice(0, 4)], [0, 0, 0, 255]);
});

test('tensores: detector em BGR, reconhecedor em RGB (NCHW)', () => {
  const px = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255, 0, 0, 0, 255, 1, 2, 3, 255]);
  assert.deepEqual([...detectorTensor(px, 2)], [30, 60, 0, 3, 20, 50, 0, 2, 10, 40, 0, 1]);
  assert.deepEqual([...recognizerTensor(px, 2)], [10, 40, 0, 1, 20, 50, 0, 2, 30, 60, 0, 3]);
});

test('assinatura: normaliza, codifica e valida', () => {
  const v = normalize(Array.from({ length: 128 }, (_, i) => Math.sin(i)));
  assert.ok(Math.abs(cosine(v, v) - 1) < 1e-5);
  const txt = encodeVec(v);
  assert.equal(txt.length, 684);
  assert.deepEqual([...decodeVec(txt)!], [...v]);
  assert.equal(decodeVec('abc'), null);
  assert.equal(decodeVec('!!!'), null);
  assert.equal(decodeVec(encodeVec(new Float32Array(128).fill(2))), null); // não normalizada
  assert.equal(decodeVec(encodeVec(new Float32Array(128).fill(NaN))), null);
  assert.equal(decodeVec(encodeVec(new Float32Array(64))), null);
});

test('medição do piloto: precisão e cobertura por limite', () => {
  const results = [
    { photo: 'a', score: 0.7 },
    { photo: 'b', score: 0.5 },
    { photo: 'c', score: 0.4 },
    { photo: 'd', score: 0.3 },
  ];
  const correct = new Set(['a', 'b', 'd']);
  const wrong = new Set(['c']);
  const missing = new Set(['z']);
  assert.deepEqual(pilotMetrics(results, correct, wrong, missing, 0.45), { found: 2, precision: 1, recall: 2 / 4 });
  assert.deepEqual(pilotMetrics(results, correct, wrong, missing, 0.35), { found: 3, precision: 2 / 3, recall: 2 / 4 });
  assert.deepEqual(pilotMetrics(results, correct, wrong, missing, 0.2), { found: 4, precision: 3 / 4, recall: 3 / 4 });
  assert.deepEqual(pilotMetrics([], new Set(), new Set(), new Set(), 0.3), { found: 0, precision: null, recall: null });
});

// ───────── Modelos reais (mesmo caminho do navegador, com sharp no lugar do canvas) ─────────

test('modelos reais: mesma pessoa acima do limite, pessoas diferentes abaixo', async () => {
  const ort = await import('onnxruntime-web');
  const sharp = (await import('sharp')).default;
  ort.env.wasm.numThreads = 1;
  ort.env.logLevel = 'error';
  const det = await ort.InferenceSession.create(readFileSync('public/models/face/yunet-2023mar.onnx'), { logSeverityLevel: 3 });
  const rec = await ort.InferenceSession.create(
    Buffer.concat([readFileSync('public/models/face/sface-2021dec.onnx.part0'), readFileSync('public/models/face/sface-2021dec.onnx.part1')]),
    { logSeverityLevel: 3 },
  );

  async function faces(file: string) {
    const { data, info } = await sharp(`src/assets/portfolio/${file}`).rotate().resize(2000, 2000, { fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const k = 640 / Math.max(info.width, info.height);
    const small = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .resize(Math.round(info.width * k), Math.round(info.height * k))
      .extend({ right: 640 - Math.round(info.width * k), bottom: 640 - Math.round(info.height * k), background: '#000000' })
      .raw()
      .toBuffer();
    const out = await det.run({ input: new ort.Tensor('float32', detectorTensor(small), [1, 3, 640, 640]) });
    const found = decodeYunet(out as never).map((f) => scaleFace(f, k)).filter(usableFace);
    const list: (Face & { vec: Float32Array })[] = [];
    for (const f of found) {
      const crop = alignCrop(data, info.width, info.height, f.landmarks);
      const o = await rec.run({ data: new ort.Tensor('float32', recognizerTensor(crop), [1, 3, 112, 112]) });
      list.push({ ...f, vec: normalize(o.fc1!.data as Float32Array) });
    }
    return list;
  }

  const retrato = mainFace(await faces('ensaios/ensaio-estudio-retrato.jpg')) as Face & { vec: Float32Array };
  const perfil = mainFace(await faces('ensaios/ensaio-estudio-perfil.jpg')) as Face & { vec: Float32Array };
  assert.ok(retrato && perfil, 'rosto do ensaio não encontrado');
  const same = cosine(retrato.vec, perfil.vec);
  assert.ok(same >= COSINE_MATCH, `mesma pessoa deu ${same}`);

  const crowd = await faces('artes-marciais/jiu-jitsu-queda.jpg');
  assert.ok(crowd.length >= 5, `jiu-jitsu: só ${crowd.length} rostos`);
  for (const f of [...crowd, ...(await faces('esportes/corredora-arco.jpg'))]) {
    const s = cosine(retrato.vec, f.vec);
    assert.ok(s < COSINE_MATCH, `pessoa diferente deu ${s}`);
  }
  assert.equal((await faces('eventos-sociais/cha-revelacao-vela.jpg')).length, 0);
});
