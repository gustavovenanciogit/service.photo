// Gera public/og-image.png (1200x630) — imagem de compartilhamento em redes sociais.
// Uso: node scripts/og-image.mjs   (rode de novo se mudar o nome/texto)
import sharp from 'sharp';

const name = process.argv[2] ?? 'FOTOGRAFIA ESPORTIVA, ENSAIOS E EVENTOS';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#070A08"/>
  <rect x="40" y="40" width="1120" height="550" rx="36" fill="#0F1A13" stroke="#123222" stroke-width="2"/>
  <circle cx="1010" cy="315" r="120" fill="none" stroke="#8BE07A" stroke-width="22"/>
  <circle cx="1010" cy="315" r="44" fill="#8BE07A"/>
  <text x="100" y="200" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="30" letter-spacing="6" fill="#8BE07A">VENART · FOTÓGRAFO EM MANAUS</text>
  <text x="100" y="300" font-family="Arial Narrow, Arial, sans-serif" font-weight="800" font-size="74" fill="#F5FAF5">SEUS MELHORES</text>
  <text x="100" y="380" font-family="Arial Narrow, Arial, sans-serif" font-weight="800" font-size="74" fill="#F5FAF5">MOMENTOS MERECEM</text>
  <text x="100" y="460" font-family="Arial Narrow, Arial, sans-serif" font-weight="800" font-size="74" fill="#8BE07A">SER REGISTRADOS.</text>
  <text x="100" y="530" font-family="Arial, sans-serif" font-size="26" fill="#9BA59E">${name}</text>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile('public/og-image.png');
console.log('public/og-image.png gerado');
