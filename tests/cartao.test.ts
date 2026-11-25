import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countdown, defaultCartao, parseHandle, featuredHint, featuredLabel, forecastLabel, forecastStatus, loadCartao, parseCartao, parseForecast, safeUrl, teaserState,
} from '../src/lib/cartao.ts';
import { esc, renderCartao, resolveShowcase, type CartaoPublic, type ShowcasePhoto } from '../src/lib/cartao-view.ts';

const fb = defaultCartao('https://wa.me/5592000000000', '/');

test('links dos botões: só https/http ou endereço do site', () => {
  assert.equal(safeUrl('/servicos'), '/servicos');
  assert.equal(safeUrl('https://www.instagram.com/x/'), 'https://www.instagram.com/x/');
  assert.equal(safeUrl(''), '');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('//evil.com'), null);
  assert.equal(safeUrl('data:text/html,x'), null);
  assert.equal(safeUrl('ftp://x'), null);
});

test('configuração: valida, completa padrões e recusa destaque sem evento', () => {
  const r = parseCartao({ headline: '  Olá  ', featured: { active: true, event_id: 'evt_abc123', text: 'linha 1\n\n\n\nlinha 2' }, hire: { url: 'javascript:x' } }, fb);
  assert.equal(r.ok, false);
  const ok = parseCartao({ headline: '  Olá  ', featured: { active: true, event_id: 'evt_abc123', text: 'linha 1\n\n\n\nlinha 2' }, show_past: true }, fb);
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.headline, 'Olá');
    assert.equal(ok.value.featured.text, 'linha 1\n\nlinha 2');
    assert.equal(ok.value.hire.url, 'https://wa.me/5592000000000');
    assert.equal(ok.value.hire.label, 'Contratar fotógrafo');
    assert.equal(ok.value.work.url, '/');
    assert.equal(ok.value.show_past, true);
  }
  assert.equal(parseCartao({ featured: { active: true, event_id: '' } }, fb).ok, false);
  assert.equal(parseCartao({ featured: { event_id: '../x' } }, fb).ok, false);
  // Link vazio esconde o botão (permitido).
  const empty = parseCartao({ work: { label: 'Portfólio', url: '' } }, fb);
  assert.ok(empty.ok && empty.value.work.url === '');
});

test('dados guardados quebrados voltam ao padrão', () => {
  assert.deepEqual(loadCartao('{quebrado', fb), fb);
  assert.deepEqual(loadCartao(null, fb), fb);
  assert.equal(loadCartao(JSON.stringify({ ...fb, headline: 'X' }), fb).headline, 'X');
});

test('previsão em horário de Manaus (UTC−4)', () => {
  assert.deepEqual(parseForecast('2026-11-28T18:00'), { ok: true, value: '2026-11-28T22:00:00.000Z' });
  assert.deepEqual(parseForecast(''), { ok: true, value: '' });
  assert.equal(parseForecast('28/11/2026').ok, false);
  assert.equal(forecastLabel('2026-11-28T22:00:00.000Z'), 'Sábado, 28/11/2026 às 18:00');
});

test('estado público: rascunho só aparece se anunciado; só publicado libera a galeria', () => {
  assert.equal(teaserState('oculto', false), null);
  assert.equal(teaserState('oculto', true), 'preparando');
  assert.equal(teaserState('aberto', false), 'disponivel');
  assert.equal(teaserState('encerrado', true), 'encerrado');
});

test('contagem regressiva nunca negativa', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  const c = countdown('2026-11-25T13:01:05Z', now)!;
  assert.deepEqual([c.days, c.hours, c.minutes, c.seconds], [1, 1, 1, 5]);
  assert.equal(countdown('2026-11-24T12:00:00Z', now), null);
  assert.equal(countdown('2026-11-20T12:00:00Z', now), null);
  assert.equal(countdown('', now), null);
  assert.equal(countdown('lixo', now), null);
  assert.equal(forecastStatus('2026-11-20T12:00:00Z', now), 'passou');
  assert.equal(forecastStatus('2026-11-30T12:00:00Z', now), 'futura');
  assert.equal(forecastStatus('', now), 'nenhuma');
});

test('textos do botão principal', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  assert.equal(featuredLabel('Corrida Manaus Run', 'preparando'), 'Acompanhe as fotos da Corrida Manaus Run');
  assert.equal(featuredLabel('Corrida', 'preparando', 'Fotos da corrida!'), 'Fotos da corrida!');
  assert.equal(featuredLabel('Corrida', 'disponivel', 'Fotos da corrida!'), 'Encontre suas fotos da Corrida');
  assert.equal(featuredHint('preparando', '2026-11-30T12:00:00Z', now), 'Fotografias em preparação. Confira a previsão de publicação.');
  assert.equal(featuredHint('preparando', '2026-11-20T12:00:00Z', now), 'Fotografias em preparação.');
  assert.equal(featuredHint('disponivel', '', now), 'Fotografias disponíveis. Encontre as suas.');
});

test('cartão renderizado: escapa textos, link permanente, sem foto antes de publicar', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  const d: CartaoPublic = {
    name: 'VENART', tagline: 't', headline: '<b>oi</b>', intro: '', show_past: false,
    hire: { label: 'Contratar fotógrafo', url: 'https://wa.me/1' }, work: { label: 'Conhecer meu trabalho', url: '' },
    featured: { slug: 'manaus-run', name: 'Manaus "Run"', date: '2026-11-22', location: 'Ponta Negra', state: 'preparando', forecast: '2026-11-30T12:00:00Z', text: '', label: '', cover: '' },
    showcase: { title: 'Últimos trabalhos', always: false, photos: [{ key: 'esportes/a.jpg', url: '/_astro/a.webp', alt: 'Corrida', label: 'Esportes' }] },
    social: { instagram: '', tiktok: '' },
  };
  const html = renderCartao(d, now);
  assert.ok(html.includes('&lt;b&gt;oi&lt;/b&gt;'));
  assert.ok(!html.includes('<b>oi'));
  assert.ok(html.includes('href="/eventos/manaus-run"'));
  assert.ok(html.includes('Manaus &quot;Run&quot;'));
  assert.ok(html.includes('Fotografias em preparação'));
  assert.ok(html.includes('Previsão de publicação'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('Conhecer meu trabalho')); // link vazio: botão escondido
  assert.ok(!html.includes('/eventos/"')); // "Ver outros eventos" desligado
  assert.ok(renderCartao({ ...d, show_past: true }, now).includes('href="/eventos/"'));
  assert.equal(esc(`a'b`), 'a&#39;b');
  const passed = renderCartao({ ...d, featured: { ...d.featured!, forecast: '2026-11-01T12:00:00Z' } }, now);
  assert.ok(passed.includes('ainda estão sendo preparadas'));
  assert.ok(!passed.includes('Previsão de publicação'));
});

const cat: ShowcasePhoto[] = ['a', 'b', 'c'].map((k) => ({ key: `esportes/${k}.jpg`, url: `/_astro/${k}.webp`, alt: k.toUpperCase(), label: 'Esportes' }));

test('redes: aceita @, usuário ou link; recusa inválido', () => {
  assert.equal(parseHandle('@venart_mid', 'instagram'), 'venart_mid');
  assert.equal(parseHandle('https://www.instagram.com/venart_mid/?hl=pt', 'instagram'), 'venart_mid');
  assert.equal(parseHandle('https://www.tiktok.com/@venart.foto?lang=pt', 'tiktok'), 'venart.foto');
  assert.equal(parseHandle('', 'tiktok'), '');
  assert.equal(parseHandle('nome com espaço', 'instagram'), null);
  assert.equal(parseHandle('<script>', 'tiktok'), null);
  const r = parseCartao({ social: { instagram: '@ok', tiktok: 'x y' } }, fb);
  assert.equal(r.ok, false);
  const ok = parseCartao({ social: { instagram: '@ok', tiktok: '@tk' }, showcase: { title: ' Trabalhos ', photos: ['esportes/a.jpg', 'esportes/a.jpg', '../x.jpg'], always: true } }, fb);
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.deepEqual(ok.value.social, { instagram: 'ok', tiktok: 'tk' });
    assert.deepEqual(ok.value.showcase, { title: 'Trabalhos', photos: ['esportes/a.jpg'], always: true });
  }
});

test('vitrine: escolhidas na ordem; sem escolha (ou só fotos removidas) usa todas', () => {
  assert.deepEqual(resolveShowcase(['esportes/c.jpg', 'esportes/a.jpg'], cat).map((p) => p.key), ['esportes/c.jpg', 'esportes/a.jpg']);
  assert.equal(resolveShowcase([], cat).length, 3);
  assert.equal(resolveShowcase(['esportes/sumiu.jpg'], cat).length, 3);
  assert.equal(resolveShowcase([], cat, 2).length, 2);
});

test('sem evento em destaque: carrossel e cartões das redes; com destaque: só ícones', () => {
  const base: CartaoPublic = {
    name: 'VENART', tagline: 't', headline: 'h', intro: '', show_past: false, hire: { label: 'C', url: '/x' }, work: { label: 'T', url: '/' },
    featured: null, showcase: { title: 'Últimos trabalhos', always: false, photos: cat }, social: { instagram: 'venart_mid', tiktok: 'venart' },
  };
  const empty = renderCartao(base);
  assert.ok(empty.includes('data-carousel'));
  assert.equal((empty.match(/<figure/g) ?? []).length, 3);
  assert.equal((empty.match(/data-dot=/g) ?? []).length, 3);
  assert.ok(empty.includes('https://www.instagram.com/venart_mid/'));
  assert.ok(empty.includes('https://www.tiktok.com/@venart'));
  assert.ok(empty.includes('Seguir'));
  const featured = renderCartao({ ...base, featured: { slug: 's', name: 'N', date: '', location: '', state: 'disponivel', forecast: '', text: '', label: '', cover: '' } });
  assert.ok(!featured.includes('data-carousel'));
  assert.ok(!featured.includes('Seguir'));
  assert.ok(featured.includes('aria-label="Instagram @venart_mid"'));
  assert.ok(renderCartao({ ...base, featured: { slug: 's', name: 'N', date: '', location: '', state: 'disponivel', forecast: '', text: '', label: '', cover: '' }, showcase: { ...base.showcase, always: true } }).includes('data-carousel'));
  // Sem redes preenchidas: nenhum cartão.
  assert.ok(!renderCartao({ ...base, social: { instagram: '', tiktok: '' } }).includes('Redes sociais'));
});
