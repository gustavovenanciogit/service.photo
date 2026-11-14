import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBusinessDaysISO, dueDate, dueDateForItems, dueLabel, monthGrid, parseDelivery, todayInManaus } from '../src/lib/schedule.ts';
import pricing from '../src/data/pricing.json' with { type: 'json' };

test('interpreta todos os prazos da tabela', () => {
  assert.deepEqual(parseDelivery('Em 24h'), { days: 1, business: false });
  assert.deepEqual(parseDelivery('Em 48h'), { days: 2, business: false });
  assert.deepEqual(parseDelivery('Em 48 a 72h'), { days: 3, business: false });
  assert.deepEqual(parseDelivery('Em 7 a 10 dias'), { days: 10, business: false });
  assert.deepEqual(parseDelivery('Em 10 dias úteis'), { days: 10, business: true });
  assert.equal(parseDelivery('A combinar'), null);
  assert.equal(parseDelivery(null), null);
  // Nenhum prazo da tabela atual fica sem interpretação.
  for (const p of pricing.packages) if ('delivery' in p && p.delivery) assert.ok(parseDelivery(p.delivery as string), p.id);
});

test('dias úteis pulam fim de semana', () => {
  assert.equal(addBusinessDaysISO('2026-11-13', 1), '2026-11-16'); // sexta → segunda
  assert.equal(addBusinessDaysISO('2026-11-14', 10), '2026-11-27'); // sábado + 10 úteis
  assert.equal(dueDate('2026-12-31', { days: 7, business: false }), '2027-01-07');
});

test('prazo de uma proposta aceita', () => {
  const ensaio = { n: 'Intermediário', c: 'Ensaios externos', d: ['Duração: 1h30', 'Entrega: Em 7 a 10 dias'] };
  const classico = { n: 'Clássico', c: 'Eventos sociais', d: ['Duração: 3 horas'] };
  assert.equal(dueDateForItems('2026-11-14', [ensaio]), '2026-11-24');
  assert.equal(dueDateForItems('2026-11-14', [classico]), '2026-11-27'); // 10 dias úteis (padrão da categoria)
  assert.equal(dueDateForItems('2026-11-14', [classico, { n: 'Entrega expressa (48h)' }]), '2026-11-16');
  assert.equal(dueDateForItems('2026-11-14', [{ n: 'Item personalizado' }]), '');
});

test('rótulos de prazo', () => {
  assert.deepEqual(dueLabel('2026-11-12', '2026-11-14'), { text: 'Atrasada 2 dias', tone: 'late' });
  assert.equal(dueLabel('2026-11-14', '2026-11-14').tone, 'today');
  assert.equal(dueLabel('2026-11-15', '2026-11-14').text, 'Vence amanhã');
  assert.equal(dueLabel('2026-11-20', '2026-11-14').tone, 'ok');
});

test('calendário e fuso de Manaus', () => {
  const nov = monthGrid(2026, 11); // 1/11/2026 é domingo
  assert.equal(nov[0]![0], '2026-11-01');
  assert.ok(nov.every((w) => w.length === 7));
  assert.equal(nov.flat().filter(Boolean).length, 30);
  assert.equal(todayInManaus(new Date('2026-11-15T03:30:00Z')), '2026-11-14'); // 23h30 em Manaus
});
