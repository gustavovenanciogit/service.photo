/**
 * RELATÓRIOS DA LOJA E LIMITE DO MEI (Fase 3)
 * ------------------------------------------------------------------
 * Funções puras: o painel calcula tudo a partir dos pedidos e dos lançamentos manuais.
 * Contam como venda só os pedidos PAGOS (reembolsados, testes e divergentes ficam de fora),
 * no mês/ano em que foram pagos (horário de Manaus).
 */
import type { Order } from './orders.ts';

export interface RevenueEntry {
  id: string;
  month: string; // AAAA-MM
  amount: number;
  description: string;
  created_at: string;
}

type O = Pick<Order, 'status' | 'paid_at' | 'total' | 'photo_count' | 'payment_method' | 'provider' | 'event_id' | 'event_name'>;

/** AAAA-MM em Manaus (UTC−4, sem horário de verão). */
export const manausMonth = (iso: string) => (iso ? new Date(Date.parse(iso) - 4 * 3_600_000).toISOString().slice(0, 7) : '');

export const isSale = (o: Pick<O, 'status' | 'paid_at'>) => o.status === 'pago' && !!o.paid_at;

const methodGroup = (m: string) => (m === 'pix' || m === 'bank_transfer' ? 'pix' : m === 'manual' ? 'manual' : 'cartao');
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface MonthRow {
  month: string;
  orders: number;
  photos: number;
  total: number;
  ticket: number;
  pix: number;
  cartao: number;
  manual: number;
  other: number; // lançamentos manuais (serviços etc.)
}

/** Resumo mês a mês de um ano (12 linhas). */
export function monthlySummary(orders: O[], entries: Pick<RevenueEntry, 'month' | 'amount'>[], year: number): MonthRow[] {
  const rows = Array.from({ length: 12 }, (_, i) => ({ month: `${year}-${String(i + 1).padStart(2, '0')}`, orders: 0, photos: 0, total: 0, ticket: 0, pix: 0, cartao: 0, manual: 0, other: 0 }));
  for (const o of orders) {
    if (!isSale(o)) continue;
    const m = manausMonth(o.paid_at);
    const row = rows.find((r) => r.month === m);
    if (!row) continue;
    row.orders++;
    row.photos += o.photo_count;
    row.total += o.total;
    row[methodGroup(o.payment_method)] += o.total;
  }
  for (const e of entries) {
    const row = rows.find((r) => r.month === e.month);
    if (row) row.other += e.amount;
  }
  return rows.map((r) => ({
    ...r,
    total: round2(r.total),
    pix: round2(r.pix),
    cartao: round2(r.cartao),
    manual: round2(r.manual),
    other: round2(r.other),
    ticket: r.orders ? round2(r.total / r.orders) : 0,
  }));
}

/** Vendas por evento (pedidos pagos), do maior para o menor. */
export function byEvent(orders: O[], year?: number) {
  const map = new Map<string, { event_id: string; event_name: string; orders: number; photos: number; total: number }>();
  for (const o of orders) {
    if (!isSale(o) || (year && !manausMonth(o.paid_at).startsWith(String(year)))) continue;
    const r = map.get(o.event_id) ?? { event_id: o.event_id, event_name: o.event_name, orders: 0, photos: 0, total: 0 };
    r.orders++;
    r.photos += o.photo_count;
    r.total = round2(r.total + o.total);
    map.set(o.event_id, r);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/** Limite do MEI no ano (proporcional no ano de abertura). */
export function meiLimit(year: number, cfg: { annualLimit: number; monthlyLimit: number; openedAt: string }) {
  const m = /^(\d{4})-(\d{2})/.exec(cfg.openedAt);
  if (m && Number(m[1]) === year) return cfg.monthlyLimit * (12 - Number(m[2]) + 1);
  return cfg.annualLimit;
}

export type MeiLevel = 'ok' | 'atencao' | 'alerta' | 'excedido';
export function meiStatus(revenue: number, limit: number): { pct: number; level: MeiLevel; remaining: number } {
  const pct = limit > 0 ? revenue / limit : 0;
  const level: MeiLevel = pct > 1 ? 'excedido' : pct >= 0.9 ? 'alerta' : pct >= 0.7 ? 'atencao' : 'ok';
  return { pct, level, remaining: round2(Math.max(0, limit - revenue)) };
}

const methodLabel = (m: string) =>
  ({ pix: 'Pix', bank_transfer: 'Pix', credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito', manual: 'Liberado manualmente', account_money: 'Saldo Mercado Pago', ticket: 'Boleto' })[m] ?? m;

/** Planilha (CSV com ";" e vírgula decimal — abre direto no Excel em português). */
export function ordersCsv(orders: (O & Pick<Order, 'id' | 'created_at' | 'buyer_name' | 'buyer_email' | 'buyer_phone'>)[]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"` : s;
  };
  const brDate = (iso: string) => (iso ? new Date(Date.parse(iso) - 4 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ') : '');
  const head = ['Pedido', 'Data do pedido', 'Data do pagamento', 'Situação', 'Evento', 'Fotos', 'Valor (R$)', 'Forma de pagamento', 'Meio', 'Comprador', 'E-mail', 'WhatsApp'];
  const lines = orders.map((o) =>
    [
      o.id,
      brDate(o.created_at),
      brDate(o.paid_at),
      o.status,
      o.event_name,
      o.photo_count,
      o.total.toFixed(2).replace('.', ','),
      methodLabel(o.payment_method),
      o.provider === 'infinitepay' ? 'InfinitePay' : 'Mercado Pago',
      o.buyer_name,
      o.buyer_email,
      o.buyer_phone,
    ]
      .map(esc)
      .join(';'),
  );
  return `﻿${[head.join(';'), ...lines].join('\r\n')}\r\n`;
}
