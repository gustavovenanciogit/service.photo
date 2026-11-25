/**
 * Fotos do portfólio disponíveis para a vitrine do Cartão Digital (gerado no build).
 * Usado em /cartao e na prévia do painel: { key: "pasta/arquivo.jpg", url, alt, label }.
 * Só fotos visíveis no portfólio (as ocultas no painel Site → Fotos ficam de fora).
 */
import { getImage } from 'astro:assets';
import { allPortfolioFiles, portfolioCategories, portfolioPhotos } from '@/lib/images';
import type { ShowcasePhoto } from '@/lib/cartao-view';

export async function showcaseCatalog(): Promise<ShowcasePhoto[]> {
  const keyOf = new Map(Object.entries(allPortfolioFiles).map(([k, v]) => [v, k]));
  const label = (folder: string) => portfolioCategories.find((c) => c.folder === folder)?.label ?? '';
  return Promise.all(
    portfolioPhotos.map(async (p) => {
      const img = await getImage({ src: p.src, width: Math.min(720, p.src.width), format: 'webp', quality: 78 });
      return { key: keyOf.get(p.src) ?? '', url: img.src, alt: p.alt, label: label(p.category) };
    }),
  );
}
