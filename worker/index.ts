/**
 * SERVIDOR (Cloudflare Worker)
 * ------------------------------------------------------------------
 * - Site público: servido direto da pasta dist/ (não passa por aqui).
 * - /painel/*  → área do profissional, exige login (exceto a tela de login).
 * - /api/*     → dados do painel (clientes e propostas), exige login.
 * - /proposta/nova → antigo endereço do gerador, redireciona para o painel.
 *
 * Senha: segredo ADMIN_PASSWORD (Cloudflare → Workers & Pages → venart → Settings → Variables and Secrets).
 */
import { parseClient, parseProposal, PROPOSAL_STATUSES, newId } from '../src/lib/crm.ts';
import {
  clearCookie, clearFailures, createSession, isLoggedIn, passwordMatches,
  registerFailure, sessionCookie, tooManyAttempts, type AuthEnv,
} from './auth.ts';
import * as db from './db.ts';

interface Env extends AuthEnv {
  ASSETS: Fetcher;
}

const MAX_BODY = 200_000;

const securityHeaders = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...securityHeaders, ...headers } });

const withHeaders = (res: Response) => {
  const r = new Response(res.body, res);
  Object.entries(securityHeaders).forEach(([k, v]) => r.headers.set(k, v));
  return r;
};

async function readJson(req: Request): Promise<unknown> {
  const len = Number(req.headers.get('Content-Length') ?? 0);
  if (len > MAX_BODY) throw new HttpError(413, 'Conteúdo grande demais.');
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'Conteúdo grande demais.');
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new HttpError(400, 'JSON inválido.');
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ───────── API ─────────

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  const method = req.method;
  const path = url.pathname.replace(/\/+$/, '');

  // Proteção contra requisições de outros sites (além do cookie SameSite=Strict).
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = req.headers.get('Origin');
    if (origin !== url.origin) return json({ error: 'Origem não permitida.' }, 403);
  }

  if (!env.ADMIN_PASSWORD) return json({ error: 'Painel ainda não configurado: defina o segredo ADMIN_PASSWORD na Cloudflare.' }, 503);
  await db.ensureSchema(env.DB);

  if (path === '/api/login' && method === 'POST') {
    const ip = req.headers.get('CF-Connecting-IP') ?? 'local';
    if (await tooManyAttempts(env.DB, ip)) return json({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
    const body = (await readJson(req)) as { password?: unknown };
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password || !(await passwordMatches(password, env.ADMIN_PASSWORD))) {
      await registerFailure(env.DB, ip);
      await new Promise((r) => setTimeout(r, 600)); // desacelera tentativas
      return json({ error: 'Senha incorreta.' }, 401);
    }
    await clearFailures(env.DB, ip);
    const { token, maxAge } = await createSession(env.ADMIN_PASSWORD);
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, maxAge) });
  }

  if (path === '/api/logout' && method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });

  if (!(await isLoggedIn(req, env))) return json({ error: 'Faça login novamente.' }, 401);

  if (path === '/api/session') return json({ ok: true });

  // Clientes
  if (path === '/api/clients') {
    if (method === 'GET') return json(await db.listClients(env.DB));
    if (method === 'POST') {
      const parsed = parseClient(await readJson(req));
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      return json(await db.insertClient(env.DB, newId('cli'), parsed.value), 201);
    }
  }
  const clientMatch = /^\/api\/clients\/([\w-]{1,40})$/.exec(path);
  if (clientMatch) {
    const id = clientMatch[1]!;
    if (method === 'PUT') {
      const parsed = parseClient(await readJson(req));
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      const c = await db.updateClient(env.DB, id, parsed.value);
      return c ? json(c) : json({ error: 'Cliente não encontrado.' }, 404);
    }
    if (method === 'DELETE') return (await db.deleteClient(env.DB, id)) ? json({ ok: true }) : json({ error: 'Cliente não encontrado.' }, 404);
  }

  // Propostas
  if (path === '/api/proposals' && method === 'GET') return json(await db.listProposals(env.DB));
  const propMatch = /^\/api\/proposals\/(VEN-\d{6}-[A-Z0-9]{4})$/.exec(path);
  if (propMatch) {
    const id = propMatch[1]!;
    if (method === 'GET') {
      const p = await db.getProposal(env.DB, id);
      return p ? json(p) : json({ error: 'Proposta não encontrada.' }, 404);
    }
    if (method === 'PUT') {
      const parsed = parseProposal({ ...(await readJson(req) as object), id });
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      return json(await db.upsertProposal(env.DB, parsed.value));
    }
    if (method === 'PATCH') {
      const body = (await readJson(req)) as Record<string, unknown>;
      const fields: { status?: string; notes?: string; client_id?: string } = {};
      if (body.status !== undefined) {
        if (!PROPOSAL_STATUSES.some((s) => s.id === body.status)) return json({ error: 'Status inválido.' }, 400);
        fields.status = body.status as string;
      }
      if (typeof body.notes === 'string') fields.notes = body.notes.slice(0, 4000);
      if (typeof body.client_id === 'string') fields.client_id = body.client_id.slice(0, 40);
      const p = await db.patchProposal(env.DB, id, fields);
      return p ? json(p) : json({ error: 'Proposta não encontrada.' }, 404);
    }
    if (method === 'DELETE') return (await db.deleteProposal(env.DB, id)) ? json({ ok: true }) : json({ error: 'Proposta não encontrada.' }, 404);
  }

  return json({ error: 'Não encontrado.' }, 404);
}

// ───────── Roteamento ─────────

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    try {
      if (path.startsWith('/api/')) return await api(req, env, url);

      // Endereço antigo do gerador.
      if (path === '/proposta/nova' || path === '/proposta/nova/') {
        return Response.redirect(`${url.origin}/painel/propostas/nova/`, 301);
      }

      if (path === '/painel' || path.startsWith('/painel/')) {
        const isLogin = /^\/painel\/login\/?$/.test(path);
        if (!isLogin && !(await isLoggedIn(req, env))) {
          const next = encodeURIComponent(path + url.search);
          return Response.redirect(`${url.origin}/painel/login/?next=${next}`, 302);
        }
        return withHeaders(await env.ASSETS.fetch(req));
      }

      return env.ASSETS.fetch(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Erro interno. Tente novamente.' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
