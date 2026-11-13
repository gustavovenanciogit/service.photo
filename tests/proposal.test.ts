import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptMessage, addDays, decodeProposal, encodeProposal, fillTemplate, isExpired,
  newProposalId, proposalTotals, proposalUrl, sendMessage, type Proposal,
} from '../src/lib/proposal.ts';
import { clientTypes, proposalCatalog } from '../src/data/proposal.ts';

const sample = (): Proposal => ({
  v: 1,
  id: 'VEN-261113-K7QF',
  t: 'academia',
  cl: 'Academia Força & Técnica',
  r: 'Mestre João',
  msg: 'Olá! Proposta com acentuação: ç, ã, é — e emoji 🥋',
  em: '2026-11-13',
  val: '2026-11-20',
  it: [
    { n: 'Plano mensal', c: 'Academias de luta · Marketing da academia', p: 620, q: 1, m: true },
    { n: 'Graduação / Troca de faixa', p: 500, o: 550, q: 2 },
    { n: 'Hora extra', p: 150, q: 1 },
  ],
  pay: true,
});

test('link: codifica e decodifica sem perder acentos nem emoji', () => {
  const p = sample();
  const code = encodeProposal(p);
  assert.match(code, /^[A-Za-z0-9_-]+$/); // seguro para URL
  assert.deepEqual(decodeProposal(code), p);
  assert.match(proposalUrl('https://site.dev/', p), /^https:\/\/site\.dev\/proposta\/#d=/);
});

test('link corrompido ou incompleto não quebra a página', () => {
  assert.equal(decodeProposal('abc'), null);
  assert.equal(decodeProposal(''), null);
  const code = encodeProposal(sample());
  assert.equal(decodeProposal(code.slice(0, 40)), null);
});

test('totais separam avulsos e mensal e calculam a economia', () => {
  assert.deepEqual(proposalTotals(sample()), { once: 1150, monthly: 620, savings: 100 });
  assert.deepEqual(proposalTotals({ it: [{ n: 'x', p: 12.9, q: 3 }] }), { once: 38.7, monthly: 0, savings: 0 });
});

test('validade e datas', () => {
  assert.equal(addDays('2026-11-28', 7), '2026-12-05');
  assert.equal(isExpired({ val: '2026-11-20' }, '2026-11-20'), false); // vale até o fim do dia
  assert.equal(isExpired({ val: '2026-11-20' }, '2026-11-21'), true);
  assert.equal(isExpired({}, '2030-01-01'), false);
});

test('código da proposta', () => {
  assert.match(newProposalId(new Date('2026-11-13T12:00:00Z'), () => 0), /^VEN-261113-AAAA$/);
});

test('modelos de texto', () => {
  assert.equal(fillTemplate('{saudacao} Proposta para {cliente}.', { cliente: 'Team X', responsavel: 'Ana' }), 'Olá, Ana! Proposta para Team X.');
  assert.equal(fillTemplate('{saudacao} Oi {cliente}', { cliente: 'Team X' }), 'Olá! Oi Team X');
  clientTypes.forEach((t) => assert.ok(t.intro.includes('{saudacao}'), t.id));
});

test('mensagens de WhatsApp', () => {
  const p = sample();
  const send = sendMessage(p, 'https://x/proposta/#d=1', 'Venart');
  assert.match(send, /^Olá, Mestre João! Tudo bem\?/);
  assert.match(send, /válida até 20\/11\/2026/);
  assert.match(acceptMessage(p), /proposta VEN-261113-K7QF para Academia Força & Técnica/);
  assert.match(acceptMessage(p), /Total: R\$ 1\.150 \+ R\$ 620\/mês\./);
});

test('catálogo do gerador: sem compras da Fotto nem percentuais', () => {
  const ids = proposalCatalog.flatMap((g) => g.items.map((i) => i.id));
  assert.ok(ids.includes('evento-classico') && ids.includes('extra-hora') && ids.includes('plano-atleta'));
  assert.ok(!ids.includes('foto-avulsa') && !ids.includes('extra-domingos-feriados') && !ids.includes('extra-video-curto'));
  const plano = proposalCatalog.flatMap((g) => g.items).find((i) => i.id === 'plano-mensal-assessoria')!;
  assert.equal(plano.monthly, true);
});
