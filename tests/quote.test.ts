import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuote, quoteMessage, type QuotePackage } from '../src/lib/quote.ts';
import { quoteRules, simulatorPackages } from '../src/data/simulator.ts';
import { packages } from '../src/data/services.ts';
import { paymentTerms } from '../src/config/site.ts';

const pkg = (id: string) => simulatorPackages.find((p) => p.id === id)!;

// Pacotes de exemplo FIXOS para testar a matemática (independem dos preços atuais da tabela,
// que podem mudar pelo painel).
const classico: QuotePackage = { id: 'teste-classico', name: 'Clássico', category: 'Eventos sociais', price: 690, allowExpress: true };
const porHora: QuotePackage = { id: 'teste-hora', name: 'Corporativo', category: 'Eventos sociais', price: 180, hourly: { min: 2 }, allowExpress: true };
const plano: QuotePackage = { id: 'teste-plano', name: 'Plano atleta', category: 'Atletas de luta', price: 590, subscription: true, allowExpress: false };

test('regras batem com a Tabela 2026', () => {
  assert.equal(quoteRules.extraHour, 150);
  assert.equal(quoteRules.expressDelivery, 120);
  const label = (id: string) => packages.find((p) => p.id === id)!.priceLabel;
  assert.equal(label('extra-domingos-feriados'), `+${quoteRules.sundayPct}%`);
  assert.equal(label('extra-apos-22h'), `+${quoteRules.after22Pct}%`);
  assert.deepEqual(
    paymentTerms.map((t) => t.value),
    [`${quoteRules.depositPct}%`, `${quoteRules.installments}x`, `${quoteRules.pixDiscountPct}%`],
  );
});

test('simulador não inclui compras da Fotto nem adicionais', () => {
  const ids = simulatorPackages.map((p) => p.id);
  assert.ok(!ids.includes('foto-avulsa'));
  assert.ok(!ids.includes('todas-as-minhas-fotos'));
  assert.ok(!ids.some((id) => id.startsWith('extra-')));
});

test('pacote simples, sem extras', () => {
  const r = calculateQuote(classico, {}, quoteRules);
  assert.equal(r.total, 690);
  assert.deepEqual(r.payment, { deposit: 207, pix: 655.5, installment: 230, installments: 3 });
});

test('domingo: +20% sobre pacote + horas extras; após 22h: +15% só sobre o pacote', () => {
  // Clássico 690 + 2h extras (300) = 990
  // domingo: 20% de 990 = 198 · após 22h: 15% de 690 = 103,50 · expressa: 120
  const r = calculateQuote(classico, { extraHours: 2, sunday: true, after22: true, express: true }, quoteRules);
  assert.deepEqual(
    r.lines.map((l) => l.amount),
    [690, 300, 198, 103.5, 120],
  );
  assert.equal(r.total, 1411.5);
  assert.equal(r.payment!.pix, 1340.92); // 1411,50 − 5% (70,575 → 70,58)
});

test('corporativo é por hora, com mínimo de 2h e sem hora extra', () => {
  const p = porHora;
  assert.equal(calculateQuote(p, { hours: 1 }, quoteRules).total, 360); // sobe para o mínimo
  const r = calculateQuote(p, { hours: 4, extraHours: 3, sunday: true }, quoteRules);
  assert.equal(r.total, 720 + 144); // 4 × 180 + 20%
});

test('assinatura: valor mensal fixo, sem extras nem pagamento à vista', () => {
  const r = calculateQuote(plano, { extraHours: 3, sunday: true, express: true }, quoteRules);
  assert.equal(r.total, 590);
  assert.equal(r.subscription, true);
  assert.equal(r.payment, undefined);
});

test('entrega expressa some quando a entrega já é em 24h/48h', () => {
  assert.equal(pkg('atleta-foco').allowExpress, false);
  assert.equal(pkg('ensaio-premium').allowExpress, true);
  const af = pkg('atleta-foco');
  assert.equal(calculateQuote(af, { express: true }, quoteRules).total, af.price); // expressa ignorada
});

test('catálogo do simulador: corporativo por hora (mín. 2h) e planos como assinatura', () => {
  assert.deepEqual(pkg('evento-corporativo').hourly, { min: 2 });
  assert.equal(pkg('plano-atleta').subscription, true);
});

test('vídeo curto entra como sob consulta, sem somar', () => {
  const r = calculateQuote(classico, { video: true }, quoteRules);
  assert.equal(r.total, 690);
  assert.equal(r.lines.at(-1)!.amount, null);
});

test('mensagem do WhatsApp', () => {
  const p = classico;
  const r = calculateQuote(p, { extraHours: 1, sunday: true }, quoteRules);
  const m = quoteMessage(p, r, { date: '2026-12-20' });
  assert.match(m, /\*Serviço:\* Clássico \(Eventos sociais\)/);
  assert.match(m, /• Hora extra · 1 × R\$ 150: R\$ 150/);
  assert.match(m, /• Domingo ou feriado \(\+20%\): R\$ 168/);
  assert.match(m, /\*Total estimado:\* R\$ 1\.008/);
  assert.match(m, /Pix à vista: R\$ 957,60 · ou 3x de R\$ 336 no cartão/);
  assert.match(m, /\*Data prevista:\* 20\/12\/2026/);
});
