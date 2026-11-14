/**
 * PORTFÓLIO — legendas, ordem, fotos ocultas e mosaico do topo
 * ------------------------------------------------------------------
 * Os dados ficam em src/data/portfolio.json, editável pelo painel
 * (Painel → Site → Fotos) ou diretamente no arquivo.
 *
 * - `photos`: ordem e legenda de cada foto (a legenda vira o texto alternativo).
 *   Fotos que estão na pasta mas não na lista aparecem depois, em ordem alfabética.
 *   `hidden: true` esconde a foto do site sem apagar o arquivo.
 * - `hero`: 3 fotos do mosaico do topo da página inicial (a 1ª é a grande).
 *   `position` ajusta o enquadramento do recorte (ex.: '50% 25%').
 */
import portfolioData from './portfolio.json' with { type: 'json' };

export interface PortfolioEntry {
  file: string;
  caption: string;
  hidden?: boolean;
}
export interface HeroEntry {
  file: string;
  label: string;
  position?: string;
}

const data = portfolioData as { photos: PortfolioEntry[]; hero: HeroEntry[] };

export const portfolioEntries: PortfolioEntry[] = data.photos;

export const portfolioCaptions: Record<string, string> = Object.fromEntries(data.photos.map((p) => [p.file, p.caption]));

export const hiddenPhotos = new Set(data.photos.filter((p) => p.hidden).map((p) => p.file));

export const heroMosaic: HeroEntry[] = data.hero;
