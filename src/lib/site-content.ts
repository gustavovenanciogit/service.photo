/**
 * EDIÇÃO DO SITE PELO PAINEL — VALIDAÇÃO
 * ------------------------------------------------------------------
 * Regras do que pode ser alterado em pricing.json e portfolio.json pelo painel.
 * O servidor aplica as alterações SOBRE o arquivo atual: campos que não estão
 * na lista de editáveis nunca mudam. Assim, uma edição não quebra o site.
 * Funções puras: usadas pelo servidor (worker/), pelo painel e pelos testes.
 */

// ───────────── Preços ─────────────

/** Campos de um pacote que o painel pode alterar. */
export const EDITABLE_PACKAGE_FIELDS = ['name', 'description', 'price', 'duration', 'delivery', 'benefits', 'highlight', 'active'] as const;
export type EditablePackage = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  duration: string | null;
  delivery: string | null;
  benefits: string[];
  highlight?: string;
  active: boolean;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
type Json = Record<string, unknown>;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/**
 * Aplica as edições ao pricing.json atual.
 * - Só pacotes existentes (mesmo `id`) e só campos editáveis.
 * - Preço: número entre 0 e 1.000.000 (até centavos) ou null (sob consulta).
 */
export function applyPricingEdits(current: { packages: Json[] }, edits: unknown): Result<{ packages: Json[]; changed: string[] }> {
  if (!Array.isArray(edits)) return { ok: false, error: 'Formato inválido.' };
  const byId = new Map(current.packages.map((p) => [p.id as string, p]));
  const changed: string[] = [];
  const next = current.packages.map((p) => ({ ...p }));

  for (const raw of edits as Json[]) {
    const id = typeof raw?.id === 'string' ? raw.id : '';
    const base = byId.get(id);
    if (!base) return { ok: false, error: `Pacote desconhecido: ${id || '(sem id)'}.` };
    const target = next.find((p) => p.id === id)!;

    const name = text(raw.name, 80);
    if (!name) return { ok: false, error: `O pacote "${base.name}" precisa de um nome.` };
    const description = text(raw.description, 300);

    let price: number | null;
    if (raw.price === null || raw.price === '') price = null;
    else {
      const n = typeof raw.price === 'number' ? raw.price : Number(String(raw.price).replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return { ok: false, error: `Preço inválido em "${name}".` };
      price = Math.round(n * 100) / 100;
    }
    // Itens com valor em percentual (ex.: +20%) não têm preço em reais editável.
    if (base.priceLabel) price = base.price as number | null;

    const opt = (v: unknown, max: number) => text(v, max) || null;
    const benefits = Array.isArray(raw.benefits) ? (raw.benefits as unknown[]).map((b) => text(b, 120)).filter(Boolean).slice(0, 10) : [];
    const highlight = text(raw.highlight, 30);

    const values: Json = {
      name,
      description,
      price,
      duration: opt(raw.duration, 60),
      delivery: opt(raw.delivery, 60),
      benefits,
      highlight: highlight || undefined,
      active: raw.active !== false,
    };
    let diff = false;
    for (const k of EDITABLE_PACKAGE_FIELDS) {
      const before = JSON.stringify(target[k] ?? null);
      const after = JSON.stringify(values[k] ?? null);
      if (before !== after) diff = true;
      if (values[k] === undefined) delete target[k];
      else target[k] = values[k];
    }
    if (diff) changed.push(name);
  }
  return { ok: true, value: { packages: next, changed } };
}

// ───────────── Portfólio ─────────────

export const PORTFOLIO_FOLDERS = ['esportes', 'artes-marciais', 'ensaios', 'eventos-sociais', 'eventos-corporativos'] as const;
export const PHOTO_PATH = /^(esportes|artes-marciais|ensaios|eventos-sociais|eventos-corporativos)\/[a-z0-9][a-z0-9-]{0,80}\.(jpg|jpeg|png|webp)$/;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export interface PortfolioFile {
  photos: { file: string; caption: string; hidden?: boolean }[];
  hero: { file: string; label: string; position?: string }[];
}

/**
 * Valida o portfolio.json enviado pelo painel.
 * `available` = arquivos que existirão no repositório após o salvamento.
 */
export function validatePortfolio(input: unknown, available: Set<string>): Result<PortfolioFile> {
  const o = (input ?? {}) as Json;
  if (!Array.isArray(o.photos) || !Array.isArray(o.hero)) return { ok: false, error: 'Formato inválido.' };
  const seen = new Set<string>();
  const photos: PortfolioFile['photos'] = [];
  for (const p of o.photos as Json[]) {
    const file = typeof p?.file === 'string' ? p.file : '';
    if (!PHOTO_PATH.test(file) || !available.has(file) || seen.has(file)) continue; // ignora entradas inválidas/duplicadas
    seen.add(file);
    photos.push({ file, caption: text(p.caption, 120), ...(p.hidden === true ? { hidden: true } : {}) });
  }
  const hero = (o.hero as Json[]).slice(0, 3).map((h) => ({
    file: typeof h?.file === 'string' ? h.file : '',
    label: text(h?.label, 30),
    position: typeof h?.position === 'string' && /^\d{1,3}% \d{1,3}%$/.test(h.position) ? h.position : '50% 50%',
  }));
  if (hero.length !== 3 || hero.some((h) => !PHOTO_PATH.test(h.file) || !available.has(h.file))) {
    return { ok: false, error: 'O mosaico do topo precisa de 3 fotos do portfólio.' };
  }
  if (hero.some((h) => photos.find((p) => p.file === h.file)?.hidden)) {
    return { ok: false, error: 'Uma foto oculta não pode ficar no mosaico do topo.' };
  }
  return { ok: true, value: { photos, hero } };
}

/** Confere o tipo real do arquivo pelos primeiros bytes (JPEG, PNG ou WebP). */
export function imageKind(bytes: Uint8Array): 'jpg' | 'png' | 'webp' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'webp';
  return null;
}

/** "Corrida na Ponta Negra!" → "corrida-na-ponta-negra" */
export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'foto';
