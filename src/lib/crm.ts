/**
 * PAINEL PROFISSIONAL — MODELO DE DADOS
 * ------------------------------------------------------------------
 * Etapas, status e validação de clientes e propostas.
 * Usado pelo servidor (worker/) e pelas telas do painel — e testado em tests/crm.test.ts.
 */

export const CLIENT_STAGES = [
  { id: 'prospect', label: 'A contatar' },
  { id: 'contacted', label: 'Contatado' },
  { id: 'negotiating', label: 'Em negociação' },
  { id: 'client', label: 'Cliente ativo' },
  { id: 'lost', label: 'Perdido' },
] as const;
export type ClientStage = (typeof CLIENT_STAGES)[number]['id'];

export const PROPOSAL_STATUSES = [
  { id: 'enviada', label: 'Enviada' },
  { id: 'aceita', label: 'Aceita' },
  { id: 'recusada', label: 'Recusada' },
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]['id'];

export interface Client {
  id: string;
  name: string;
  type: string;
  contact: string;
  phone: string;
  instagram: string;
  email: string;
  stage: ClientStage;
  next_followup: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ProposalRecord {
  id: string;
  client_id: string;
  client_name: string;
  type: string;
  status: ProposalStatus;
  total_once: number;
  total_monthly: number;
  valid_until: string;
  url: string;
  data: string; // JSON da proposta (src/lib/proposal.ts)
  notes: string;
  created_at: string;
  updated_at: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const date = (v: unknown) => {
  const s = str(v, 10);
  return ISO_DATE.test(s) ? s : '';
};
const money = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 && n < 10_000_000 ? Math.round(n * 100) / 100 : 0;
};

export type ClientInput = Omit<Client, 'id' | 'created_at' | 'updated_at'>;

/** Valida e limpa os dados de um cliente vindos do formulário/API. */
export function parseClient(input: unknown): Result<ClientInput> {
  const o = (input ?? {}) as Record<string, unknown>;
  const name = str(o.name, 120);
  if (!name) return { ok: false, error: 'Informe o nome do cliente.' };
  const stage = CLIENT_STAGES.some((s) => s.id === o.stage) ? (o.stage as ClientStage) : 'prospect';
  return {
    ok: true,
    value: {
      name,
      type: str(o.type, 40),
      contact: str(o.contact, 120),
      phone: str(o.phone, 40).replace(/[^\d+()\s-]/g, ''),
      instagram: str(o.instagram, 60).replace(/^@+/, '').replace(/[^\w.]/g, ''),
      email: str(o.email, 120),
      stage,
      next_followup: date(o.next_followup),
      notes: str(o.notes, 4000),
    },
  };
}

export type ProposalInput = Omit<ProposalRecord, 'created_at' | 'updated_at'>;

/** Valida e limpa uma proposta salva pelo gerador. */
export function parseProposal(input: unknown): Result<ProposalInput> {
  const o = (input ?? {}) as Record<string, unknown>;
  const id = str(o.id, 40);
  if (!/^VEN-\d{6}-[A-Z0-9]{4}$/.test(id)) return { ok: false, error: 'Código de proposta inválido.' };
  const client_name = str(o.client_name, 120);
  if (!client_name) return { ok: false, error: 'Informe o nome do cliente.' };
  const data = typeof o.data === 'string' ? o.data : JSON.stringify(o.data ?? {});
  if (data.length > 100_000) return { ok: false, error: 'Proposta grande demais.' };
  const status = PROPOSAL_STATUSES.some((s) => s.id === o.status) ? (o.status as ProposalStatus) : 'enviada';
  const url = str(o.url, 20_000);
  return {
    ok: true,
    value: {
      id,
      client_id: str(o.client_id, 40),
      client_name,
      type: str(o.type, 40),
      status,
      total_once: money(o.total_once),
      total_monthly: money(o.total_monthly),
      valid_until: date(o.valid_until),
      url: /^https?:\/\//.test(url) ? url : '',
      data,
      notes: str(o.notes, 4000),
    },
  };
}

/** Status exibido: "Vencida" quando enviada e com validade passada. */
export function displayStatus(p: Pick<ProposalRecord, 'status' | 'valid_until'>, today: string) {
  if (p.status === 'enviada' && p.valid_until && p.valid_until < today) return { id: 'vencida', label: 'Vencida' };
  return PROPOSAL_STATUSES.find((s) => s.id === p.status) ?? PROPOSAL_STATUSES[0];
}

export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
