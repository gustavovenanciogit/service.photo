// Copia o motor do ONNX Runtime Web (WebAssembly) para public/ort, servido pelo próprio site.
// Roda antes do build; a pasta public/ort não vai para o Git (é gerada a partir de node_modules).
import { copyFileSync, mkdirSync } from 'node:fs';
const src = 'node_modules/onnxruntime-web/dist/';
mkdirSync('public/ort', { recursive: true });
for (const f of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) copyFileSync(src + f, 'public/ort/' + f);
console.log('ONNX Runtime Web copiado para public/ort');
