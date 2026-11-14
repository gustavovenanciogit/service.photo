/**
 * Avisos no Telegram (pedidos novos e resumo diário).
 * ------------------------------------------------------------------
 * Segredo necessário: TELEGRAM_BOT_TOKEN (do @BotFather). Veja o README.
 * O chat é conectado por um código de pareamento gerado no painel:
 * só quem abre o link com o código (você) passa a receber os avisos.
 */
import * as db from './db.ts';

export interface TelegramEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_API_URL?: string; // só para testes locais
  DB: D1Database;
}

const api = (env: TelegramEnv) => `${(env.TELEGRAM_API_URL || 'https://api.telegram.org').replace(/\/$/, '')}/bot${env.TELEGRAM_BOT_TOKEN}`;

async function call<T>(env: TelegramEnv, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${api(env)}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!res.ok || !data.ok) {
    if (res.status === 401 || res.status === 404) throw new Error('O token do robô do Telegram é inválido. Confira o segredo TELEGRAM_BOT_TOKEN.');
    throw new Error(data.description ? `Telegram: ${data.description}` : 'Não foi possível falar com o Telegram agora.');
  }
  return data.result as T;
}

export const botConfigured = (env: TelegramEnv) => !!env.TELEGRAM_BOT_TOKEN;

export const botInfo = (env: TelegramEnv) => call<{ username: string }>(env, 'getMe');

/** Envia texto simples (sem formatação: nada vira comando ou link escondido). */
export const sendText = (env: TelegramEnv, chatId: string, text: string) =>
  call(env, 'sendMessage', { chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true });

/** Gera um código de pareamento válido por 15 minutos. */
export async function createPairCode(env: TelegramEnv) {
  const code = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => (b % 36).toString(36)).join('').toUpperCase() + String(Date.now() % 1000).padStart(3, '0');
  await db.setSetting(env.DB, 'telegram_pair', JSON.stringify({ code, exp: Date.now() + 15 * 60_000 }));
  return code;
}

/** Procura, nas mensagens recentes do robô, o código de pareamento. */
export async function connectWithCode(env: TelegramEnv) {
  const s = await db.getSettings(env.DB);
  const pair = s.telegram_pair ? (JSON.parse(s.telegram_pair) as { code: string; exp: number }) : null;
  if (!pair || pair.exp < Date.now()) throw new Error('O código expirou. Gere um novo.');
  const updates = await call<{ message?: { text?: string; chat: { id: number; type: string; first_name?: string } } }[]>(env, 'getUpdates', {
    allowed_updates: ['message'],
  });
  const match = updates
    .map((u) => u.message)
    .reverse()
    .find((m) => m?.chat.type === 'private' && (m.text ?? '').replace('/start', '').trim().toUpperCase() === pair.code);
  if (!match) return null;
  const chatId = String(match.chat.id);
  await db.setSetting(env.DB, 'telegram_chat_id', chatId);
  await db.setSetting(env.DB, 'telegram_pair', '');
  await sendText(env, chatId, '✅ Pronto! Você vai receber aqui os avisos do painel Venart: pedidos novos do site e o resumo do dia às 7h.');
  return { chatId, name: match.chat.first_name ?? '' };
}

/** Envia um aviso se o Telegram estiver conectado e a opção ligada. Nunca lança erro. */
export async function notify(env: TelegramEnv, setting: 'notify_leads' | 'daily_summary', text: string) {
  try {
    if (!botConfigured(env) || !text) return false;
    const s = await db.getSettings(env.DB);
    if (!s.telegram_chat_id || s[setting] === '0') return false;
    await sendText(env, s.telegram_chat_id, text);
    return true;
  } catch (e) {
    console.error('Telegram', e);
    return false;
  }
}
