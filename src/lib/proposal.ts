/**
 * PROPOSTAS PERSONALIZADAS — LÓGICA
 * ------------------------------------------------------------------
 * Sem servidor e sem banco de dados: a proposta inteira vai dentro do link,
 * depois do "#" (essa parte nunca é enviada ao servidor). Ex.:
 *   https://seusite/proposta/#d=eyJ2IjoxLC...
 *
 * Os preços ficam CONGELADOS no link: se a tabela mudar depois,
 * a proposta já enviada continua com os valores combinados.
 *
 * Funções puras: rodam no navegador e nos testes.
 */
import { formatBRL } from './whatsapp.ts';

export const PROPOSAL_VERSION = 1;

export interface ProposalItem {
  /** Nome do serviço. */
  n: string;
  /** Categoria/subgrupo (ex.: "Academias de luta · Marketing da academia"). */
  c?: string;
  /** Valor unitário nesta proposta (R$). */
  p: number;
  /** Valor de tabela, quando diferente (para mostrar "de R$ X por R$ Y"). */
  o?: number;
  /** Quantidade. */
  q: number;
  /** Cobrança mensal (assinatura). */
  m?: boolean;
  /** Sufixo exibido (ex.: '/hora'). */
  u?: string;
  /** Detalhes (duração, entrega, inclusos). */
  d?: string[];
}

export interface Proposal {
  v: number;
  /** Código da proposta (ex.: VEN-261113-K7QF). */
  id: string;
  /** Tipo de cliente (ver src/data/proposal.ts). */
  t: string;
  /** Cliente (empresa ou pessoa). */
  cl: string;
  /** Responsável / a quem se dirige. */
  r?: string;
  /** Mensagem de apresentação. */
  msg: string;
  /** Data de emissão (AAAA-MM-DD). */
  em: string;
  /** Válida até (AAAA-MM-DD). */
  val?: string;
  /** Data do evento/início (AAAA-MM-DD). */
  ev?: string;
  /** Local. */
  loc?: string;
  it: ProposalItem[];
  /** Observações livres. */
  obs?: string;
  /** Observações da tabela (por categoria) incluídas automaticamente. */
  nt?: string[];
  /** Mostrar condições de pagamento? */
  pay: boolean;
}

// ───────────── Link (codificação) ─────────────

const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64Url = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
};

export const encodeProposal = (p: Proposal): string =>
  toBase64Url(new TextEncoder().encode(JSON.stringify(p)));

/** Lê a proposta do link. Retorna `null` se o link estiver incompleto ou corrompido. */
export const decodeProposal = (code: string): Proposal | null => {
  try {
    const p = JSON.parse(new TextDecoder().decode(fromBase64Url(code))) as Proposal;
    if (p?.v !== PROPOSAL_VERSION || typeof p.cl !== 'string' || !Array.isArray(p.it)) return null;
    p.it = p.it.filter((i) => i && typeof i.n === 'string' && Number.isFinite(i.p) && Number.isFinite(i.q) && i.q > 0);
    return p;
  } catch {
    return null;
  }
};

export const proposalUrl = (origin: string, p: Proposal) => `${origin.replace(/\/$/, '')}/proposta/#d=${encodeProposal(p)}`;

// ───────────── Valores ─────────────

const cents = (v: number) => Math.round(v * 100);

export interface ProposalTotals {
  /** Total dos serviços avulsos (pagos uma vez). */
  once: number;
  /** Total mensal das assinaturas. */
  monthly: number;
  /** Economia em relação à tabela (avulsos + 1º mês das assinaturas). */
  savings: number;
}

export const lineTotal = (i: ProposalItem) => cents(i.p) * i.q / 100;

export function proposalTotals(p: Pick<Proposal, 'it'>): ProposalTotals {
  let once = 0;
  let monthly = 0;
  let savings = 0;
  for (const i of p.it) {
    const t = cents(i.p) * i.q;
    if (i.m) monthly += t;
    else once += t;
    if (i.o && i.o > i.p) savings += (cents(i.o) - cents(i.p)) * i.q;
  }
  return { once: once / 100, monthly: monthly / 100, savings: savings / 100 };
}

// ───────────── Utilidades ─────────────

/** Código curto: VEN-AAMMDD-XXXX. */
export const newProposalId = (date = new Date(), rand: () => number = Math.random) => {
  const d = date.toISOString().slice(2, 10).replace(/-/g, '');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from({ length: 4 }, () => alphabet[Math.floor(rand() * alphabet.length)]).join('');
  return `VEN-${d}-${code}`;
};

export const isoDate = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y!, m! - 1, d! + days));
};

export const formatDateBR = (iso?: string) => {
  const m = iso && /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? '');
};

/** A proposta já venceu? (válida até o fim do dia indicado) */
export const isExpired = (p: Pick<Proposal, 'val'>, today = isoDate(new Date())) => !!p.val && p.val < today;

/**
 * Preenche um texto modelo:
 *   {saudacao} → "Olá, Carlos!" (ou "Olá!" sem responsável)
 *   {cliente}  → nome do cliente
 */
export const fillTemplate = (tpl: string, vars: { cliente: string; responsavel?: string }) =>
  tpl
    .replace(/\{saudacao\}/g, vars.responsavel?.trim() ? `Olá, ${vars.responsavel.trim()}!` : 'Olá!')
    .replace(/\{cliente\}/g, vars.cliente.trim() || 'você');

// ───────────── Mensagens de WhatsApp ─────────────

const totalsText = (t: ProposalTotals) =>
  [t.once ? formatBRL(t.once) : '', t.monthly ? `${formatBRL(t.monthly)}/mês` : ''].filter(Boolean).join(' + ');

/** Mensagem que VOCÊ envia ao cliente, com o link. */
export const sendMessage = (p: Proposal, url: string, signature: string) => {
  const hi = p.r?.trim() ? `Olá, ${p.r.trim()}!` : 'Olá!';
  return [
    `${hi} Tudo bem?`,
    '',
    `Preparei uma proposta para ${p.cl.trim()}. Está tudo neste link, com os serviços, valores e condições:`,
    url,
    '',
    p.val ? `A proposta é válida até ${formatDateBR(p.val)}. ` + 'Qualquer dúvida, é só me chamar por aqui.' : 'Qualquer dúvida, é só me chamar por aqui.',
    '',
    signature,
  ].join('\n');
};

/** Mensagem que o CLIENTE envia ao aceitar. */
export const acceptMessage = (p: Proposal) =>
  [
    `Olá! Vi a proposta ${p.id} para ${p.cl.trim()} e quero seguir com ela.`,
    `Total: ${totalsText(proposalTotals(p))}.`,
    'Como fazemos para confirmar?',
  ].join('\n');

/** Mensagem do cliente com dúvidas. */
export const questionMessage = (p: Proposal) => `Olá! Vi a proposta ${p.id} para ${p.cl.trim()} e tenho uma dúvida:`;
