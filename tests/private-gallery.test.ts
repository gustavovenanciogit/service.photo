import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timingSafeEqual } from 'node:crypto';
// Na Cloudflare, crypto.subtle.timingSafeEqual existe; no Node usamos o equivalente.
(crypto.subtle as unknown as { timingSafeEqual?: unknown }).timingSafeEqual ??= (a: ArrayBufferView, b: ArrayBufferView) =>
  timingSafeEqual(a as Uint8Array, b as Uint8Array);
const { PHOTO_ACCESS_HOURS, signPhotoAccess, verifyPhotoAccess } = await import('../worker/auth.ts');
import { parseEvent } from '../src/lib/events.ts';

const q = (s: string) => new URLSearchParams(s);

test('galeria privada: chave de acesso por foto, com validade', async () => {
  const now = Date.UTC(2026, 10, 20, 12);
  const k = q(await signPhotoAccess('segredo', 'ph_abc123', now));
  assert.ok(await verifyPhotoAccess('segredo', 'ph_abc123', k.get('x'), k.get('t'), now));
  // Outra foto, outro segredo ou chave adulterada: recusado.
  assert.equal(await verifyPhotoAccess('segredo', 'ph_outra1', k.get('x'), k.get('t'), now), false);
  assert.equal(await verifyPhotoAccess('outro', 'ph_abc123', k.get('x'), k.get('t'), now), false);
  assert.equal(await verifyPhotoAccess('segredo', 'ph_abc123', String(Number(k.get('x')) + 100), k.get('t'), now), false);
  assert.equal(await verifyPhotoAccess('segredo', 'ph_abc123', k.get('x'), 'x'.repeat(22), now), false);
  assert.equal(await verifyPhotoAccess('segredo', 'ph_abc123', null, null, now), false);
  assert.equal(await verifyPhotoAccess(undefined, 'ph_abc123', k.get('x'), k.get('t'), now), false);
  // Expira depois de PHOTO_ACCESS_HOURS.
  const later = now + (PHOTO_ACCESS_HOURS + 1) * 3_600_000;
  assert.equal(await verifyPhotoAccess('segredo', 'ph_abc123', k.get('x'), k.get('t'), later), false);
});

test('evento: opção de galeria privada', () => {
  const base = { name: 'Corrida', date: '2026-11-20' };
  assert.equal((parseEvent({ ...base, face_only: true }) as { value: { face_only: boolean } }).value.face_only, true);
  assert.equal((parseEvent({ ...base, face_only: 'on' }) as { value: { face_only: boolean } }).value.face_only, false);
  assert.equal((parseEvent(base) as { value: { face_only: boolean } }).value.face_only, false);
});
