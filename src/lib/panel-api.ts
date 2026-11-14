/**
 * Acesso à API do painel (roda no navegador).
 * Se a sessão expirar, leva de volta para a tela de login.
 */
import type { Client, Job, Lead, ProposalRecord } from './crm';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Sem conexão. Verifique a internet e tente de novo.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401 && !location.pathname.startsWith('/painel/login')) {
    location.href = `/painel/login/?next=${encodeURIComponent(location.pathname + location.search)}`;
  }
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Algo deu errado. Tente de novo.');
  return data as T;
}

export type ProposalSummary = Omit<ProposalRecord, 'data'>;

export const api = {
  login: (password: string) => request<{ ok: true }>('POST', '/api/login', { password }),
  logout: () => request<{ ok: true }>('POST', '/api/logout', {}),
  session: () => request<{ ok: true }>('GET', '/api/session'),

  clients: () => request<Client[]>('GET', '/api/clients'),
  createClient: (c: Partial<Client>) => request<Client>('POST', '/api/clients', c),
  updateClient: (id: string, c: Partial<Client>) => request<Client>('PUT', `/api/clients/${encodeURIComponent(id)}`, c),
  deleteClient: (id: string) => request<{ ok: true }>('DELETE', `/api/clients/${encodeURIComponent(id)}`),

  jobs: () => request<Job[]>('GET', '/api/jobs'),
  createJob: (j: Partial<Job>) => request<Job>('POST', '/api/jobs', j),
  updateJob: (id: string, j: Partial<Job>) => request<Job>('PUT', `/api/jobs/${encodeURIComponent(id)}`, j),
  deleteJob: (id: string) => request<{ ok: true }>('DELETE', `/api/jobs/${encodeURIComponent(id)}`),

  leads: () => request<Lead[]>('GET', '/api/leads'),
  leadCount: () => request<{ novo: number }>('GET', '/api/leads/count'),
  setLeadStatus: (id: string, status: string) => request<Lead>('PATCH', `/api/leads/${encodeURIComponent(id)}`, { status }),
  deleteLead: (id: string) => request<{ ok: true }>('DELETE', `/api/leads/${encodeURIComponent(id)}`),

  proposals: () => request<ProposalSummary[]>('GET', '/api/proposals'),
  proposal: (id: string) => request<ProposalRecord>('GET', `/api/proposals/${encodeURIComponent(id)}`),
  saveProposal: (id: string, p: Partial<ProposalRecord>) => request<ProposalRecord>('PUT', `/api/proposals/${encodeURIComponent(id)}`, p),
  patchProposal: (id: string, p: { status?: string; notes?: string; client_id?: string }) =>
    request<ProposalRecord>('PATCH', `/api/proposals/${encodeURIComponent(id)}`, p),
  deleteProposal: (id: string) => request<{ ok: true }>('DELETE', `/api/proposals/${encodeURIComponent(id)}`),
};

/** Mostra um aviso rápido no canto da tela. */
export function toast(message: string, kind: 'ok' | 'error' = 'ok') {
  const el = document.createElement('div');
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.className = `fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg ${
    kind === 'error' ? 'bg-red-500 text-white' : 'bg-brand text-bg'
  }`;
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 3200);
}

/** Cria um elemento com texto (nunca HTML). */
export function h(tag: string, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Telefone digitado → número para wa.me (adiciona 55 quando tem DDD + número). */
export const waNumber = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
};
