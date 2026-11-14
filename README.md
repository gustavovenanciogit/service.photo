# Site de serviços fotográficos — Manaus/AM

Site oficial com catálogo de serviços, tabela de preços com filtros, portfólio,
"como contratar", dúvidas frequentes e pedidos de orçamento pelo WhatsApp.

**Tecnologia:** [Astro](https://astro.build) + TypeScript + Tailwind CSS.
Site público estático (rápido e bem posicionado no Google). Um pequeno servidor na Cloudflare cuida
apenas do **painel profissional** (com senha) e de registrar os pedidos feitos pelo site.

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
| **Preços, pacotes, durações, prazos, destaques** | **Painel → Site: preços** (ou `src/data/pricing.json`) |
| Categorias, subgrupos e observações de rodapé | `src/data/categories.ts` |
| Perguntas e respostas do FAQ | `src/data/faq.ts` |
| Textos das mensagens de WhatsApp | `src/lib/whatsapp.ts` |
| Simulador: percentuais, sinal, Pix, parcelas e quais pacotes aparecem | `src/data/simulator.ts` |
| Simulador: regras de cálculo (domingo, após 22h etc.) | `src/lib/quote.ts` |
| Textos das propostas por tipo de cliente | `src/data/proposal.ts` |
| Kit de mensagens do painel | `src/data/messages.ts` |
| **Fotos, legendas, ordem e mosaico do topo** | **Painel → Site: fotos** (ou `src/data/portfolio.json`) |
| Etapas do "Como contratar" | `src/components/HowToHire.astro` |
| Cores e fontes | `src/styles/global.css` (bloco `@theme`) |
| Imagem de compartilhamento (redes sociais) | `public/og-image.png` (1200×630) |

### Preços (o mais importante)
O jeito mais fácil é pelo painel (**Site: preços**). Direto no código, cada pacote em
`src/data/pricing.json` tem este formato (os comentários abaixo são só explicação — JSON não aceita comentários):

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

## 3. Simulador de orçamento (`/simulador`)

O cliente escolhe o pacote, soma extras e vê o total na hora; depois envia tudo pelo WhatsApp.
Os valores de hora extra (R$ 150) e entrega expressa (R$ 120) vêm do catálogo. Regras:

- **Domingo/feriado:** +20% sobre o pacote + horas extras
- **Após 22h:** +15% sobre o pacote
- **Corporativo:** por hora, mínimo de 2h · **Assinaturas:** valor mensal, sem extras
- **Pagamento:** Pix à vista com 5% de desconto, 3x sem juros no cartão, sinal de 30%
- Deslocamento não é cobrado no simulador · vídeo curto aparece como "sob consulta"

Cada cartão da tabela tem o link "Simular com extras", que abre o simulador já com o pacote escolhido.

## 3.2 Painel profissional (`/painel`) — área com senha

Área só sua, protegida por senha no servidor da Cloudflare. Guarde nos favoritos:
**https://venart.gustavovesss.workers.dev/painel**

| Tela | Para que serve |
| --- | --- |
| **Início** | Propostas em aberto, fechado no mês, receita recorrente, taxa de aceite, follow-ups do dia e funil |
| **Propostas** | Lista de propostas enviadas, status (enviada / aceita / recusada / vencida), abrir, copiar link, editar ou duplicar |
| **Nova proposta** | Gerador de propostas (escolha um cliente cadastrado e os dados entram sozinhos) |
| **Clientes** | Academias, assessorias e clientes com contato, Instagram, etapa da negociação e data do próximo follow-up |
| **QR Codes** | QR Code do site, tabela, simulador, Fotto, Instagram, WhatsApp ou qualquer link — PNG e SVG |
| **Mensagens** | Mensagens prontas de prospecção, atendimento, follow-up e pós-serviço (`src/data/messages.ts`) |

Os dados (clientes e propostas) ficam no banco **D1** da Cloudflare (gratuito), criado sozinho no
primeiro deploy. Você acessa do Mac, do Windows ou do celular.

### Pedidos do site
Tudo que chega pelo **formulário de pré-orçamento** e pelo **simulador** aparece em **Pedidos do site**
(com contador no menu e aviso na tela inicial). Em cada pedido: responder no WhatsApp, **Criar proposta**
(já preenchida com nome, telefone, data, local e pacote), **Cadastrar cliente**, mudar o status ou excluir.
Proteção anti-spam: campo invisível para robôs, limite de 6 pedidos por hora por conexão e checagem de origem.
Se alguém pedir a exclusão dos dados (LGPD), use **Excluir** no pedido.

### Agenda e entregas
- **Agenda** (`/painel/agenda`): calendário do mês e próximos trabalhos. Ao marcar uma proposta como
  **Aceita**, o painel oferece agendar — já preenchido com cliente, serviço, data, local e **prazo de
  entrega calculado pelo pacote** ("Em 7 dias", "Em 10 dias úteis", "Em 24h"…; intervalos usam o maior
  prazo; eventos sociais usam os 10 dias úteis da tabela). Também dá para **bloquear datas**.
- **Site:** no simulador e no formulário, ao escolher a data, o cliente vê "data livre" ou "já tenho um
  compromisso nessa data" — só isso, nunca o motivo ou o cliente. Desmarque "Mostrar a data como
  ocupada no site" em trabalhos que não ocupam o dia todo.
- **Entregas** (`/painel/entregas`): colunas Agendado → Fotografado → Editando → Entregue, com prazo
  colorido (atrasada / vence hoje / amanhã). Ao marcar entregue, informe o link da galeria e use
  **Avisar cliente** (WhatsApp com a mensagem pronta). Contador vermelho no menu para entregas
  atrasadas ou vencendo hoje. Feriados não entram no cálculo de dias úteis — confira nessas datas.

### Editar preços e fotos pelo painel (Site: preços / Site: fotos)
Ao clicar em **Publicar no site**, o painel grava a alteração direto no GitHub (um commit na `main`)
e a Cloudflare publica sozinha em 1 a 2 minutos. O indicador no topo mostra **Publicando…** / **No ar**.
- **Preços:** nome, descrição, valor, duração, entrega, inclusos, etiqueta de destaque e mostrar/ocultar.
  Outros campos (categoria, unidade, percentuais) só mudam no código — de propósito, para não quebrar o site.
- **Fotos:** enviar até 10 por vez (reduzidas para 2000 px e sem dados de localização), legenda, ordem,
  ocultar, excluir e escolher as 3 fotos do mosaico do topo.
- Se o site for alterado em outro lugar enquanto você edita, o painel avisa e não sobrescreve nada.
- Cada publicação fica no histórico do GitHub — dá para desfazer (reverter o commit).

**Configuração (uma vez): token do GitHub**
1. GitHub → sua foto → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Nome: `Venart painel` · Expiração: até 1 ano (anote para renovar) · **Repository access: Only select repositories → service.photo**.
3. **Permissions → Repository permissions → Contents: Read and write**. (Opcional: *Commit statuses* e *Checks*
   como Read-only para o indicador "No ar".)
4. **Generate token** e copie (começa com `github_pat_`).
5. Cloudflare → **Workers & Pages → venart → Settings → Variables and Secrets → Add** → tipo **Secret** →
   nome `GITHUB_TOKEN` → cole o token → salve.

Quando o token vencer, o painel avisa; gere um novo e troque o segredo.

> Se você também edita o código no computador, rode `git pull` antes de começar —
> as edições feitas pelo painel entram direto na `main`.

### Definir (ou trocar) a senha — uma vez só
1. https://dash.cloudflare.com → **Workers & Pages** → **venart** → **Settings** → **Variables and Secrets**.
2. **Add** → tipo **Secret** → nome `ADMIN_PASSWORD` → valor: sua senha (longa, que você não use em outro lugar).
3. **Deploy**/salvar. Pronto: entre em `/painel` com essa senha.

- Trocar a senha encerra as sessões abertas em todos os aparelhos.
- Depois de 8 senhas erradas em 15 minutos, o acesso fica bloqueado por 15 minutos.
- A sessão dura 30 dias por aparelho (botão **Sair** no menu).

### Segurança
- Login e dados passam por um pequeno servidor (`worker/`): sem senha, nem as páginas do painel
  nem os dados são entregues. O site público continua 100% estático.
- Cookie de sessão assinado, `HttpOnly`, `Secure`, `SameSite=Strict`; bloqueio de requisições de
  outros sites; consultas ao banco sempre parametrizadas.
- O painel não aparece no Google (`noindex`, fora do sitemap, `robots.txt`).

### Propostas para o cliente
O link da proposta (`/proposta/#d=...`) continua público — é o que o cliente abre. Os valores vão
dentro do link (congelados). O valor oficial é o que está salvo em **Propostas** no seu painel.

### Testar o painel no computador
`npm run dev` mostra o site, mas o painel precisa do servidor. Para testar tudo localmente:
```bash
echo 'ADMIN_PASSWORD="uma-senha-de-teste"' > .dev.vars
```
```bash
npm run dev:full
```
Abra http://localhost:8787/painel (o arquivo `.dev.vars` não vai para o GitHub).

### Se o deploy reclamar do banco D1
Normalmente ele é criado sozinho. Se não for: Cloudflare → **Storage & Databases → D1 → Create**
com o nome `venart`, copie o **Database ID** e adicione `"database_id": "..."` em `wrangler.jsonc`.

## 3.1 Como o WhatsApp funciona

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

O formulário e o simulador abrem o WhatsApp do cliente com o texto pronto **e** registram o pedido
no painel (**Pedidos do site**). Se o registro falhar, o WhatsApp abre do mesmo jeito.
O que é registrado está descrito em `/privacidade` (`src/pages/privacidade.astro`).

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
