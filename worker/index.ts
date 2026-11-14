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
import { LEAD_STATUSES, parseClient, parseJob, parseLead, parseProposal, PROPOSAL_STATUSES, newId } from '../src/lib/crm.ts';
import { dailyDigest, leadMessage } from '../src/lib/digest.ts';
import { todayInManaus } from '../src/lib/schedule.ts';
import * as telegram from './telegram.ts';
import {
  clearCookie, clearFailures, createSession, isLoggedIn, passwordMatches,
  registerFailure, sessionCookie, tooManyAttempts, type AuthEnv,
} from './auth.ts';
import * as db from './db.ts';
import { commitChanges, deployStatus, GitHubError, listFiles, readFile, type FileChange, type GitHubEnv } from './github.ts';
import { applyPricingEdits, imageKind, MAX_PHOTO_BYTES, PHOTO_PATH, validatePortfolio } from '../src/lib/site-content.ts';

interface Env extends AuthEnv, GitHubEnv, telegram.TelegramEnv {
  ASSETS: Fetcher;
  /** Endereço público do site (usado nos links dos avisos). */
  PUBLIC_URL?: string;
}

const MAX_BODY = 200_000;

const sha256Hex = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

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

async function readJson(req: Request, max = MAX_BODY): Promise<unknown> {
  const len = Number(req.headers.get('Content-Length') ?? 0);
  if (len > max) throw new HttpError(413, 'Conteúdo grande demais.');
  const text = await req.text();
  if (text.length > max) throw new HttpError(413, 'Conteúdo grande demais.');
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

async function api(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  const method = req.method;
  const path = url.pathname.replace(/\/+$/, '');

  // Proteção contra requisições de outros sites (além do cookie SameSite=Strict).
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = req.headers.get('Origin');
    if (origin !== url.origin) return json({ error: 'Origem não permitida.' }, 403);
  }

  // ── Público: a data está ocupada? (só sim/não, sem detalhes) ──
  if (path === '/api/availability' && method === 'GET') {
    const date = url.searchParams.get('date') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Data inválida.' }, 400);
    await db.ensureSchema(env.DB);
    return new Response(JSON.stringify({ busy: await db.isDateBusy(env.DB, date) }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
    });
  }

  // ── Público: pedido enviado pelo site (formulário/simulador) ──
  if (path === '/api/leads' && method === 'POST') {
    await db.ensureSchema(env.DB);
    const body = (await readJson(req)) as Record<string, unknown>;
    // Campo-armadilha: invisível para pessoas, robôs costumam preencher.
    if (typeof body.website === 'string' && body.website.trim()) return json({ ok: true });
    const ip = req.headers.get('CF-Connecting-IP') ?? 'local';
    const ipHash = await sha256Hex(`venart-leads:${ip}`);
    if (!(await db.allowLead(env.DB, ipHash))) return json({ error: 'Muitos pedidos seguidos. Tente mais tarde.' }, 429);
    const parsed = parseLead(body);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    await db.insertLead(env.DB, newId('ped'), parsed.value);
    // Aviso no Telegram sem atrasar a resposta ao cliente.
    ctx.waitUntil(telegram.notify(env, 'notify_leads', leadMessage(parsed.value, env.PUBLIC_URL || url.origin)));
    return json({ ok: true }, 201);
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

  // Pedidos do site (painel)
  // Agenda de trabalhos
  if (path === '/api/jobs') {
    if (method === 'GET') return json(await db.listJobs(env.DB));
    if (method === 'POST') {
      const parsed = parseJob(await readJson(req));
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      return json(await db.insertJob(env.DB, newId('job'), parsed.value), 201);
    }
  }
  const jobMatch = /^\/api\/jobs\/(job_[a-z0-9]{1,30})$/.exec(path);
  if (jobMatch) {
    const id = jobMatch[1]!;
    if (method === 'PUT') {
      const parsed = parseJob(await readJson(req));
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      const j = await db.updateJob(env.DB, id, parsed.value);
      return j ? json(j) : json({ error: 'Trabalho não encontrado.' }, 404);
    }
    if (method === 'DELETE') return (await db.deleteJob(env.DB, id)) ? json({ ok: true }) : json({ error: 'Trabalho não encontrado.' }, 404);
  }

  // Notificações (Telegram)
  if (path.startsWith('/api/notifications')) return notificationsApi(req, env, path, method);

  if (path === '/api/leads' && method === 'GET') return json(await db.listLeads(env.DB));
  if (path === '/api/leads/count' && method === 'GET') return json({ novo: await db.countNewLeads(env.DB) });
  const leadMatch = /^\/api\/leads\/(ped_[a-z0-9]{1,30})$/.exec(path);
  if (leadMatch) {
    const id = leadMatch[1]!;
    if (method === 'PATCH') {
      const body = (await readJson(req)) as { status?: unknown };
      if (!LEAD_STATUSES.some((s) => s.id === body.status)) return json({ error: 'Status inválido.' }, 400);
      const l = await db.setLeadStatus(env.DB, id, body.status as string);
      return l ? json(l) : json({ error: 'Pedido não encontrado.' }, 404);
    }
    if (method === 'DELETE') return (await db.deleteLead(env.DB, id)) ? json({ ok: true }) : json({ error: 'Pedido não encontrado.' }, 404);
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

  if (path.startsWith('/api/site/')) return siteApi(req, env, path, method);

  return json({ error: 'Não encontrado.' }, 404);
}

// ───────── Edição do site (grava no GitHub) ─────────

const PRICING_PATH = 'src/data/pricing.json';
const PORTFOLIO_PATH = 'src/data/portfolio.json';
const PHOTOS_DIR = 'src/assets/portfolio/';
const MAX_UPLOADS = 10;

async function siteApi(req: Request, env: Env, path: string, method: string): Promise<Response> {
  if (path === '/api/site/status' && method === 'GET') {
    if (!env.GITHUB_TOKEN) return json({ configured: false });
    return json({ configured: true, ...(await deployStatus(env)) });
  }

  if (path === '/api/site/pricing') {
    if (method === 'GET') {
      const f = await readFile(env, PRICING_PATH);
      return json({ data: JSON.parse(f.text), sha: f.sha });
    }
    if (method === 'PUT') {
      const body = (await readJson(req)) as { sha?: unknown; edits?: unknown };
      if (typeof body.sha !== 'string') return json({ error: 'Recarregue a página e tente de novo.' }, 400);
      const current = await readFile(env, PRICING_PATH);
      if (current.sha !== body.sha) return json({ error: 'Os preços foram alterados por outro lugar. Recarregue a página.' }, 409);
      const result = applyPricingEdits(JSON.parse(current.text), body.edits);
      if (!result.ok) return json({ error: result.error }, 400);
      if (!result.value.changed.length) return json({ ok: true, changed: [] });
      const names = result.value.changed;
      const message = `Painel: atualiza preços (${names.slice(0, 4).join(', ')}${names.length > 4 ? ` e mais ${names.length - 4}` : ''})`;
      const commit = await commitChanges(env, message, [{ path: PRICING_PATH, text: `${JSON.stringify({ packages: result.value.packages }, null, 2)}\n` }], {
        path: PRICING_PATH,
        sha: body.sha,
      });
      return json({ ok: true, changed: names, commit });
    }
  }

  if (path === '/api/site/portfolio') {
    if (method === 'GET') {
      const [f, files] = await Promise.all([readFile(env, PORTFOLIO_PATH), listFiles(env, PHOTOS_DIR)]);
      return json({ data: JSON.parse(f.text), sha: f.sha, files: files.map((x) => x.slice(PHOTOS_DIR.length)).filter((x) => PHOTO_PATH.test(x)) });
    }
    if (method === 'PUT') {
      const body = (await readJson(req, 30_000_000)) as { sha?: unknown; data?: unknown; uploads?: unknown; deletes?: unknown };
      if (typeof body.sha !== 'string') return json({ error: 'Recarregue a página e tente de novo.' }, 400);
      const uploads = Array.isArray(body.uploads) ? (body.uploads as { file?: unknown; base64?: unknown }[]) : [];
      const deletes = Array.isArray(body.deletes) ? (body.deletes as unknown[]).filter((d): d is string => typeof d === 'string') : [];
      if (uploads.length > MAX_UPLOADS) return json({ error: `Envie no máximo ${MAX_UPLOADS} fotos por vez.` }, 400);

      const existing = new Set((await listFiles(env, PHOTOS_DIR)).map((x) => x.slice(PHOTOS_DIR.length)));
      const changes: FileChange[] = [];
      for (const u of uploads) {
        const file = typeof u.file === 'string' ? u.file : '';
        const base64 = typeof u.base64 === 'string' ? u.base64 : '';
        if (!PHOTO_PATH.test(file) || existing.has(file)) return json({ error: 'Nome de arquivo inválido. Tente de novo.' }, 400);
        let bytes: Uint8Array;
        try {
          bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        } catch {
          return json({ error: 'Arquivo de foto corrompido.' }, 400);
        }
        if (bytes.length > MAX_PHOTO_BYTES) return json({ error: 'Foto grande demais (máx. 8 MB).' }, 400);
        const kind = imageKind(bytes);
        const ext = file.split('.').pop()!.replace('jpeg', 'jpg');
        if (!kind || kind !== ext) return json({ error: 'Envie fotos em JPG, PNG ou WebP.' }, 400);
        changes.push({ path: PHOTOS_DIR + file, base64 });
      }
      for (const d of deletes) {
        if (!PHOTO_PATH.test(d) || !existing.has(d)) return json({ error: 'Foto para excluir não encontrada. Recarregue a página.' }, 400);
        changes.push({ path: PHOTOS_DIR + d, delete: true });
      }
      const available = new Set([...existing].filter((f) => !deletes.includes(f)));
      uploads.forEach((u) => available.add(u.file as string));
      const valid = validatePortfolio(body.data, available);
      if (!valid.ok) return json({ error: valid.error }, 400);
      changes.push({ path: PORTFOLIO_PATH, text: `${JSON.stringify(valid.value, null, 2)}\n` });

      const parts = [uploads.length && `+${uploads.length} foto(s)`, deletes.length && `−${deletes.length} foto(s)`].filter(Boolean);
      const commit = await commitChanges(env, `Painel: atualiza portfólio${parts.length ? ` (${parts.join(', ')})` : ''}`, changes, { path: PORTFOLIO_PATH, sha: body.sha });
      return json({ ok: true, commit });
    }
  }
  return json({ error: 'Não encontrado.' }, 404);
}

// ───────── Notificações (Telegram) ─────────

async function notificationsApi(req: Request, env: Env, path: string, method: string): Promise<Response> {
  const fail = (e: unknown) => json({ error: (e as Error).message }, 502);
  const settings = await db.getSettings(env.DB);
  if (path === '/api/notifications' && method === 'GET') {
    let bot = '';
    if (telegram.botConfigured(env)) bot = await telegram.botInfo(env).then((b) => b.username).catch(() => '');
    return json({
      botConfigured: telegram.botConfigured(env),
      botUsername: bot,
      connected: !!settings.telegram_chat_id,
      notify_leads: settings.notify_leads !== '0',
      daily_summary: settings.daily_summary !== '0',
    });
  }
  if (path === '/api/notifications' && method === 'PUT') {
    const body = (await readJson(req)) as { notify_leads?: unknown; daily_summary?: unknown };
    if (typeof body.notify_leads === 'boolean') await db.setSetting(env.DB, 'notify_leads', body.notify_leads ? '1' : '0');
    if (typeof body.daily_summary === 'boolean') await db.setSetting(env.DB, 'daily_summary', body.daily_summary ? '1' : '0');
    return json({ ok: true });
  }
  if (!telegram.botConfigured(env)) return json({ error: 'Defina o segredo TELEGRAM_BOT_TOKEN na Cloudflare (veja o README).' }, 503);
  if (path === '/api/notifications/pair' && method === 'POST') {
    try {
      const [code, bot] = await Promise.all([telegram.createPairCode(env), telegram.botInfo(env)]);
      return json({ code, link: `https://t.me/${bot.username}?start=${code}` });
    } catch (e) { return fail(e); }
  }
  if (path === '/api/notifications/connect' && method === 'POST') {
    try {
      const r = await telegram.connectWithCode(env);
      return r ? json({ ok: true, name: r.name }) : json({ error: 'Ainda não recebi o código. Abra o link, toque em "Iniciar" e tente de novo.' }, 404);
    } catch (e) { return fail(e); }
  }
  if (path === '/api/notifications/test' && method === 'POST') {
    if (!settings.telegram_chat_id) return json({ error: 'Conecte o Telegram primeiro.' }, 400);
    try {
      await telegram.sendText(env, settings.telegram_chat_id, '🔔 Teste do painel Venart: os avisos estão funcionando!');
      return json({ ok: true });
    } catch (e) { return fail(e); }
  }
  if (path === '/api/notifications' && method === 'DELETE') {
    await db.setSetting(env.DB, 'telegram_chat_id', '');
    return json({ ok: true });
  }
  return json({ error: 'Não encontrado.' }, 404);
}

/** Resumo diário (gatilho agendado: 7h de Manaus). */
async function sendDailyDigest(env: Env) {
  await db.ensureSchema(env.DB);
  const [jobs, clients, proposals, newLeads] = await Promise.all([db.listJobs(env.DB), db.listClients(env.DB), db.listProposals(env.DB), db.countNewLeads(env.DB)]);
  const text = dailyDigest({ today: todayInManaus(), jobs, clients, proposals, newLeads }, env.PUBLIC_URL ?? '');
  return telegram.notify(env, 'daily_summary', text);
}

// ───────── Roteamento ─────────

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(sendDailyDigest(env));
  },

  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    try {
      if (path.startsWith('/api/')) return await api(req, env, url, ctx);

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
      if (e instanceof HttpError || e instanceof GitHubError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Erro interno. Tente novamente.' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
