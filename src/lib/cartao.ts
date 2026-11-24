/**
 * CARTÃO DIGITAL — regras puras (usadas no servidor, no painel e na página pública)
 * ------------------------------------------------------------------
 * /cartao                → cartão do fotógrafo (um QR Code fixo, impresso uma vez)
 * /eventos/<endereço>    → página permanente de cada evento (antes e depois da publicação)
 * /eventos/              → outros eventos (só se o fotógrafo liberar no painel)
 *
 * A configuração fica no banco (settings, chave "cartao"): muda sem deploy.
 * A previsão de publicação fica no próprio evento (events.publish_forecast), assim o link
 * permanente continua certo mesmo depois que o cartão passar a destacar outro evento.
 *
 * PREPARADO PARA O FUTURO (ainda NÃO implementado, de propósito):
 *  - "Avise-me quando as fotos saírem": cadastro voluntário com consentimento (LGPD) e
 *    aviso por e-mail. Só depois de existir uma integração de envio autorizada.
 *  - Estatísticas por evento (visitas e cliques): os botões já levam data-track="…"
 *    (ver TRACK_EVENTS) e a função track() das páginas hoje não envia nada.
 *  Nenhuma mensagem é disparada automaticamente.
 */
import { formatManaus, isoToManaus, manausToISO } from './coupons.ts';

export { formatManaus, isoToManaus, manausToISO };

export interface CartaoButton {
  label: string;
  url: string;
}

export interface CartaoConfig {
  /** Frase principal do topo. */
  headline: string;
  /** Linha de apoio (opcional). */
  intro: string;
  featured: {
    /** Destaque ligado/desligado (desligado: o cartão mostra só os outros botões). */
    active: boolean;
    event_id: string;
    /** Texto de apresentação do destaque (opcional). */
    text: string;
    /** Texto do botão (vazio = automático: "Acompanhe as fotos da <evento>"). */
    label: string;
  };
  /** Mostrar "Ver outros eventos" (lista dos eventos marcados para aparecer no site). */
  show_past: boolean;
  hire: CartaoButton;
  work: CartaoButton;
}

/** Ações que poderão ser contadas no futuro (hoje nada é enviado). */
export const TRACK_EVENTS = ['cartao_view', 'featured_click', 'hire_click', 'work_click', 'past_click', 'event_view', 'gallery_click', 'check_click'] as const;

export const LIMITS = { headline: 80, intro: 160, text: 280, label: 70, buttonLabel: 40, url: 500 } as const;

export function defaultCartao(hireUrl = '', workUrl = '/'): CartaoConfig {
  return {
    headline: 'Seus momentos merecem ser encontrados',
    intro: '',
    featured: { active: false, event_id: '', text: '', label: '' },
    show_past: false,
    hire: { label: 'Contratar fotógrafo', url: hireUrl },
    work: { label: 'Conhecer meu trabalho', url: workUrl },
  };
}

/** Link aceito nos botões: https://, http://, wa.me ou um endereço do próprio site ("/…"). Nunca javascript: etc. */
export function safeUrl(v: unknown) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (s.length > LIMITS.url) return null;
  if (/^\/(?!\/)[^\s]*$/.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

const text = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
/** Texto de apresentação: mantém quebras de linha simples. */
const para = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Valida o que vem do painel. `fallback` completa o que faltar (ex.: links padrão). */
export function parseCartao(input: unknown, fallback = defaultCartao()): Result<CartaoConfig> {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Dados inválidos.' };
  const o = input as Record<string, unknown>;
  const f = (o.featured && typeof o.featured === 'object' ? o.featured : {}) as Record<string, unknown>;
  const btn = (b: unknown, name: string, def: CartaoButton): Result<CartaoButton> => {
    const x = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
    const url = safeUrl(x.url ?? def.url);
    if (url === null) return { ok: false, error: `Link do botão "${name}" inválido. Use um endereço começando com https:// ou /.` };
    return { ok: true, value: { label: text(x.label, LIMITS.buttonLabel) || def.label, url } };
  };
  const event_id = String(f.event_id ?? '');
  if (event_id && !/^evt_[a-z0-9]{6,30}$/.test(event_id)) return { ok: false, error: 'Evento inválido.' };
  const active = f.active === true && !!event_id;
  if (f.active === true && !event_id) return { ok: false, error: 'Escolha o evento em destaque (ou desative o destaque).' };
  const hire = btn(o.hire, 'Contratar fotógrafo', fallback.hire);
  if (!hire.ok) return hire;
  const work = btn(o.work, 'Conhecer meu trabalho', fallback.work);
  if (!work.ok) return work;
  return {
    ok: true,
    value: {
      headline: text(o.headline, LIMITS.headline) || fallback.headline,
      intro: text(o.intro, LIMITS.intro),
      featured: { active, event_id, text: para(f.text, LIMITS.text), label: text(f.label, LIMITS.label) },
      show_past: o.show_past === true,
      hire: hire.value,
      work: work.value,
    },
  };
}

/** Lê o que está guardado no banco, tolerando dados antigos ou quebrados. */
export function loadCartao(raw: string | null | undefined, fallback = defaultCartao()): CartaoConfig {
  if (!raw) return fallback;
  try {
    const r = parseCartao(JSON.parse(raw), fallback);
    return r.ok ? r.value : fallback;
  } catch {
    return fallback;
  }
}

/** Previsão de publicação vinda do formulário (horário de Manaus) → ISO UTC ('' = sem previsão). */
export function parseForecast(v: unknown): Result<string> {
  const s = String(v ?? '').trim();
  if (!s) return { ok: true, value: '' };
  const iso = manausToISO(s);
  return iso ? { ok: true, value: iso } : { ok: false, error: 'Previsão de publicação inválida.' };
}

// ───────── Estado do evento para o público ─────────

/** preparando = rascunho anunciado (sem fotos); disponivel = publicado e à venda; encerrado = venda terminou. */
export type TeaserState = 'preparando' | 'disponivel' | 'encerrado';

/**
 * Estado na página permanente. null = não aparece para o público
 * (rascunho que o fotógrafo não anunciou). Só o status real "publicado" libera a galeria.
 */
export function teaserState(publicState: 'oculto' | 'aberto' | 'encerrado', announced: boolean): TeaserState | null {
  if (publicState === 'aberto') return 'disponivel';
  if (publicState === 'encerrado') return 'encerrado';
  return announced ? 'preparando' : null;
}

/** Situação da previsão: sem previsão, no futuro (com contagem) ou já passou (sem contagem negativa). */
export function forecastStatus(iso: string, now = Date.now()): 'nenhuma' | 'futura' | 'passou' {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return 'nenhuma';
  return t > now ? 'futura' : 'passou';
}

/** Contagem regressiva; null quando não há previsão válida ou ela já passou (nunca negativa). */
export function countdown(iso: string, now = Date.now()) {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t) || t <= now) return null;
  const s = Math.floor((t - now) / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60, total: s };
}

/** "Sábado, 28/11/2026 às 18:00" (horário de Manaus). */
export function forecastLabel(iso: string) {
  const l = isoToManaus(iso);
  if (!l) return '';
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const wd = days[new Date(`${l.slice(0, 10)}T12:00:00Z`).getUTCDay()];
  return `${wd}, ${l.slice(8, 10)}/${l.slice(5, 7)}/${l.slice(0, 4)} às ${l.slice(11, 16)}`;
}

/** Texto do botão principal do cartão. */
export function featuredLabel(name: string, state: TeaserState, custom = '') {
  if (custom && state === 'preparando') return custom;
  if (state === 'disponivel') return `Encontre suas fotos da ${name}`;
  if (state === 'encerrado') return `Fotos da ${name}`;
  return `Acompanhe as fotos da ${name}`;
}

/** Linha de apoio do botão principal. */
export function featuredHint(state: TeaserState, forecastIso: string, now = Date.now()) {
  if (state === 'disponivel') return 'Fotografias disponíveis. Encontre as suas.';
  if (state === 'encerrado') return 'As vendas deste evento foram encerradas.';
  return forecastStatus(forecastIso, now) === 'futura'
    ? 'Fotografias em preparação. Confira a previsão de publicação.'
    : 'Fotografias em preparação.';
}

/** "28/11/2026" a partir de "2026-11-28". */
export const formatDay = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');
