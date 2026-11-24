/**
 * AVISO DE PUBLICAÇÃO POR E-MAIL — regras puras
 * ------------------------------------------------------------------
 * Na página de espera do evento (/eventos/<endereço>) a pessoa pode pedir, por vontade própria,
 * um aviso por e-mail quando as fotos forem publicadas. Regras (LGPD):
 *  - Consentimento explícito (caixa marcada pela pessoa), com versão e data guardadas.
 *  - Uso único: só esse aviso, deste evento. Nada de lista de marketing.
 *  - O e-mail é APAGADO logo depois do envio (fica só a contagem de avisos enviados).
 *  - Pedidos de eventos que nunca foram publicados são apagados depois de RETENTION_DAYS.
 *  - Pode cancelar antes do envio.
 * O envio só acontece quando o evento é publicado de verdade e o serviço de e-mail está configurado
 * (segredo RESEND_API_KEY + variável EMAIL_FROM). Sem isso, o formulário nem aparece.
 */

export const NOTIFY_CONSENT_VERSION = 'aviso-email-v1';
export const NOTIFY_CONSENT_TEXT =
  'Autorizo o uso deste e-mail apenas para receber um aviso quando as fotos deste evento forem publicadas. O e-mail é apagado logo depois do aviso, e posso cancelar antes disso.';
export const RETENTION_DAYS = 180;
/** Quantos e-mails por chamada ao serviço de envio (limite do envio em lote). */
export const BATCH = 100;
export const MAX_ATTEMPTS = 5;

/** Normaliza e valida um e-mail ('' = inválido). Sem consultas externas. */
export function normalizeEmail(v: unknown) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s.length < 6 || s.length > 254) return '';
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(s)) return '';
  const [local, domain] = s.split('@') as [string, string];
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return '';
  if (!/\.[a-z]{2,}$/.test(domain)) return '';
  return s;
}

/** "jo***@gmail.com" — para mostrar na tela sem expor o e-mail inteiro. */
export function maskEmail(email: string) {
  const [l = '', d = ''] = email.split('@');
  return `${l.slice(0, 2)}${'*'.repeat(Math.max(1, Math.min(4, l.length - 2)))}@${d}`;
}

const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface NoticeEvent {
  name: string;
  date: string; // AAAA-MM-DD
  location: string;
  url: string; // endereço absoluto da página do evento
}

/** Conteúdo do e-mail de aviso (assunto, HTML simples e texto puro). */
export function noticeEmail(e: NoticeEvent, brand = 'Venart') {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? `${e.date.slice(8, 10)}/${e.date.slice(5, 7)}/${e.date.slice(0, 4)}` : '';
  const where = [day, e.location].filter(Boolean).join(' · ');
  const subject = `Suas fotos de ${e.name} já estão disponíveis`;
  const text = [
    `As fotos de ${e.name}${where ? ` (${where})` : ''} foram publicadas.`,
    '',
    `Encontre as suas: ${e.url}`,
    '',
    `Você recebeu este aviso porque pediu na página do evento. Ele é único: seu e-mail já foi apagado da nossa lista.`,
    `— ${brand}`,
  ].join('\n');
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#070a08;font-family:Arial,Helvetica,sans-serif;color:#f5faf5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070a08;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#0f1a13;border:1px solid #1f3a28;border-radius:16px">
<tr><td style="padding:28px 24px">
<p style="margin:0;font-size:22px;font-weight:800;letter-spacing:1px">${esc(brand.toUpperCase())}<span style="color:#8be07a">.</span></p>
<p style="margin:20px 0 4px;font-size:12px;font-weight:700;letter-spacing:2px;color:#8be07a;text-transform:uppercase">Fotografias disponíveis</p>
<h1 style="margin:0;font-size:24px;line-height:1.25">${esc(e.name)}</h1>
${where ? `<p style="margin:6px 0 0;font-size:14px;color:#9ba59e">${esc(where)}</p>` : ''}
<p style="margin:18px 0;font-size:15px;line-height:1.5">As fotos foram publicadas. Toque no botão para encontrar as suas.</p>
<a href="${esc(e.url)}" style="display:inline-block;background:#8be07a;color:#070a08;font-weight:800;text-decoration:none;padding:14px 24px;border-radius:999px;font-size:15px">Encontrar minhas fotos</a>
<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#9ba59e">Você recebeu este aviso porque pediu na página do evento. Ele é único: seu e-mail já foi apagado da nossa lista.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/** Envio de e-mail configurado? (sem a chave ou o remetente, o recurso fica desligado). */
export const emailConfigured = (env: { RESEND_API_KEY?: string; EMAIL_FROM?: string }) => !!env.RESEND_API_KEY && !!env.EMAIL_FROM;
