/**
 * Integração com o GitHub (edição do site pelo painel).
 * ------------------------------------------------------------------
 * O painel grava as alterações (preços, fotos) direto no repositório.
 * A Cloudflare publica o site sozinha a cada commit na branch principal.
 *
 * Segredo necessário: GITHUB_TOKEN (token "fine-grained" com acesso SÓ a este
 * repositório: Contents = Read and write). Veja o README.
 */

export interface GitHubEnv {
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string; // "dono/repositorio"
  GITHUB_BRANCH?: string; // "main"
  GITHUB_API_URL?: string; // só para testes locais
}

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const cfg = (env: GitHubEnv) => {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    throw new GitHubError(503, 'Edição do site ainda não configurada: defina o segredo GITHUB_TOKEN na Cloudflare (veja o README).');
  }
  return { token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH || 'main', api: (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '') };
};

async function gh<T>(env: GitHubEnv, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const c = cfg(env);
  const res = await fetch(`${c.api}/repos/${c.repo}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${c.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'venart-painel',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (res.status === 401) throw new GitHubError(502, 'O token do GitHub é inválido ou expirou. Gere um novo e atualize o segredo GITHUB_TOKEN.');
    if (res.status === 403 || res.status === 404) throw new GitHubError(502, 'O token do GitHub não tem permissão neste repositório (precisa de Contents: Read and write).');
    if (res.status === 409 || res.status === 422) throw new GitHubError(409, 'O site foi alterado por outro lugar enquanto você editava. Recarregue a página e tente de novo.');
    console.error('GitHub', res.status, path, detail.slice(0, 300));
    throw new GitHubError(502, 'Não foi possível falar com o GitHub agora. Tente de novo em instantes.');
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

const b64ToText = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

/** Lê um arquivo de texto do repositório (conteúdo + sha do blob). */
export async function readFile(env: GitHubEnv, path: string) {
  const { branch } = cfg(env);
  const r = await gh<{ content: string; sha: string }>(env, `/contents/${path}?ref=${encodeURIComponent(branch)}`);
  return { text: b64ToText(r.content), sha: r.sha };
}

/** Lista arquivos do repositório que começam com `prefix`. */
export async function listFiles(env: GitHubEnv, prefix: string) {
  const { branch } = cfg(env);
  const r = await gh<{ tree: { path: string; type: string }[]; truncated: boolean }>(env, `/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  return r.tree.filter((t) => t.type === 'blob' && t.path.startsWith(prefix)).map((t) => t.path);
}

export type FileChange =
  | { path: string; text: string }
  | { path: string; base64: string }
  | { path: string; delete: true };

/**
 * Cria UM commit com todas as alterações (atômico) na branch principal.
 * `expect` confere se um arquivo não mudou desde que o painel o leu.
 */
export async function commitChanges(env: GitHubEnv, message: string, changes: FileChange[], expect?: { path: string; sha: string }) {
  const { branch } = cfg(env);
  const ref = await gh<{ object: { sha: string } }>(env, `/git/ref/heads/${encodeURIComponent(branch)}`);
  const head = await gh<{ tree: { sha: string } }>(env, `/git/commits/${ref.object.sha}`);

  if (expect) {
    const now = await readFile(env, expect.path);
    if (now.sha !== expect.sha) throw new GitHubError(409, 'O site foi alterado por outro lugar enquanto você editava. Recarregue a página e tente de novo.');
  }

  const tree = await Promise.all(
    changes.map(async (c) => {
      if ('delete' in c) return { path: c.path, mode: '100644', type: 'blob', sha: null };
      const blob = await gh<{ sha: string }>(env, '/git/blobs', {
        method: 'POST',
        body: 'text' in c ? { content: c.text, encoding: 'utf-8' } : { content: c.base64, encoding: 'base64' },
      });
      return { path: c.path, mode: '100644', type: 'blob', sha: blob.sha };
    }),
  );
  const newTree = await gh<{ sha: string }>(env, '/git/trees', { method: 'POST', body: { base_tree: head.tree.sha, tree } });
  const commit = await gh<{ sha: string; html_url: string }>(env, '/git/commits', {
    method: 'POST',
    body: { message, tree: newTree.sha, parents: [ref.object.sha] },
  });
  // Sem "force": se a branch mudou no meio do caminho, o GitHub recusa (evita sobrescrever).
  await gh(env, `/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', body: { sha: commit.sha, force: false } });
  return { sha: commit.sha, url: commit.html_url };
}

/** Situação da publicação: último commit e o resultado das verificações (deploy da Cloudflare). */
export async function deployStatus(env: GitHubEnv) {
  const { branch } = cfg(env);
  const c = await gh<{ sha: string; html_url: string; commit: { message: string; author: { date: string } } }>(env, `/commits/${encodeURIComponent(branch)}`);
  let state: 'success' | 'pending' | 'failure' | 'unknown' = 'unknown';
  try {
    const runs = await gh<{ check_runs: { status: string; conclusion: string | null }[] }>(env, `/commits/${c.sha}/check-runs`);
    if (runs.check_runs.length) {
      if (runs.check_runs.some((r) => r.status !== 'completed')) state = 'pending';
      else if (runs.check_runs.some((r) => ['failure', 'cancelled', 'timed_out', 'action_required'].includes(r.conclusion ?? ''))) state = 'failure';
      else state = 'success';
    }
  } catch {
    // Token sem permissão de leitura das verificações: o painel mostra "confira na Cloudflare".
  }
  return { sha: c.sha, message: c.commit.message.split('\n')[0], date: c.commit.author.date, url: c.html_url, state };
}
