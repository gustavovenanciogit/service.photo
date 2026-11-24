/**
 * Acesso à API do painel (roda no navegador).
 * Se a sessão expirar, leva de volta para a tela de login.
 */
import type { Client, Job, Lead, ProposalRecord } from './crm';
import type { EventPhoto, EventRecord, PhotoPart } from './events';
import type { Order } from './orders';
import type { RevenueEntry } from './reports';
import type { WatermarkSettings } from './watermark-models';
import type { Coupon, CouponStatus } from './coupons';
import type { CartaoConfig } from './cartao';

export type FaceSession = {
  id: string; event_id: string; kind: 'treino' | 'config' | 'auto'; model: string; pipeline: string; threshold: number; recommended: number;
  same: number; diff: number; unsure: number; recall: number; precision: number; fpr: number; set_id: string; created_at: string;
};
export type CouponView = Coupon & { uses_confirmed: number; uses_active: number; status: CouponStatus };

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
  clientOutreach: (id: string, action: 'sent' | 'replied' | 'skip' | 'lost') => request<Client>('POST', `/api/clients/${encodeURIComponent(id)}/outreach`, { action, today: todayISO() }),
  importClients: (clients: Partial<Client>[]) => request<{ created: number; skipped: number }>('POST', '/api/clients/import', { clients }),
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

  orders: () =>
    request<{
      configured: boolean;
      payments?: { active: string | null; mercadopagoTest: boolean; webhookSecret: boolean };
      orders: Order[];
    }>('GET', '/api/orders'),
  orderAction: (id: string, body: { action?: 'sync' | 'release' | 'block' | 'extend' | 'test'; notes?: string }) =>
    request<Order>('PATCH', `/api/orders/${encodeURIComponent(id)}`, body),

  revenue: () => request<RevenueEntry[]>('GET', '/api/revenue'),
  addRevenue: (e: { month: string; amount: number; description: string }) => request<RevenueEntry>('POST', '/api/revenue', e),
  deleteRevenue: (id: string) => request<{ ok: true }>('DELETE', `/api/revenue/${encodeURIComponent(id)}`),
  duplicateEvent: (id: string) => request<EventRecord>('POST', `/api/events/${encodeURIComponent(id)}/duplicate`, {}),

  events: () => request<(EventRecord & { sales_total: number; orders_paid: number; photos_sold: number })[]>('GET', '/api/events'),
  storage: (refresh = false) => request<{ bytes: number; objects: number; partial: boolean; at: number; quota: number }>('GET', `/api/storage${refresh ? '?refresh=1' : ''}`),
  event: (id: string) => request<EventRecord>('GET', `/api/events/${encodeURIComponent(id)}`),
  createEvent: (e: Partial<EventRecord>) => request<EventRecord>('POST', '/api/events', e),
  updateEvent: (id: string, e: Partial<EventRecord>) => request<EventRecord>('PUT', `/api/events/${encodeURIComponent(id)}`, e),
  deleteEvent: (id: string) => request<{ ok: true }>('DELETE', `/api/events/${encodeURIComponent(id)}`),
  eventPhotos: (id: string) => request<EventPhoto[]>('GET', `/api/events/${encodeURIComponent(id)}/photos`),
  registerPhotos: (id: string, names: string[]) => request<EventPhoto[]>('POST', `/api/events/${encodeURIComponent(id)}/photos`, { names }),
  completePhoto: (id: string, pid: string, width: number, height: number, sig = '') =>
    request<EventPhoto>('POST', `/api/events/${encodeURIComponent(id)}/photos/${encodeURIComponent(pid)}/complete`, { width, height, sig }),
  /** Original (só para o fotógrafo logado), para refazer as prévias. */
  async originalPhoto(id: string, pid: string, signal?: AbortSignal) {
    const res = await fetch(`/api/events/${encodeURIComponent(id)}/photos/${encodeURIComponent(pid)}/original`, { credentials: 'same-origin', signal, cache: 'no-store' });
    if (!res.ok) throw new ApiError(res.status, res.status === 404 ? 'Original não encontrado.' : 'Falha ao baixar o original.');
    return res.blob();
  },
  /** Capa opcional da página do evento (JPG). */
  async uploadCover(id: string, jpg: Blob) {
    const res = await fetch(`/api/events/${encodeURIComponent(id)}/cover`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'image/jpeg' }, body: jpg });
    const data = (await res.json().catch(() => ({}))) as EventRecord & { error?: string };
    if (!res.ok) throw new ApiError(res.status, data.error ?? 'Falha ao enviar a capa.');
    return data;
  },
  deleteCover: (id: string) => request<EventRecord>('DELETE', `/api/events/${encodeURIComponent(id)}/cover`),
  cartao: () => request<{ config: CartaoConfig; defaults: CartaoConfig }>('GET', '/api/cartao'),
  saveCartao: (c: CartaoConfig & { forecast: string }) => request<{ config: CartaoConfig }>('PUT', '/api/cartao', c),
  notices: () => request<{ configured: boolean; requests: { event_id: string; pending: number; failed: number; error: string }[]; sent: { id: string; notify_sent: number }[] }>('GET', '/api/cartao/notices'),
  sendNotices: (eventId: string) => request<{ sent: number; failed: number; pending: number }>('POST', '/api/cartao/notify', { event_id: eventId }),
  unannounceEvent: (eventId: string) => request<{ ok: true }>('POST', '/api/cartao/unannounce', { event_id: eventId }),
  watermarkSettings: () => request<WatermarkSettings>('GET', '/api/settings/watermark'),
  saveWatermarkSettings: (s: WatermarkSettings) => request<WatermarkSettings>('PUT', '/api/settings/watermark', s),
  async uploadWatermarkLogo(png: Blob) {
    const res = await fetch('/api/settings/watermark/logo', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'image/png' }, body: png });
    const data = (await res.json().catch(() => ({}))) as WatermarkSettings & { error?: string };
    if (!res.ok) throw new ApiError(res.status, data.error ?? 'Falha ao enviar o logotipo.');
    return data;
  },
  deleteWatermarkLogo: () => request<WatermarkSettings>('DELETE', '/api/settings/watermark/logo'),
  /** Mede a velocidade de envio: manda blocos aleatórios em paralelo (como o envio das fotos) e devolve MB/s. */
  async uploadSpeed(blocks = 6, size = 1_000_000, parallel = 6) {
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i += 65_536) crypto.getRandomValues(data.subarray(i, i + 65_536));
    const send = async () => {
      const res = await fetch('/api/upload-test', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/octet-stream' }, body: new Blob([data]) });
      if (!res.ok) throw new ApiError(res.status, 'Falha no teste de velocidade.');
    };
    await send(); // aquece a conexão
    const t0 = performance.now();
    let left = blocks;
    await Promise.all(Array.from({ length: parallel }, async () => { while (left-- > 0) await send(); }));
    return (blocks * size) / 1_000_000 / ((performance.now() - t0) / 1000);
  },
  faceSessions: () => request<FaceSession[]>('GET', '/api/faces/sessions'),
  saveFaceSession: (s: Omit<FaceSession, 'id' | 'created_at'>) => request<{ ok: true }>('POST', '/api/faces/sessions', s),
  applyThreshold: (threshold: number, eventId = '', note = '') => request<{ ok: true; old: number; threshold: number }>('POST', '/api/faces/threshold', { threshold, event_id: eventId, note }),
  restoreThreshold: (eventId = '') => request<{ ok: true; old: number; threshold: number }>('POST', '/api/faces/threshold/restore', { event_id: eventId }),
  thresholdHistory: () => request<{ id: string; event_id: string; old_value: number; new_value: number; note: string; created_at: string }[]>('GET', '/api/faces/threshold/history'),
  faceLabels: () => request<{ e: string; pair: string; s: number; ans: 'same' | 'diff' | 'unsure'; at: string }[]>('GET', '/api/faces/labels'),
  saveFaceLabel: (id: string, a: string, b: string, score: number, answer: 'same' | 'diff' | 'unsure') =>
    request<{ ok: true; pair: string }>('POST', `/api/events/${encodeURIComponent(id)}/faces/labels`, { a, b, score, answer }),
  resetFaceLabels: () => request<{ ok: true }>('DELETE', '/api/faces/labels'),
  deleteFaceLabel: (pair: string) => request<{ ok: true }>('DELETE', `/api/faces/labels/${encodeURIComponent(pair)}`),
  // Cupons de desconto
  coupons: (eventId?: string) => request<CouponView[]>('GET', `/api/coupons${eventId ? `?event=${encodeURIComponent(eventId)}` : ''}`),
  createCoupon: (c: unknown) => request<{ id: string }>('POST', '/api/coupons', c),
  updateCoupon: (id: string, c: unknown) => request<{ ok: true }>('PUT', `/api/coupons/${encodeURIComponent(id)}`, c),
  setCouponActive: (id: string, active: boolean) => request<{ ok: true }>('PATCH', `/api/coupons/${encodeURIComponent(id)}`, { active }),
  deleteCoupon: (id: string) => request<{ ok: true }>('DELETE', `/api/coupons/${encodeURIComponent(id)}`),
  // Reconhecimento facial (piloto)
  faceStatus: (id: string) => request<{ total: number; indexed: number; faces: number; pending: { id: string; seq: number }[]; face_search: boolean; face_pack_at: string }>('GET', `/api/events/${encodeURIComponent(id)}/faces`),
  saveFaces: (id: string, pid: string, faces: { vec: string; score: number; box: number[]; sharp?: number }[]) =>
    request<{ ok: true; faces: number }>('POST', `/api/events/${encodeURIComponent(id)}/photos/${encodeURIComponent(pid)}/faces`, { faces }),
  faceVectors: (id: string) => request<{ id: string; p: string; n: number; v: string; b: string; w: number; h: number; sh: number }[]>('GET', `/api/events/${encodeURIComponent(id)}/faces/vectors`),
  deleteFaces: (id: string) => request<{ ok: true }>('DELETE', `/api/events/${encodeURIComponent(id)}/faces`),
  faceConsent: (id: string, version: string, label: string) => request<{ id: string }>('POST', `/api/events/${encodeURIComponent(id)}/faces/consent`, { version, label, accept: true }),
  revokeFaceConsent: (cid: string) => request<{ ok: true }>('POST', `/api/faces/consent/${encodeURIComponent(cid)}/revoke`, {}),
  async uploadFacePack(id: string, pack: Uint8Array) {
    const res = await fetch(`/api/events/${encodeURIComponent(id)}/faces/pack`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/octet-stream' }, body: new Blob([pack as BlobPart]) });
    const data = (await res.json().catch(() => ({}))) as { error?: string; faces?: number; face_pack_at?: string };
    if (!res.ok) throw new ApiError(res.status, data.error ?? 'Falha ao enviar o índice.');
    return data;
  },
  setFacePublic: (id: string, enabled: boolean, notice: boolean) => request<{ ok: true; face_search: boolean }>('POST', `/api/events/${encodeURIComponent(id)}/faces/public`, { enabled, notice }),
  removeFromFaceSearch: (id: string, numbers: number[]) => request<{ ok: true; removed: number }>('POST', `/api/events/${encodeURIComponent(id)}/faces/remove`, { numbers }),
  faceSettings: () => request<{ threshold: number; default: number; auto: boolean }>('GET', '/api/faces/settings'),
  setFaceAuto: (auto: boolean) => request<{ threshold: number; default: number; auto: boolean }>('PUT', '/api/faces/settings', { auto }),
  autoTune: () => request<{ applied: boolean; threshold?: number; from?: number; target?: number; reason: string }>('POST', '/api/faces/auto-tune', {}),
  saveFaceSettings: (threshold: number) => request<{ threshold: number; default: number }>('PUT', '/api/faces/settings', { threshold }),
  pilotRuns: (id: string) => request<{ id: string; consent_id: string; data: unknown; created_at: string; label: string | null; version: string | null }[]>('GET', `/api/events/${encodeURIComponent(id)}/faces/pilot`),
  savePilotRun: (id: string, consent_id: string, data: unknown) => request<{ ok: true }>('POST', `/api/events/${encodeURIComponent(id)}/faces/pilot`, { consent_id, data }),
  deletePhoto: (id: string, pid: string) => request<{ ok: true }>('DELETE', `/api/events/${encodeURIComponent(id)}/photos/${encodeURIComponent(pid)}`),
  /** Envia um arquivo da foto (binário, sem JSON). */
  async uploadPart(id: string, pid: string, part: PhotoPart, blob: Blob, signal?: AbortSignal) {
    const res = await fetch(`/api/events/${encodeURIComponent(id)}/photos/${encodeURIComponent(pid)}/${part}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
      signal,
    });
    if (res.status === 401) throw new ApiError(401, 'Sessão expirada. Faça login de novo.');
    if (!res.ok) throw new ApiError(res.status, ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Falha no envio.');
  },
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
