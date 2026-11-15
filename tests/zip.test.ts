import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, zipParts } from '../src/lib/zip.ts';

test('crc32 conhecido', () => assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926));

test('zip válido (conferido pelo Python)', () => {
  const files = [
    { name: 'venart-a-0001.jpg', data: new Uint8Array([1, 2, 3, 255]) },
    { name: 'pasta/ação.txt', data: new TextEncoder().encode('olá') },
  ];
  const parts = zipParts(files);
  const buf = Buffer.concat(parts.map((p) => Buffer.from(p)));
  const dir = mkdtempSync(join(tmpdir(), 'zip-'));
  const path = join(dir, 't.zip');
  writeFileSync(path, buf);
  const out = execFileSync('python3', ['-I', '-c', 'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print("|".join(z.namelist()));print(z.read("pasta/ação.txt").decode())', path]).toString();
  assert.match(out, /venart-a-0001\.jpg\|pasta\/ação\.txt/);
  assert.match(out, /olá/);
});
