import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { jpegSize } from '../src/lib/jpeg.ts';

const sharp = createRequire(import.meta.url)('sharp');

test('jpegSize lê baseline e progressivo, horizontal e vertical', async () => {
  for (const [w, h, progressive] of [[1200, 800, false], [800, 1200, true], [37, 1601, false]] as const) {
    const buf: Buffer = await sharp({ create: { width: w, height: h, channels: 3, background: '#888' } }).withMetadata().jpeg({ progressive }).toBuffer();
    assert.deepEqual(jpegSize(new Uint8Array(buf)), { width: w, height: h });
  }
  assert.equal(jpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), null);
  assert.equal(jpegSize(new Uint8Array([0xff, 0xd8, 0xff])), null);
});
