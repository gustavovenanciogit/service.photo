/**
 * Desenho do Cartão Digital — o MESMO HTML na página pública (/cartao) e na prévia de celular do
 * painel (assim a prévia é fiel). Todo texto vindo do banco passa por esc().
 */
import { featuredHint, featuredLabel, forecastLabel, forecastStatus, formatDay, instagramProfile, tiktokProfile, type CartaoButton, type TeaserState } from './cartao.ts';

export interface CartaoFeatured {
  slug: string;
  name: string;
  date: string;
  location: string;
  state: TeaserState;
  forecast: string; // ISO UTC ('' = sem previsão)
  text: string;
  label: string;
  cover: string; // endereço da capa ('' = sem capa)
}

/** Foto da vitrine (gerada no build a partir do portfólio). */
export interface ShowcasePhoto {
  key: string; // "pasta/arquivo.jpg"
  url: string;
  alt: string;
  label: string; // categoria
}

export interface CartaoPublic {
  name: string; // nome curto (logo)
  tagline: string;
  headline: string;
  intro: string;
  show_past: boolean;
  hire: CartaoButton;
  work: CartaoButton;
  featured: CartaoFeatured | null;
  showcase: { title: string; always: boolean; photos: ShowcasePhoto[] };
  social: { instagram: string; tiktok: string };
}

/** O que a API devolve: a vitrine vem só com as chaves das fotos. */
export type CartaoApi = Omit<CartaoPublic, 'showcase'> & { showcase: { title: string; always: boolean; files: string[] } };

/** Fotos escolhidas (na ordem) ou, sem escolha, todas as do catálogo. Chaves que não existem mais são ignoradas. */
export function resolveShowcase(files: string[], catalog: ShowcasePhoto[], max = 12) {
  if (!files.length) return catalog.slice(0, max);
  const byKey = new Map(catalog.map((p) => [p.key, p]));
  const out = files.flatMap((k) => (byKey.has(k) ? [byKey.get(k)!] : []));
  return (out.length ? out : catalog).slice(0, max);
}

export const fromApi = (d: CartaoApi, catalog: ShowcasePhoto[]): CartaoPublic => ({
  ...d,
  showcase: { title: d.showcase.title, always: d.showcase.always, photos: resolveShowcase(d.showcase.files, catalog) },
});

export const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const icon = {
  cal: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  pin: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  clock: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  check: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  instagram:
    '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>',
  tiktok:
    '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.3 6.3 0 1 0 5.3 6.2V8.6a7.6 7.6 0 0 0 4.4 1.4V6.7a4.4 4.4 0 0 1-4.4-4.4Z"/></svg>',
  arrow: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
};

/** Link externo abre em nova aba; link do próprio site, na mesma. */
const linkAttrs = (url: string) => (/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : '');

export function featuredStatusHtml(f: Pick<CartaoFeatured, 'state' | 'forecast'>, now = Date.now()) {
  if (f.state === 'disponivel')
    return `<p class="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2.5 text-sm font-semibold text-brand">${icon.check} Fotografias disponíveis</p>`;
  if (f.state === 'encerrado')
    return '<p class="rounded-xl border border-line bg-white/5 px-3 py-2.5 text-sm font-semibold text-muted">Vendas encerradas</p>';
  const fs = forecastStatus(f.forecast, now);
  const when =
    fs === 'futura'
      ? `<span class="mt-0.5 block text-xs font-normal text-ink/80">Previsão de publicação: ${esc(forecastLabel(f.forecast))}</span>`
      : fs === 'passou'
        ? '<span class="mt-0.5 block text-xs font-normal text-ink/80">As fotos ainda estão sendo preparadas. Volte em breve.</span>'
        : '';
  return `<div class="flex gap-2 rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2.5 text-sm font-semibold text-amber-200">${icon.clock}<p>Fotografias em preparação${when}</p></div>`;
}

/** Carrossel da vitrine (passa sozinho; arrastar com o dedo também funciona). */
export function showcaseHtml(s: CartaoPublic['showcase']) {
  if (!s.photos.length) return '';
  const slides = s.photos
    .map(
      (p, i) => `<figure class="relative w-full shrink-0 snap-center">
        <img src="${esc(p.url)}" alt="${esc(p.alt)}" ${i ? 'loading="lazy"' : 'loading="eager"'} decoding="async" class="aspect-[4/5] w-full object-cover" />
        <figcaption class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pt-10 pb-8 text-left">
          ${p.label ? `<span class="block text-[10px] font-bold tracking-[0.2em] text-brand uppercase">${esc(p.label)}</span>` : ''}
          <span class="block text-sm font-semibold text-white">${esc(p.alt)}</span>
        </figcaption>
      </figure>`,
    )
    .join('');
  const dots =
    s.photos.length > 1
      ? `<div class="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">${s.photos
          .map((_, i) => `<button type="button" data-dot="${i}" aria-label="Foto ${i + 1}" class="h-1.5 w-1.5 rounded-full bg-white/40 transition-all aria-[current=true]:w-5 aria-[current=true]:bg-brand"${i ? '' : ' aria-current="true"'}></button>`)
          .join('')}</div>`
      : '';
  return `<section data-carousel aria-roledescription="carrossel" aria-label="${esc(s.title)}" class="relative overflow-hidden rounded-2xl border border-line bg-bg-2 shadow-lg shadow-black/30">
    <p class="pointer-events-none absolute top-3 left-3 z-10 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold tracking-[0.2em] text-brand uppercase backdrop-blur">${esc(s.title)}</p>
    <div data-slides class="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">${slides}</div>
    ${dots}
  </section>`;
}

/** Cartões do Instagram e do TikTok (só os preenchidos). */
export function socialHtml(s: CartaoPublic['social'], compact: boolean) {
  const items = [
    s.instagram && { net: 'Instagram', user: s.instagram, url: instagramProfile(s.instagram), icon: icon.instagram, track: 'instagram_click',
      bg: 'bg-[linear-gradient(135deg,#feda75_0%,#fa7e1e_25%,#d62976_50%,#962fbf_75%,#4f5bd5_100%)]' },
    s.tiktok && { net: 'TikTok', user: s.tiktok, url: tiktokProfile(s.tiktok), icon: icon.tiktok, track: 'tiktok_click',
      bg: 'bg-[linear-gradient(135deg,#25f4ee_0%,#000_45%,#000_55%,#fe2c55_100%)]' },
  ].filter(Boolean) as { net: string; user: string; url: string; icon: string; track: string; bg: string }[];
  if (!items.length) return '';
  if (compact)
    return `<div class="flex justify-center gap-3">${items
      .map((i) => `<a href="${esc(i.url)}" target="_blank" rel="noopener" data-track="${i.track}" aria-label="${i.net} @${esc(i.user)}" class="grid size-12 place-items-center rounded-full ${i.bg} text-white shadow-md shadow-black/40">${i.icon}</a>`)
      .join('')}</div>`;
  return `<section aria-label="Redes sociais" class="space-y-2">
    <p class="text-[11px] font-bold tracking-[0.2em] text-muted uppercase">Acompanhe meu trabalho</p>
    <div class="grid gap-3 ${items.length > 1 ? 'grid-cols-2' : ''}">${items
      .map(
        (i) => `<a href="${esc(i.url)}" target="_blank" rel="noopener" data-track="${i.track}" class="flex flex-col items-center gap-2 rounded-2xl border border-line bg-bg-2 p-4 hover:border-brand/60">
          <span class="grid size-12 place-items-center rounded-2xl ${i.bg} text-white shadow-md shadow-black/40">${i.icon}</span>
          <span class="text-sm font-bold text-ink">${i.net}</span>
          <span class="max-w-full truncate text-xs text-muted">@${esc(i.user)}</span>
          <span class="mt-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-ink">Seguir</span>
        </a>`,
      )
      .join('')}</div>
  </section>`;
}

export function renderCartao(d: CartaoPublic, now = Date.now()) {
  const f = d.featured;
  const btn = (b: CartaoButton, track: string) =>
    b.url
      ? `<a href="${esc(b.url)}"${linkAttrs(b.url)} data-track="${track}" class="btn btn-outline min-h-13 w-full justify-center text-base">${esc(b.label)}</a>`
      : '';
  const featured = f
    ? `<section aria-labelledby="cd-feat" class="overflow-hidden rounded-2xl border border-line bg-bg-2 text-left shadow-lg shadow-black/30">
        ${f.cover ? `<img src="${esc(f.cover)}" alt="" class="aspect-[16/9] w-full object-cover" loading="eager" />` : ''}
        <div class="space-y-3 p-4">
          <p class="text-[11px] font-bold tracking-[0.2em] text-brand uppercase">Evento em destaque</p>
          <div>
            <h2 id="cd-feat" class="font-display text-2xl leading-tight font-extrabold text-ink">${esc(f.name)}</h2>
            <p class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              ${f.date ? `<span class="inline-flex items-center gap-1">${icon.cal} ${esc(formatDay(f.date))}</span>` : ''}
              ${f.location ? `<span class="inline-flex items-center gap-1">${icon.pin} ${esc(f.location)}</span>` : ''}
            </p>
          </div>
          ${f.text ? `<p class="text-sm whitespace-pre-line text-ink/85">${esc(f.text)}</p>` : ''}
          ${featuredStatusHtml(f, now)}
          <a href="/eventos/${esc(f.slug)}" data-track="featured_click" class="btn btn-primary min-h-14 w-full flex-col justify-center gap-0.5 py-3 text-center">
            <span class="text-sm leading-tight font-extrabold tracking-wide uppercase">${esc(featuredLabel(f.name, f.state, f.label))}</span>
            <span class="text-[11px] leading-tight font-medium normal-case opacity-80">${esc(featuredHint(f.state, f.forecast, now))}</span>
          </a>
        </div>
      </section>`
    : '';
  return `<div class="mx-auto flex w-full max-w-md flex-col gap-5 text-center">
    <header class="pt-2">
      <p class="font-display text-4xl font-extrabold tracking-wide text-ink">${esc(d.name)}<span class="text-brand">.</span></p>
      <p class="mt-1 text-[10px] tracking-[0.25em] text-muted uppercase">${esc(d.tagline)}</p>
      <h1 class="mt-5 font-display text-3xl leading-tight font-extrabold text-ink">${esc(d.headline)}</h1>
      ${d.intro ? `<p class="mt-2 text-sm text-muted">${esc(d.intro)}</p>` : ''}
    </header>
    ${featured || showcaseHtml(d.showcase)}
    <nav aria-label="Links" class="flex flex-col gap-3">
      ${btn(d.hire, 'hire_click')}
      ${btn(d.work, 'work_click')}
    </nav>
    ${featured && d.showcase.always ? showcaseHtml(d.showcase) : ''}
    ${socialHtml(d.social, !!featured && !d.showcase.always)}
    ${d.show_past ? `<a href="/eventos/" data-track="past_click" class="inline-flex min-h-11 items-center justify-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">Ver outros eventos ${icon.arrow}</a>` : ''}
  </div>`;
}
