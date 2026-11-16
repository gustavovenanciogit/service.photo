/**
 * LOJA DE FOTOS — InfinitePay (Checkout Integrado)
 * ------------------------------------------------------------------
 * Fluxo:
 *   1. POST /links  { handle, items[{ quantity, price (centavos), description }], order_nsu, redirect_url, webhook_url, customer }
 *      → { url }  (página de pagamento da InfinitePay)
 *   2. Depois de pagar, o comprador volta para redirect_url com ?order_nsu, transaction_nsu, slug, capture_method, receipt_url
 *      e a InfinitePay envia o webhook { order_nsu, transaction_nsu, invoice_slug, amount, paid_amount, capture_method, ... }.
 *   3. O aviso NÃO é assinado: o servidor sempre confere com POST /payment_check { handle, order_nsu, transaction_nsu, slug }
 *      → { success, paid, amount, paid_amount, installments, capture_method } antes de liberar.
 * Importante: qualquer pessoa pode criar um link com o seu @ (handle). Por isso o VALOR pago é conferido com o do pedido.
 */
import type { Order, OrderStatus } from './orders.ts';

export const toCents = (reais: number) => Math.round(reais * 100);

/** Corpo do link de pagamento. */
export function buildInfiniteLink(
  order: Pick<Order, 'id' | 'token' | 'total' | 'photo_count' | 'buyer_name' | 'buyer_email'>,
  ev: { name: string },
  origin: string,
  handle: string,
) {
  return {
    handle,
    items: [
      {
        quantity: 1,
        price: toCents(order.total),
        description: `Fotos digitais — ${ev.name} (${order.photo_count} foto${order.photo_count === 1 ? '' : 's'})`.slice(0, 120),
      },
    ],
    order_nsu: order.id,
    redirect_url: `${origin}/pedido/${order.token}`,
    webhook_url: `${origin}/api/webhooks/infinitepay`,
    customer: { name: order.buyer_name, email: order.buyer_email },
  };
}

/** A InfinitePay responde a URL do pagamento em "url" (alguns exemplos usam "checkout_url"). */
export const linkUrl = (res: { url?: unknown; checkout_url?: unknown }) => {
  const u = typeof res.url === 'string' ? res.url : typeof res.checkout_url === 'string' ? res.checkout_url : '';
  return /^https:\/\//.test(u) || /^http:\/\/localhost[:/]/.test(u) ? u : ''; // localhost: só no simulador de testes
};

/** Dados da transação (vindos do retorno ou do webhook), validados. */
export interface InfiniteRef {
  order_nsu: string;
  transaction_nsu: string;
  slug: string;
}
const SAFE = /^[A-Za-z0-9_.:-]{1,100}$/;
export function parseInfiniteRef(src: Record<string, unknown>): InfiniteRef | null {
  const order_nsu = String(src.order_nsu ?? '');
  const transaction_nsu = String(src.transaction_nsu ?? '');
  const slug = String(src.invoice_slug ?? src.slug ?? '');
  if (!/^VNA-[A-Z0-9]{6}$/.test(order_nsu) || !SAFE.test(transaction_nsu) || !SAFE.test(slug)) return null;
  return { order_nsu, transaction_nsu, slug };
}

export interface InfiniteCheck {
  success?: boolean;
  paid?: boolean;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
}

/**
 * Resultado da consulta → situação do pedido.
 * Pago só se a InfinitePay confirmar E o valor for o do pedido (em centavos; aceita também em reais).
 * O "paid_amount" pode ser maior (juros do parcelamento pagos pelo cliente) — por isso compara "amount".
 */
export function checkInfinite(order: Pick<Order, 'total'>, r: InfiniteCheck): OrderStatus {
  if (!r.success || !r.paid) return 'pendente';
  const amount = Number(r.amount);
  const ok = amount === toCents(order.total) || Math.abs(amount - order.total) < 0.001;
  return ok ? 'pago' : 'divergente';
}

/** Forma de pagamento informada pela InfinitePay → código usado no painel. */
export const infiniteMethod = (capture: string | undefined) => (capture === 'pix' ? 'pix' : capture === 'credit_card' ? 'credit_card' : capture ?? '');
