# Site de serviços fotográficos — Manaus/AM

Site oficial com catálogo de serviços, tabela de preços com filtros, portfólio,
"como contratar", dúvidas frequentes e pedidos de orçamento pelo WhatsApp.

**Tecnologia:** [Astro](https://astro.build) + TypeScript + Tailwind CSS.
Site 100% estático: sem servidor, sem banco de dados e sem armazenar dados de clientes.

**No ar:** https://venart.gustavovesss.workers.dev

Preços conforme a **Tabela 2026**. Itens a revisar e fotos a adicionar: **[PENDENCIAS.md](PENDENCIAS.md)**.

---

## 1. Instalar e rodar no seu computador

Pré-requisito: [Node.js](https://nodejs.org) **22.23 ou mais recente**.

```bash
npm install
```

```bash
npm run dev
```

Abra http://localhost:4321. As alterações aparecem na hora.
Se algum pacote tiver `confirmed: false`, o modo dev mostra o selo amarelo **"Pendente de confirmação"** (ele nunca aparece na versão publicada).

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm run build` | Checa os tipos (TypeScript) e gera o site final em `dist/` |
| `npm run preview` | Abre a versão final gerada, como o cliente vai ver |
| `npm test` | Testa as mensagens de WhatsApp e a integridade do catálogo |
| `npm run check` | Só a verificação de TypeScript |

## 2. Onde editar cada coisa

| Quero mudar... | Arquivo |
| --- | --- |
| WhatsApp, Instagram, Fotto, nome, cidade, condições de pagamento, SEO, menu | `src/config/site.ts` |
| **Preços, pacotes, durações, prazos, destaques** | `src/data/services.ts` |
| Categorias, subgrupos e observações de rodapé | `src/data/categories.ts` |
| Perguntas e respostas do FAQ | `src/data/faq.ts` |
| Textos das mensagens de WhatsApp | `src/lib/whatsapp.ts` |
| Etapas do "Como contratar" | `src/components/HowToHire.astro` |
| Cores e fontes | `src/styles/global.css` (bloco `@theme`) |
| Imagem de compartilhamento (redes sociais) | `public/og-image.png` (1200×630) |

### Preços (o mais importante)
Cada pacote em `src/data/services.ts` tem este formato:

```ts
{
  id: 'ensaio-esportivo',          // único, sem espaços
  category: 'fotografia-esportiva', // slug da categoria
  name: 'Ensaio esportivo',
  description: 'Cobertura fotográfica individual de treino ou atividade esportiva.',
  price: 350,                       // número, sem "R$" (12,90 → 12.9). null = sob consulta
  priceUnit: '/mês',                // opcional: '/mês', '/hora', '/km'
  priceLabel: '+20%',               // opcional: texto no lugar do valor
  group: 'marketing',               // opcional: subgrupo (ver categories.ts)
  duration: '1h',
  delivery: 'Em 7 dias',
  benefits: ['Prévia no mesmo dia'],
  conditions: [],
  highlight: 'Mais escolhido',      // opcional — só use se estiver na tabela
  addon: true,                      // opcional: item de "Adicionais"
  buyAt: 'fotto',                   // opcional: botão "Comprar na Fotto"
  confirmed: true,                  // ⚠️ só com true o preço aparece no site
  active: true,                     // false esconde o pacote
}
```

*(os valores acima são só exemplo de formato)*

Regra de segurança: **enquanto `confirmed` for `false`, o preço não é publicado**. O cartão
mostra "Sob consulta" e a mensagem de WhatsApp pede o valor em vez de citar um preço.

### Fotos
Coloque arquivos `.jpg`, `.png`, `.webp` ou `.avif` nas pastas — o site encontra sozinho:

```
src/assets/hero/                         → foto de destaque da página inicial (a 1ª em ordem alfabética)
src/assets/portfolio/esportes/
src/assets/portfolio/artes-marciais/
src/assets/portfolio/ensaios/
src/assets/portfolio/eventos-sociais/
src/assets/portfolio/eventos-corporativos/
```

- O Astro redimensiona e converte para WebP automaticamente (carregamento rápido).
- O **nome do arquivo vira a descrição** da foto (acessibilidade/SEO):
  `corrida-ponta-negra.jpg` → "Corrida ponta negra". Use nomes descritivos.
- Exporte do Lightroom em JPG com lado maior de ~2000px. Não precisa mais que isso.
- Sem fotos, o site mostra espaços reservados elegantes (nunca fotos de terceiros).

## 3. Como o WhatsApp funciona

Todos os botões montam um link `wa.me` com mensagem pronta, conforme a origem:

| Origem | Mensagem |
| --- | --- |
| Página inicial / menu | Interesse geral ou pedido de orçamento |
| "Tenho interesse" no pacote | Nome do pacote, categoria e valor (ex.: R$ 550/mês) |
| "Perguntar" em adicional | Nome do adicional + valor |
| Foto avulsa / Todas as minhas fotos | Botão leva direto para a Fotto |
| Página de categoria | Nome da categoria |
| FAQ | A pergunta que o cliente estava lendo |
| Formulário de pré-orçamento | Nome, serviço, data, local e mensagem |
| Botão flutuante | Muda conforme a seção que está na tela |

O formulário **não envia nem guarda dados**: ele só abre o WhatsApp do cliente com o texto
pronto para ele confirmar.

## 4. Publicar no GitHub

O código já está no repositório do GitHub. Para enviar novas alterações:

```bash
git add -A
```

```bash
git commit -m "Atualiza preços"
```

```bash
git push
```

## 5. Deploy (colocar no ar) — Cloudflare

Recomendado: **Cloudflare** (gratuito e permite uso comercial). O projeto já tem
`wrangler.jsonc` (publica a pasta `dist/`) e `.node-version` (Node 24).

1. https://dash.cloudflare.com → **Workers & Pages → Create → Import a repository**.
2. Escolha `service.photo` e preencha:
   - **Project name:** `venart`
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
3. **Deploy**. O site fica em `https://venart.<sua-conta>.workers.dev`.
4. O endereço oficial fica em `astro.config.mjs` (`SITE_URL`). Ele é usado nos links de
   compartilhamento e no sitemap — atualize-o se mudar de domínio.

A Cloudflare publica a **branch principal (`main`)**. Cada `git push` nela atualiza o site.

Domínio próprio (ex.: `venart.com.br`, registrado no Registro.br): no projeto, **Settings →
Domains & Routes → Add → Custom domain**, e depois atualize o `SITE_URL`.

> Vercel também funciona (detecta Astro sozinha), mas o plano gratuito dela não permite uso comercial.

## 6. Estrutura do projeto

```
src/
  config/site.ts          ← contatos e configurações gerais
  data/
    categories.ts         ← 6 categorias de serviço
    services.ts           ← TODOS os pacotes e preços
    faq.ts                ← dúvidas frequentes
  lib/
    whatsapp.ts           ← mensagens e links de WhatsApp
    images.ts             ← leitura automática das fotos
  components/             ← Header, Footer, Hero, ServiceCard, PricingCard,
                            PricingCatalog, HowToHire, FAQ, Portfolio,
                            ContactSection, WhatsAppButton, BackToTop, Icon...
  layouts/BaseLayout.astro← SEO, Open Graph, estrutura das páginas
  pages/
    index.astro           ← página inicial (todas as seções)
    precos.astro          ← tabela de preços com filtros (/precos)
    faq.astro             ← /faq
    servicos/[slug].astro ← /servicos/<categoria> (gerada automaticamente)
    404.astro
  styles/global.css       ← cores, fontes, botões
  assets/                 ← fotos (hero e portfólio)
public/                   ← favicon, og-image, robots.txt
tests/                    ← testes automáticos
scripts/og-image.mjs      ← regera a imagem de compartilhamento
```

## 7. Preparado para o futuro

A organização já separa **dados** (`src/data`), **regras** (`src/lib`) e **visual**
(`src/components`), o que facilita evoluir sem reescrever o site:

- **Painel administrativo:** trocar `src/data/services.ts` por um CMS (ex.: Decap, Sanity) ou pelas
  *Content Collections* do Astro — os componentes continuam recebendo o mesmo tipo `ServicePackage`.
- **Agenda, agendamento com confirmação, pagamentos, área do cliente, galerias com senha:**
  o Astro aceita páginas dinâmicas e rotas de API com um *adapter* (`@astrojs/vercel` ou
  `@astrojs/cloudflare`) sem mudar o resto do projeto.
- **Fotto / atendimento por IA:** novas integrações entram em `src/lib/` e são chamadas pelos
  componentes existentes.

## Acessibilidade e desempenho
- Navegação completa por teclado, link "pular para o conteúdo", foco visível.
- FAQ com `<details>` (funciona até sem JavaScript); visualizador de fotos com `<dialog>`
  (Esc fecha, setas navegam, deslizar no celular).
- Respeita "reduzir movimento" do sistema.
- Fontes hospedadas no próprio site; imagens otimizadas e com carregamento progressivo.
- SEO: título e descrição por página, Open Graph, dados estruturados (negócio local), sitemap.
