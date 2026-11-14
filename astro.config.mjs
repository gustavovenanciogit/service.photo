// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Endereço oficial do site (usado no SEO, Open Graph e sitemap).
// Ao ter domínio próprio (ex.: https://venart.com.br), troque aqui
// ou defina a variável de ambiente SITE_URL na Cloudflare.
const SITE_URL = process.env.SITE_URL ?? 'https://venart.gustavovesss.workers.dev';

export default defineConfig({
  site: SITE_URL,
  // Propostas e painel são privados: ficam fora do sitemap.
  integrations: [sitemap({ filter: (page) => !page.includes('/proposta/') && !page.includes('/painel') })],
  vite: {
    plugins: [tailwindcss()],
  },
});
