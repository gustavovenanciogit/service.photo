import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayStatus, parseClient, parseProposal } from '../src/lib/crm.ts';

test('cliente: nome obrigatório e campos limpos', () => {
  assert.equal(parseClient({}).ok, false);
  const r = parseClient({ name: '  Team Nogueira ', instagram: '@@team.nogueira!', stage: 'xpto', next_followup: '20/11/2026', phone: '(92) 99999-0000<script>' });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.name, 'Team Nogueira');
  assert.equal(r.value.instagram, 'team.nogueira');
  assert.equal(r.value.stage, 'prospect'); // etapa inválida vira padrão
  assert.equal(r.value.next_followup, ''); // só aceita AAAA-MM-DD
  assert.equal(r.value.phone, '(92) 99999-0000');
});

test('proposta: código, valores e status validados', () => {
  assert.equal(parseProposal({ id: 'xx', client_name: 'A' }).ok, false);
  assert.equal(parseProposal({ id: 'VEN-261113-AB12', client_name: '' }).ok, false);
  const r = parseProposal({ id: 'VEN-261113-AB12', client_name: 'Academia', total_once: '1080.005', total_monthly: -5, status: 'hackeado', url: 'javascript:alert(1)', data: { v: 1 } });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.total_once, 1080.01);
  assert.equal(r.value.total_monthly, 0);
  assert.equal(r.value.status, 'enviada');
  assert.equal(r.value.url, ''); // só http(s)
  assert.equal(r.value.data, '{"v":1}');
});

test('status "vencida" calculado pela validade', () => {
  assert.equal(displayStatus({ status: 'enviada', valid_until: '2026-11-10' }, '2026-11-13').id, 'vencida');
  assert.equal(displayStatus({ status: 'enviada', valid_until: '2026-11-13' }, '2026-11-13').id, 'enviada');
  assert.equal(displayStatus({ status: 'aceita', valid_until: '2026-11-01' }, '2026-11-13').id, 'aceita');
});
