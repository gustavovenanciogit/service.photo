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

// ───────────── Pedidos vindos do site ─────────────

export const LEAD_STATUSES = [
  { id: 'novo', label: 'Novo' },
  { id: 'atendimento', label: 'Em atendimento' },
  { id: 'convertido', label: 'Virou cliente' },
  { id: 'arquivado', label: 'Arquivado' },
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number]['id'];

export const LEAD_SOURCES = [
  { id: 'formulario', label: 'Formulário de contato' },
  { id: 'simulador', label: 'Simulador' },
] as const;

export interface Lead {
  id: string;
  created_at: string;
  status: LeadStatus;
  source: string;
  name: string;
  phone: string;
  service: string;
  package_id: string;
  event_date: string;
  location: string;
  message: string;
  total: number;
  details: string;
  updated_at: string;
}

export type LeadInput = Pick<Lead, 'source' | 'name' | 'phone' | 'service' | 'package_id' | 'event_date' | 'location' | 'message' | 'total' | 'details'>;

/** Valida um pedido enviado pelo site (dados públicos: tudo é limpo e limitado). */
export function parseLead(input: unknown): Result<LeadInput> {
  const o = (input ?? {}) as Record<string, unknown>;
  const source = LEAD_SOURCES.some((s) => s.id === o.source) ? (o.source as string) : '';
  if (!source) return { ok: false, error: 'Origem inválida.' };
  const lead: LeadInput = {
    source,
    name: str(o.name, 80),
    phone: str(o.phone, 30).replace(/[^\d+()\s-]/g, ''),
    service: str(o.service, 160),
    package_id: str(o.package_id, 60).replace(/[^a-z0-9-]/g, ''),
    event_date: date(o.event_date),
    location: str(o.location, 120),
    message: str(o.message, 1200),
    total: money(o.total),
    details: str(o.details, 2000),
  };
  if (!lead.name && !lead.phone && !lead.service) return { ok: false, error: 'Pedido vazio.' };
  return { ok: true, value: lead };
}

// ───────────── Agenda de trabalhos e entregas ─────────────

export const JOB_STATUSES = [
  { id: 'agendado', label: 'Agendado' },
  { id: 'fotografado', label: 'Fotografado' },
  { id: 'editando', label: 'Editando' },
  { id: 'entregue', label: 'Entregue' },
  { id: 'cancelado', label: 'Cancelado' },
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number]['id'];

export interface Job {
  id: string;
  /** 'trabalho' ou 'bloqueio' (data indisponível, sem cliente). */
  kind: 'trabalho' | 'bloqueio';
  title: string;
  client_id: string;
  client_name: string;
  phone: string;
  proposal_id: string;
  date: string; // AAAA-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  location: string;
  /** Mostrar a data como ocupada no site. */
  blocks_date: boolean;
  status: JobStatus;
  due_date: string; // prazo de entrega
  delivery_link: string; // link da galeria/Drive/Fotto
  delivered_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type JobInput = Omit<Job, 'id' | 'created_at' | 'updated_at'>;

const time = (v: unknown) => {
  const s = str(v, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : '';
};

/** Valida um trabalho/bloqueio vindo do painel. */
export function parseJob(input: unknown): Result<JobInput> {
  const o = (input ?? {}) as Record<string, unknown>;
  const kind = o.kind === 'bloqueio' ? 'bloqueio' : 'trabalho';
  const d = date(o.date);
  if (!d) return { ok: false, error: 'Informe a data.' };
  const title = str(o.title, 120) || (kind === 'bloqueio' ? 'Indisponível' : '');
  if (!title) return { ok: false, error: 'Informe o serviço ou um título.' };
  const status = JOB_STATUSES.some((s) => s.id === o.status) ? (o.status as JobStatus) : 'agendado';
  const link = str(o.delivery_link, 500);
  return {
    ok: true,
    value: {
      kind,
      title,
      client_id: str(o.client_id, 40),
      client_name: str(o.client_name, 120),
      phone: str(o.phone, 40).replace(/[^\d+()\s-]/g, ''),
      proposal_id: /^VEN-\d{6}-[A-Z0-9]{4}$/.test(String(o.proposal_id ?? '')) ? String(o.proposal_id) : '',
      date: d,
      start_time: time(o.start_time),
      end_time: time(o.end_time),
      location: str(o.location, 160),
      blocks_date: o.blocks_date !== false,
      status: kind === 'bloqueio' ? 'agendado' : status,
      due_date: kind === 'bloqueio' ? '' : date(o.due_date),
      delivery_link: /^https?:\/\/\S+$/.test(link) ? link : '',
      delivered_at: status === 'entregue' ? date(o.delivered_at) : '',
      notes: str(o.notes, 4000),
    },
  };
}
