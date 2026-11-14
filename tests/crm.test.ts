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

import { parseLead } from '../src/lib/crm.ts';

test('pedido do site: limpa e limita os dados públicos', () => {
  assert.equal(parseLead({ source: 'outro', name: 'Ana' }).ok, false);
  assert.equal(parseLead({ source: 'formulario' }).ok, false);
  const r = parseLead({ source: 'simulador', name: 'Ana <b>', phone: '(92) 9 8888-7777<x>', package_id: 'evento-classico"; DROP', total: '1411.5', event_date: 'amanhã', message: 'x'.repeat(5000) });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.phone, '(92) 9 8888-7777');
  assert.equal(r.value.package_id, 'evento-classico'); // só letras minúsculas, números e hífen
  assert.equal(r.value.total, 1411.5);
  assert.equal(r.value.event_date, '');
  assert.equal(r.value.message.length, 1200);
});

import { parseJob } from '../src/lib/crm.ts';

test('trabalho: data obrigatória, horários e links validados', () => {
  assert.equal(parseJob({ title: 'Ensaio' }).ok, false);
  const r = parseJob({ title: 'Ensaio', date: '2026-12-10', start_time: '25:00', end_time: '17:30', delivery_link: 'javascript:alert(1)', status: 'entregue', delivered_at: '2026-12-15', proposal_id: 'x' });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.start_time, '');
  assert.equal(r.value.end_time, '17:30');
  assert.equal(r.value.delivery_link, '');
  assert.equal(r.value.delivered_at, '2026-12-15');
  assert.equal(r.value.proposal_id, '');
  assert.equal(r.value.blocks_date, true);
  const b = parseJob({ kind: 'bloqueio', date: '2026-12-24', status: 'entregue', due_date: '2026-12-30' });
  assert.ok(b.ok && b.value.title === 'Indisponível' && b.value.status === 'agendado' && b.value.due_date === '');
});
