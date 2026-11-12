import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBRL, formatDateBR, messages, whatsappLink } from '../src/lib/whatsapp.ts';

test('formata valores em reais', () => {
  assert.equal(formatBRL(350), 'R$ 350');
  assert.equal(formatBRL(1290), 'R$ 1.290');
  assert.equal(formatBRL(99.9), 'R$ 99,90');
});

test('mensagem do pacote usa nome e preço dinamicamente', () => {
  assert.equal(
    messages.package('Ensaio Esportivo', 350),
    'Olá! Vim pelo seu site e tenho interesse no pacote Ensaio Esportivo, anunciado por R$ 350. Gostaria de consultar sua disponibilidade e saber como funciona o agendamento.',
  );
});

test('sem preço público, a mensagem pede o valor (não inventa preço)', () => {
  const m = messages.package('Plano mensal', null);
  assert.ok(!m.includes('R$'));
  assert.match(m, /saber o valor/);
});

test('link do WhatsApp com e sem número', () => {
  assert.equal(whatsappLink('+55 (92) 99999-0000', 'Oi'), 'https://wa.me/5592999990000?text=Oi');
  assert.equal(whatsappLink('', 'Olá! A&B'), 'https://wa.me/?text=Ol%C3%A1!%20A%26B');
});

test('mensagem do formulário inclui só campos preenchidos', () => {
  const m = messages.form({ name: ' Ana ', service: 'Ensaio gestante', date: '2026-12-05', location: '', message: '' });
  assert.match(m, /\*Nome:\* Ana\n/);
  assert.match(m, /\*Data prevista:\* 05\/12\/2026/);
  assert.ok(!m.includes('Local'));
  assert.ok(!m.includes('Mensagem'));
  assert.equal(formatDateBR('2026-01-31'), '31/01/2026');
});

test('mensagem do FAQ cita a pergunta', () => {
  assert.match(messages.faq('Posso remarcar?'), /"Posso remarcar\?"/);
});
