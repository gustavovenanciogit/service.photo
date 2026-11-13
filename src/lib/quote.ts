/**
 * SIMULADOR DE ORÇAMENTO — CÁLCULO
 * ------------------------------------------------------------------
 * Funções puras (sem Astro): rodam no navegador e nos testes.
 * Os valores vêm de src/data/services.ts e as regras de src/data/simulator.ts.
 *
 * Regras (definidas pelo fotógrafo):
 * - Domingo/feriado: +20% sobre o pacote + horas extras.
 * - Após 22h: +15% sobre o pacote inteiro.
 * - Os dois acréscimos são calculados separadamente (não se acumulam um sobre o outro).
 * - Entrega expressa: valor fixo. Deslocamento: não é cobrado no simulador.
 * - Pagamento: 30% de sinal, 3x sem juros no cartão, 5% de desconto no Pix à vista.
 */
import { formatBRL } from './whatsapp.ts';

export interface QuoteRules {
  extraHour: number; // R$ por hora extra
  expressDelivery: number; // R$ entrega expressa
  sundayPct: number; // % domingo/feriado
  after22Pct: number; // % após 22h
  depositPct: number; // % de sinal
  pixDiscountPct: number; // % de desconto no Pix à vista
  installments: number; // parcelas sem juros no cartão
  maxExtraHours: number;
}

/** Dados mínimos de um pacote para o simulador. */
export interface QuotePackage {
  id: string;
  name: string;
  category: string; // título da categoria (para a mensagem)
  price: number;
  /** '/hora' = cobrado por hora (ex.: Corporativo). */
  hourly?: { min: number };
  subscription?: boolean;
  /** Mostrar a opção de entrega expressa? */
  allowExpress: boolean;
  /** Observações exibidas no resumo (ex.: "acima de 100 convidados: sob consulta"). */
  notes?: string[];
}

export interface QuoteInput {
  hours?: number; // horas contratadas (pacotes por hora)
  extraHours?: number;
  sunday?: boolean;
  after22?: boolean;
  express?: boolean;
  video?: boolean;
}

export interface QuoteLine {
  label: string;
  /** Valor em reais; `null` = sob consulta. */
  amount: number | null;
}

export interface QuoteResult {
  lines: QuoteLine[];
  total: number;
  subscription: boolean;
  /** Pagamento (não se aplica a assinaturas). */
  payment?: { deposit: number; pix: number; installment: number; installments: number };
}

const cents = (v: number) => Math.round(v * 100);
const reais = (c: number) => c / 100;
const pct = (c: number, p: number) => Math.round((c * p) / 100);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(n || 0)));

export function calculateQuote(pkg: QuotePackage, input: QuoteInput, rules: QuoteRules): QuoteResult {
  const lines: QuoteLine[] = [];

  // Assinatura: valor mensal fixo, sem extras.
  if (pkg.subscription) {
    lines.push({ label: `${pkg.name} (mensal)`, amount: pkg.price });
    if (input.video) lines.push({ label: 'Vídeo curto', amount: null });
    return { lines, total: pkg.price, subscription: true };
  }

  // Base do pacote (por hora ou valor fechado).
  let base: number;
  if (pkg.hourly) {
    const hours = clamp(input.hours ?? pkg.hourly.min, pkg.hourly.min, 24);
    base = cents(pkg.price) * hours;
    lines.push({ label: `${pkg.name} · ${hours}h × ${formatBRL(pkg.price)}`, amount: reais(base) });
  } else {
    base = cents(pkg.price);
    lines.push({ label: pkg.name, amount: reais(base) });
  }

  // Horas extras (não se aplica a pacotes por hora: basta aumentar as horas).
  const extraHours = pkg.hourly ? 0 : clamp(input.extraHours ?? 0, 0, rules.maxExtraHours);
  const extras = cents(rules.extraHour) * extraHours;
  if (extraHours > 0) {
    lines.push({ label: `Hora extra · ${extraHours} × ${formatBRL(rules.extraHour)}`, amount: reais(extras) });
  }

  let total = base + extras;

  if (input.sunday) {
    const v = pct(base + extras, rules.sundayPct);
    lines.push({ label: `Domingo ou feriado (+${rules.sundayPct}%)`, amount: reais(v) });
    total += v;
  }
  if (input.after22) {
    const v = pct(base, rules.after22Pct);
    lines.push({ label: `Após 22h (+${rules.after22Pct}% sobre o pacote)`, amount: reais(v) });
    total += v;
  }
  if (input.express && pkg.allowExpress) {
    const v = cents(rules.expressDelivery);
    lines.push({ label: 'Entrega expressa (48h)', amount: reais(v) });
    total += v;
  }
  if (input.video) lines.push({ label: 'Vídeo curto', amount: null });

  return {
    lines,
    total: reais(total),
    subscription: false,
    payment: {
      deposit: reais(pct(total, rules.depositPct)),
      pix: reais(total - pct(total, rules.pixDiscountPct)),
      installment: reais(Math.round(total / rules.installments)),
      installments: rules.installments,
    },
  };
}

/** Texto da mensagem de WhatsApp com a simulação. */
export function quoteMessage(pkg: QuotePackage, result: QuoteResult, extra: { date?: string } = {}): string {
  const money = (v: number | null) => (v === null ? 'sob consulta' : formatBRL(v));
  const out = ['Olá! Vim pelo seu site e fiz uma simulação de orçamento:', ''];
  out.push(`*Serviço:* ${pkg.name} (${pkg.category})`);
  for (const l of result.lines.slice(1)) out.push(`• ${l.label}: ${money(l.amount)}`);
  out.push('', `*Total estimado:* ${formatBRL(result.total)}${result.subscription ? ' por mês' : ''}`);
  if (result.payment) {
    const p = result.payment;
    out.push(`(Pix à vista: ${formatBRL(p.pix)} · ou ${p.installments}x de ${formatBRL(p.installment)} no cartão)`);
  }
  if (extra.date) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(extra.date);
    out.push(`*Data prevista:* ${m ? `${m[3]}/${m[2]}/${m[1]}` : extra.date}`);
  }
  out.push('', 'Gostaria de confirmar a disponibilidade e os detalhes.');
  return out.join('\n');
}
