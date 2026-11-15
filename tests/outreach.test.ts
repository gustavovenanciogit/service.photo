import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOutreach, buildQueue, channelOf, fillMessage } from '../src/lib/outreach.ts';
import { apresentacao, followUps, primeiroContato } from '../src/data/outreach.ts';
import { prospects } from '../src/data/prospects.ts';
import type { Client } from '../src/lib/crm.ts';

const T = '2026-11-16';
const cli = (p: Partial<Client>): Client => ({
  id: 'c', name: 'Academia X', type: 'academia', contact: '', phone: '', instagram: 'acadx', email: '', stage: 'prospect',
  next_followup: '', notes: '', hook: '', outreach_step: 0, last_contact: '', created_at: '', updated_at: '', ...p,
});

test('cadência: 1º contato → +3 dias → +4 dias (dia 7) → pausa 30 dias → fim', () => {
  let c = cli({});
  let r = applyOutreach(c, 'sent', T);
  assert.deepEqual(r, { stage: 'contacted', outreach_step: 1, next_followup: '2026-11-19', last_contact: T });
  c = { ...c, ...r };
  r = applyOutreach(c, 'sent', '2026-11-19');
  assert.equal(r.next_followup, '2026-11-23');
  c = { ...c, ...r };
  r = applyOutreach(c, 'sent', '2026-11-23');
  assert.equal(r.next_followup, '2026-12-23');
  c = { ...c, ...r };
  r = applyOutreach(c, 'sent', '2026-12-23');
  assert.equal(r.outreach_step, 4);
  assert.equal(r.next_followup, ''); // fim da cadência
  assert.equal(r.stage, 'contacted');
});

test('respondeu, sem interesse e pular hoje', () => {
  const c = cli({ outreach_step: 1, stage: 'contacted', next_followup: T });
  assert.equal(applyOutreach(c, 'replied', T).stage, 'negotiating');
  assert.equal(applyOutreach(c, 'lost', T).stage, 'lost');
  const s = applyOutreach(c, 'skip', T);
  assert.equal(s.next_followup, '2026-11-17');
  assert.equal(s.outreach_step, 1);
});

test('fila do dia: follow-ups vencidos primeiro e meta de novos', () => {
  const clients = [
    ...Array.from({ length: 8 }, (_, i) => cli({ id: `n${i}`, name: `Nova ${i}` })),
    cli({ id: 'f1', outreach_step: 1, stage: 'contacted', next_followup: '2026-11-14' }),
    cli({ id: 'f2', outreach_step: 2, stage: 'contacted', next_followup: T }),
    cli({ id: 'fut', outreach_step: 1, stage: 'contacted', next_followup: '2026-11-20' }),
    cli({ id: 'neg', stage: 'negotiating' }),
    cli({ id: 'hoje', outreach_step: 1, stage: 'contacted', last_contact: T, next_followup: '2026-11-19' }),
    cli({ id: 'pulou', next_followup: '2026-11-17' }),
  ];
  const q = buildQueue(clients, T, 5);
  assert.deepEqual(q.followUps.map((i) => i.client.id), ['f1', 'f2']);
  assert.equal(q.followUps[0]!.overdueDays, 2);
  assert.equal(q.fresh.length, 4); // meta 5 − 1 novo já enviado hoje
  assert.equal(q.waitingNew, 8);
  assert.equal(q.sentNewToday, 1);
});

test('novos: quem tem canal primeiro, depois ordem de cadastro', () => {
  const q = buildQueue(
    [
      cli({ id: 'sem', instagram: '', phone: '', created_at: '2026-11-01T00:00:00.001Z' }),
      cli({ id: 'b', created_at: '2026-11-01T00:00:00.003Z' }),
      cli({ id: 'a', created_at: '2026-11-01T00:00:00.002Z' }),
    ],
    T,
    5,
  );
  assert.deepEqual(q.fresh.map((i) => i.client.id), ['a', 'b', 'sem']);
});

test('mensagens: saudação, gancho e variáveis', () => {
  const vars = { apresentacao, site: 'https://site.dev' };
  const m = fillMessage(primeiroContato.academia!, cli({ name: 'Ribeiro JJ', contact: 'Carlos Ribeiro', hook: 'as turmas kids e adulto de vocês' }), vars);
  assert.match(m, /^Fala, Carlos! Tudo certo\? Sou o Gustavo/);
  assert.match(m, /Vi as turmas kids e adulto de vocês e curti muito\./);
  const sem = fillMessage(primeiroContato.assessoria!, cli({ hook: '' }), vars);
  assert.match(sem, /^Olá! Tudo bem\?/);
  assert.match(sem, /Acompanho o trabalho de vocês/);
  assert.match(fillMessage(followUps.follow1, cli({ name: 'KOHË' }), vars), /https:\/\/site\.dev\/#portfolio[\s\S]*para a KOHË/);
  for (const [k, t] of Object.entries({ ...primeiroContato, ...followUps })) assert.ok(!/\{\w+\}/.test(fillMessage(t, cli({}), vars)), k);
});

test('canal e lista sugerida', () => {
  assert.equal(channelOf({ instagram: 'x', phone: '' }), 'instagram');
  assert.equal(channelOf({ instagram: '', phone: '(92) 99148-3867' }), 'whatsapp');
  assert.equal(channelOf({ instagram: '', phone: '' }), null);
  assert.equal(prospects.length, 22);
  for (const p of prospects) {
    assert.ok(p.instagram || p.phone || p.notes.includes('⚠️'), p.name);
    if (p.instagram) assert.match(p.instagram, /^[\w.]+$/, p.name);
  }
});
