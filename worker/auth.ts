/**
 * Login do painel.
 * - A senha fica no segredo ADMIN_PASSWORD da Cloudflare (nunca no código).
 * - A sessão é um cookie assinado (HMAC-SHA256), HttpOnly, Secure e SameSite=Strict.
 * - Trocar a senha encerra todas as sessões abertas.
 * - Depois de 8 tentativas erradas em 15 minutos, o IP é bloqueado temporariamente.
 */

export interface AuthEnv {
  ADMIN_PASSWORD?: string;
  DB: D1Database;
}

export const COOKIE = 'venart_session';
const SESSION_DAYS = 30;
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const hmacKey = (secret: string) =>
  crypto.subtle.importKey('raw', enc.encode(`venart-session:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

const sha256 = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));

/** Compara a senha sem vazar informação pelo tempo de resposta. */
export async function passwordMatches(given: string, expected: string) {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

export async function createSession(secret: string) {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = String(exp);
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload));
  return { token: `${payload}.${b64url(sig)}`, maxAge: SESSION_DAYS * 86_400 };
}

export async function verifySession(token: string | undefined, secret: string | undefined) {
  if (!token || !secret) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !/^\d+$/.test(payload) || Number(payload) < Date.now()) return false;
  const expected = b64url(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload)));
  if (expected.length !== sig.length) return false;
  return crypto.subtle.timingSafeEqual(enc.encode(expected), enc.encode(sig));
}

export const readCookie = (req: Request, name: string) =>
  (req.headers.get('Cookie') ?? '')
    .split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === name)?.[1];

export const sessionCookie = (token: string, maxAge: number) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export const isLoggedIn = (req: Request, env: AuthEnv) => verifySession(readCookie(req, COOKIE), env.ADMIN_PASSWORD);

// ───────── Limite de tentativas ─────────

export async function tooManyAttempts(db: D1Database, ip: string) {
  const row = await db.prepare('SELECT count, first_at FROM login_attempts WHERE ip = ?').bind(ip).first<{ count: number; first_at: number }>();
  return !!row && row.count >= MAX_ATTEMPTS && Date.now() - row.first_at < WINDOW_MS;
}

export async function registerFailure(db: D1Database, ip: string) {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO login_attempts (ip, count, first_at) VALUES (?1, 1, ?2)
       ON CONFLICT(ip) DO UPDATE SET
         count = CASE WHEN ?2 - first_at > ?3 THEN 1 ELSE count + 1 END,
         first_at = CASE WHEN ?2 - first_at > ?3 THEN ?2 ELSE first_at END`,
    )
    .bind(ip, now, WINDOW_MS)
    .run();
}

export const clearFailures = (db: D1Database, ip: string) => db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
