/** Carrossel da vitrine do Cartão Digital (só no navegador; o HTML vem de cartao-view.ts). */

/**
 * Liga os carrosséis dentro de `root` (passam a cada 4 s; param enquanto a pessoa mexe;
 * sem passar sozinho para quem pediu menos movimento). Pode ser chamado de novo após re-renderizar.
 */
export function startCarousels(root: ParentNode) {
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll<HTMLElement>('[data-carousel]:not([data-ready])').forEach((c) => {
    c.dataset.ready = '1';
    const track = c.querySelector<HTMLElement>('[data-slides]')!;
    const dots = [...c.querySelectorAll<HTMLButtonElement>('[data-dot]')];
    if (dots.length < 2) return;
    let pausedUntil = 0;
    const index = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const go = (i: number) => track.scrollTo({ left: i * track.clientWidth, behavior: still ? 'auto' : 'smooth' });
    track.addEventListener('scroll', () => {
      const i = index();
      dots.forEach((d, k) => (k === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
    }, { passive: true });
    const pause = () => (pausedUntil = Date.now() + 6000);
    ['pointerdown', 'touchstart', 'wheel', 'focusin'].forEach((ev) => track.addEventListener(ev, pause, { passive: true }));
    dots.forEach((d, i) => d.addEventListener('click', () => { pause(); go(i); }));
    if (still) return;
    const timer = setInterval(() => {
      if (!c.isConnected) return clearInterval(timer);
      if (Date.now() < pausedUntil || document.hidden) return;
      go((index() + 1) % dots.length);
    }, 4000);
  });
}
