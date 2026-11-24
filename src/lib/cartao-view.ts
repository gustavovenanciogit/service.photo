/**
 * Desenho do Cartão Digital — o MESMO HTML na página pública (/cartao) e na prévia de celular do
 * painel (assim a prévia é fiel). Todo texto vindo do banco passa por esc().
 */
import { featuredHint, featuredLabel, forecastLabel, forecastStatus, formatDay, type CartaoButton, type TeaserState } from './cartao.ts';

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

export interface CartaoPublic {
  name: string; // nome curto (logo)
  tagline: string;
  headline: string;
  intro: string;
  show_past: boolean;
  hire: CartaoButton;
  work: CartaoButton;
  featured: CartaoFeatured | null;
}

export const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const icon = {
  cal: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  pin: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  clock: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  check: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
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
    ${featured}
    <nav aria-label="Links" class="flex flex-col gap-3">
      ${btn(d.hire, 'hire_click')}
      ${btn(d.work, 'work_click')}
      ${d.show_past ? `<a href="/eventos/" data-track="past_click" class="inline-flex min-h-11 items-center justify-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">Ver outros eventos ${icon.arrow}</a>` : ''}
    </nav>
  </div>`;
}
