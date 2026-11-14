import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyDigest, leadMessage } from '../src/lib/digest.ts';
import type { Job } from '../src/lib/crm.ts';

const job = (p: Partial<Job>): Job => ({
  id: 'j', kind: 'trabalho', title: 'Clássico', client_id: '', client_name: 'Ana', phone: '', proposal_id: '', date: '2026-11-14',
  start_time: '', end_time: '', location: '', blocks_date: true, status: 'agendado', due_date: '', delivery_link: '', delivered_at: '',
  notes: '', created_at: '', updated_at: '', ...p,
});

test('aviso de pedido novo', () => {
  const m = leadMessage({ source: 'simulador', name: 'Carla', phone: '(92) 96666-5555', service: 'Completo (Eventos sociais)', event_date: '2026-12-31', location: '', total: 1068, message: '' }, 'https://site.dev');
  assert.match(m, /Novo pedido pelo simulador/);
  assert.match(m, /Valor simulado: R\$ 1\.068/);
  assert.match(m, /Data: 31\/12/);
  assert.match(m, /https:\/\/wa\.me\/5592966665555/);
  assert.match(m, /https:\/\/site\.dev\/painel\/pedidos\//);
});

test('resumo diário: só o que importa hoje', () => {
  const today = '2026-11-14';
  const text = dailyDigest(
    {
      today,
      jobs: [
        job({ id: '1', title: 'Clássico', client_name: 'Ana', date: today, start_time: '19:00', location: 'Adrianópolis' }),
        job({ id: '2', title: 'Ensaio', client_name: 'Bia', date: '2026-11-01', status: 'editando', due_date: '2026-11-12' }), // atrasada
        job({ id: '3', title: 'Corrida', client_name: 'Assessoria', date: '2026-11-10', status: 'fotografado', due_date: '2026-11-15' }), // amanhã
        job({ id: '4', title: 'Premium', client_name: 'Caio', date: '2026-11-05', status: 'editando', due_date: '2026-11-25' }), // longe
        job({ id: '5', title: 'Entregue', date: '2026-11-01', status: 'entregue', due_date: '2026-11-10' }),
        job({ id: '6', kind: 'bloqueio', title: 'Indisponível', date: today }),
      ],
      clients: [
        { name: 'Academia X', stage: 'contacted', next_followup: '2026-11-13', phone: '' },
        { name: 'Perdido', stage: 'lost', next_followup: '2026-11-01', phone: '' },
      ],
      proposals: [{ client_name: 'Team Y', status: 'enviada', valid_until: '2026-11-15' }],
      newLeads: 2,
    },
    'https://site.dev',
  );
  assert.match(text, /19:00 · Clássico — Ana \(Adrianópolis\)/);
  assert.match(text, /Atrasada 2 dias: Ensaio — Bia/);
  assert.match(text, /Vence amanhã: Corrida — Assessoria/);
  assert.ok(!text.includes('Premium') && !text.includes('Entregue') && !text.includes('Indisponível') && !text.includes('Perdido'));
  assert.match(text, /Academia X \(atrasado desde 13\/11\)/);
  assert.match(text, /Team Y \(amanhã\)/);
  assert.match(text, /2 pedidos do site sem resposta/);
});

test('resumo vazio não é enviado', () => {
  assert.equal(dailyDigest({ today: '2026-11-14', jobs: [], clients: [], proposals: [], newLeads: 0 }, 'x'), '');
});
