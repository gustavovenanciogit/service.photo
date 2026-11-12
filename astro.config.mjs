// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Troque pela URL definitiva quando publicar (usada no SEO, Open Graph e sitemap).
// Também pode ser definida pela variável de ambiente SITE_URL na Vercel/Cloudflare.
const SITE_URL = process.env.SITE_URL ?? 'https://example.com';

export default defineConfig({
  site: SITE_URL,
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
