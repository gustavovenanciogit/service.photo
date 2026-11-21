/**
 * CUPONS DE DESCONTO — regras puras (painel, servidor e testes)
 * ------------------------------------------------------------------
 * - Valores em CENTAVOS inteiros (nada de ponta flutuante sem controle).
 * - Datas digitadas no horário de Manaus (America/Manaus = UTC−4, sem horário de verão) e
 *   guardadas em ISO (UTC).
 * - Um cupom por pedido. O "desconto automático" da plataforma é o pacote ("todas as suas
 *   fotos" mais barato que as avulsas): só acumula com o cupom se o cupom permitir.
 */

export type CouponKind = 'percent' | 'fixed';
export type CouponApplies = 'single' | 'pack' | 'both';
export type CouponScope = 'events' | 'all';

export interface Coupon {
  id: string;
  code: string; // sempre em maiúsculas
  kind: CouponKind;
  /** percent: centésimos de ponto percentual (10% = 1000); fixed: centavos (R$ 5,00 = 500) */
  value: number;
  max_uses: number; // 0 = ilimitado
  per_customer: number; // 0 = sem limite individual
  starts_at: string; // ISO; vazio = imediatamente
  ends_at: string; // ISO; vazio = sem validade
  scope: CouponScope;
  event_ids: string[]; // quando scope = 'events'
  min_cents: number; // 0 = sem valor mínimo
  applies: CouponApplies;
  stackable: boolean; // acumula com o desconto do pacote
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type CouponStatus = 'agendado' | 'ativo' | 'esgotado' | 'expirado' | 'desativado';
export const COUPON_STATUS: Record<CouponStatus, { label: string; tone: 'brand' | 'neutral' | 'amber' | 'muted' | 'red' }> = {
  ativo: { label: 'Ativo', tone: 'brand' },
  agendado: { label: 'Agendado', tone: 'neutral' },
  esgotado: { label: 'Esgotado', tone: 'amber' },
  expirado: { label: 'Expirado', tone: 'muted' },
  desativado: { label: 'Desativado', tone: 'red' },
};

// ───────── Código ─────────

export const CODE_RE = /^[A-Z0-9_-]{3,24}$/;
/** Maiúsculas, sem espaços e sem acentos. */
export const normalizeCode = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();

/** Código aleatório legível (sem 0/O, 1/I/L). */
export function generateCode(prefix = 'VENART', rand: () => number = Math.random) {
  const abc = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 5; i++) s += abc[Math.floor(rand() * abc.length)];
  return `${normalizeCode(prefix).slice(0, 12)}${s}`;
}

// ───────── Fuso de Manaus ─────────

/** "2026-11-21T14:30" (horário de Manaus) → ISO UTC. */
export function manausToISO(local: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return '';
  const t = Date.parse(`${local}:00-04:00`);
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
}
/** ISO UTC → "2026-11-21T14:30" no horário de Manaus (para o campo do formulário). */
export function isoToManaus(iso: string) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t - 4 * 3_600_000).toISOString().slice(0, 16);
}
/** "21/11/2026 14:30" (Manaus). */
export const formatManaus = (iso: string) => {
  const l = isoToManaus(iso);
  return l ? `${l.slice(8, 10)}/${l.slice(5, 7)}/${l.slice(0, 4)} ${l.slice(11, 16)}` : '';
};

// ───────── Validação (painel) ─────────

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const int = (v: unknown) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.')));
/** "12,50" / 12.5 → 1250 centavos (arredondamento exato em centavos). */
export const toCents = (v: unknown) => {
  const n = int(v);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

export type CouponInput = Omit<Coupon, 'id' | 'created_at' | 'updated_at'>;

/**
 * Valida o formulário do cupom. Datas chegam como "AAAA-MM-DDTHH:mm" (Manaus).
 * value: percent em % (ex.: 10 ou 12,5) ou fixed em reais (ex.: 5,00).
 */
export function parseCoupon(input: unknown): Result<CouponInput> {
  const o = (input ?? {}) as Record<string, unknown>;
  const code = normalizeCode(o.code);
  if (!CODE_RE.test(code)) return { ok: false, error: 'Código inválido: use de 3 a 24 letras, números, "-" ou "_" (sem espaços).' };
  const kind: CouponKind = o.kind === 'fixed' ? 'fixed' : 'percent';
  let value: number;
  if (kind === 'percent') {
    value = Math.round(int(o.value) * 100); // centésimos de %
    if (!Number.isFinite(value) || value <= 0 || value > 10_000) return { ok: false, error: 'O percentual deve ser maior que 0 e até 100%.' };
  } else {
    value = toCents(o.value);
    if (!Number.isFinite(value) || value <= 0) return { ok: false, error: 'O valor do desconto deve ser maior que zero.' };
    if (value > 100_000_00) return { ok: false, error: 'Valor de desconto alto demais.' };
  }
  const max_uses = o.max_uses === '' || o.max_uses === null || o.max_uses === undefined || o.max_uses === 0 ? 0 : Math.floor(int(o.max_uses));
  if (!Number.isFinite(max_uses) || max_uses < 0 || max_uses > 1_000_000) return { ok: false, error: 'Quantidade de utilizações inválida.' };
  const per_customer = o.per_customer === '' || o.per_customer === null || o.per_customer === undefined || o.per_customer === 0 ? 0 : Math.floor(int(o.per_customer));
  if (!Number.isFinite(per_customer) || per_customer < 0 || per_customer > 1000) return { ok: false, error: 'Limite por cliente inválido.' };
  const starts_at = typeof o.starts_at === 'string' && o.starts_at ? manausToISO(o.starts_at) : '';
  if (o.starts_at && !starts_at) return { ok: false, error: 'Data de início inválida.' };
  const ends_at = typeof o.ends_at === 'string' && o.ends_at ? manausToISO(o.ends_at) : '';
  if (o.ends_at && !ends_at) return { ok: false, error: 'Data de expiração inválida.' };
  if (starts_at && ends_at && ends_at <= starts_at) return { ok: false, error: 'A expiração precisa ser depois do início.' };
  const scope: CouponScope = o.scope === 'all' ? 'all' : 'events';
  const event_ids = Array.isArray(o.event_ids) ? [...new Set(o.event_ids.filter((x): x is string => typeof x === 'string' && /^evt_[a-z0-9]{6,30}$/.test(x)))] : [];
  if (scope === 'events' && !event_ids.length) return { ok: false, error: 'Escolha pelo menos um evento.' };
  const min_cents = o.min === '' || o.min === undefined || o.min === null ? 0 : toCents(o.min);
  if (!Number.isFinite(min_cents) || min_cents < 0) return { ok: false, error: 'Valor mínimo inválido.' };
  const applies: CouponApplies = o.applies === 'single' || o.applies === 'pack' ? o.applies : 'both';
  return {
    ok: true,
    value: {
      code,
      kind,
      value,
      max_uses,
      per_customer,
      starts_at,
      ends_at,
      scope,
      event_ids: scope === 'all' ? [] : event_ids.slice(0, 200),
      min_cents,
      applies,
      stackable: o.stackable === true,
      active: o.active !== false,
    },
  };
}

// ───────── Situação ─────────

export function couponStatus(c: Pick<Coupon, 'active' | 'starts_at' | 'ends_at' | 'max_uses'>, uses: number, now = new Date()): CouponStatus {
  const t = now.toISOString();
  if (!c.active) return 'desativado';
  if (c.ends_at && t >= c.ends_at) return 'expirado';
  if (c.max_uses && uses >= c.max_uses) return 'esgotado';
  if (c.starts_at && t < c.starts_at) return 'agendado';
  return 'ativo';
}

export const describeDiscount = (c: Pick<Coupon, 'kind' | 'value'>) =>
  c.kind === 'percent'
    ? `${(c.value / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
    : `R$ ${(c.value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ───────── Preço com cupom ─────────

/** Desconto sobre uma base (centavos), sem passar da base. Percentual arredondado ao centavo (meio para cima). */
export function discountOn(baseCents: number, c: Pick<Coupon, 'kind' | 'value'>) {
  if (baseCents <= 0) return 0;
  const d = c.kind === 'percent' ? Math.floor((baseCents * c.value + 5_000) / 10_000) : c.value;
  return Math.max(0, Math.min(baseCents, d));
}

export interface PriceResult {
  /** Avulsas: quantidade × preço da foto. */
  singlesCents: number;
  usePack: boolean;
  /** Valor antes do cupom no caminho escolhido (avulsas ou pacote). */
  baseCents: number;
  discountCents: number;
  totalCents: number;
  couponApplied: boolean;
  /** Por que o cupom não entrou (quando há cupom e ele não foi aplicado). */
  reason: string;
}

/**
 * Preço do pedido com (ou sem) cupom, sempre o MENOR para o cliente:
 *  - Avulsas com cupom (se o cupom vale para fotos individuais).
 *  - Pacote com cupom (se o cupom vale para pacotes E: o cupom é só de pacote, ou permite acumular).
 *  - Pacote ou avulsas sem cupom (o que já era).
 * Valor mínimo: comparado com o subtotal do caminho, antes do cupom.
 */
export function priceWithCoupon(count: number, priceSingle: number, pricePack: number, c: Coupon | null): PriceResult {
  const single = Math.round(priceSingle * 100);
  const pack = Math.round(pricePack * 100);
  const singlesCents = count * single;
  const packOk = pack > 0 && count > 0 && pack < singlesCents;
  const plain: PriceResult = packOk
    ? { singlesCents, usePack: true, baseCents: pack, discountCents: 0, totalCents: pack, couponApplied: false, reason: '' }
    : { singlesCents, usePack: false, baseCents: singlesCents, discountCents: 0, totalCents: singlesCents, couponApplied: false, reason: '' };
  if (!c) return plain;
  const options: PriceResult[] = [];
  const reasons: string[] = [];
  const tryPath = (usePack: boolean, base: number) => {
    if (c.min_cents && base < c.min_cents) {
      reasons.push(`Este cupom vale para compras a partir de ${brl(c.min_cents)}.`);
      return;
    }
    const d = discountOn(base, c);
    if (d > 0) options.push({ singlesCents, usePack, baseCents: base, discountCents: d, totalCents: base - d, couponApplied: true, reason: '' });
  };
  if (c.applies !== 'pack') tryPath(false, singlesCents);
  else reasons.push('Este cupom vale só para o pacote "todas as suas fotos".');
  if (packOk) {
    if (c.applies === 'single') reasons.push('Este cupom vale só para fotos avulsas.');
    else if (c.applies === 'pack' || c.stackable) tryPath(true, pack);
    else reasons.push('O pacote já tem desconto e este cupom não acumula com ele.');
  } else if (c.applies === 'pack') reasons.push('Este cupom vale só para o pacote "todas as suas fotos", que não se aplica a esta seleção.');
  const best = options.sort((a, b) => a.totalCents - b.totalCents)[0];
  if (!best || best.totalCents >= plain.totalCents) {
    return { ...plain, reason: best ? 'O pacote já sai mais barato do que as fotos com este cupom.' : (reasons[0] ?? 'Este cupom não se aplica a esta compra.') };
  }
  return best;
}

export const brl = (cents: number) => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Pode usar agora? (situação, evento e limites). uses = utilizações em andamento + confirmadas;
 * customerUses = do mesmo cliente (e-mail ou WhatsApp). Devolve a mensagem de erro ou ''.
 */
export function couponBlocker(c: Coupon, eventId: string, uses: number, customerUses: number, now = new Date()) {
  const st = couponStatus(c, uses, now);
  if (st === 'desativado' || st === 'expirado') return 'Este cupom expirou ou não está mais disponível.';
  if (st === 'agendado') return `Este cupom ainda não começou a valer (a partir de ${formatManaus(c.starts_at)}).`;
  if (st === 'esgotado') return 'Este cupom esgotou.';
  if (c.scope === 'events' && !c.event_ids.includes(eventId)) return 'Este cupom não vale para este evento.';
  if (c.per_customer && customerUses >= c.per_customer) return 'Você já usou este cupom o máximo de vezes permitido.';
  return '';
}

/** Identificação do cliente (sem login): e-mail em minúsculas e WhatsApp só com dígitos (DDD + número). */
export const customerKeys = (email: string, phone: string) => ({
  email: email.trim().toLowerCase(),
  phone: phone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''),
});
