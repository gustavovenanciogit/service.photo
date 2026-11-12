/**
 * Carrega as fotos das pastas do projeto automaticamente.
 * Basta colocar arquivos .jpg/.jpeg/.png/.webp/.avif nas pastas:
 *   src/assets/hero/                       → foto de destaque (a primeira, em ordem alfabética)
 *   src/assets/portfolio/<categoria>/      → fotos do portfólio
 * O Astro otimiza (redimensiona e converte para WebP) no build.
 */
import type { ImageMetadata } from 'astro';

const heroFiles = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/hero/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}',
  { eager: true },
);

const portfolioFiles = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/portfolio/*/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}',
  { eager: true },
);

export const heroImage: ImageMetadata | undefined = Object.keys(heroFiles)
  .sort()
  .map((k) => heroFiles[k]!.default)[0];

/** Filtros do portfólio. A `folder` é o nome da pasta em src/assets/portfolio/. */
export const portfolioCategories = [
  { folder: 'esportes', label: 'Esportes' },
  { folder: 'artes-marciais', label: 'Artes marciais' },
  { folder: 'ensaios', label: 'Ensaios' },
  { folder: 'eventos-sociais', label: 'Eventos sociais' },
  { folder: 'eventos-corporativos', label: 'Eventos corporativos' },
] as const;

export interface PortfolioPhoto {
  src: ImageMetadata;
  category: string;
  /** Texto alternativo gerado a partir do nome do arquivo: "corrida-ponta-negra.jpg" → "Corrida ponta negra". */
  alt: string;
}

const altFromFile = (path: string) => {
  const base = path.split('/').pop()!.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\d+$/, '').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Fotografia do portfólio';
};

export const portfolioPhotos: PortfolioPhoto[] = Object.keys(portfolioFiles)
  .sort()
  .map((path) => ({
    src: portfolioFiles[path]!.default,
    category: path.split('/').at(-2)!,
    alt: altFromFile(path),
  }));
