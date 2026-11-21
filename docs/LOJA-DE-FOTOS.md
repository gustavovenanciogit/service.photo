# Loja de fotos — checklist de implementação

Venda de fotos direto pelo site: galeria por evento com marca d'água, pagamento por **Pix ou cartão**
e **download liberado automaticamente** após a confirmação do pagamento.

**Princípio:** tudo é feito pelo **painel Venart** (`/painel`): criar o evento, configurar dados e preços,
subir as fotos e **gerar o link do evento** para divulgar (WhatsApp, Instagram, QR Code). Nada é configurado
fora do painel. Mais adiante, cada evento pode também aparecer no **site público** (área que o cliente vê).

**Como usar este checklist**
- `[ ]` a fazer · `[x]` feito.
- **👤 Você** = tarefa do Gustavo · **🤖 Claude** = tarefa de desenvolvimento.
- Cada fase termina com um **✅ critério de pronto**: só passamos para a próxima quando ele for atendido.
- As entregas do Claude chegam por pull request; este arquivo é atualizado no mesmo PR.

**Situação atual:** Fase 0 em andamento · início: 15/11/2026

---

## Resumo das fases

| Fase | Entrega | Depende de | Situação |
|---|---|---|---|
| 0 | Decisões e preparação | — | 🟡 em andamento |
| 1 | Eventos no painel: criar, configurar, subir fotos e gerar o link | Fase 0 (itens 0.5 e 0.12) | ✅ no ar (falta o teste real 1.12) |
| 2 | Loja: carrinho, pagamento e download automático | Fases 0 e 1 | ✅ no ar (Mercado Pago PJ, checkout transparente) |
| 3 | Pós-venda e gestão (pedidos, relatórios, limite do MEI) | Fase 2 | ✅ no ar (falta 3.10) |
| 4 | Lançamento (teste real e divulgação) | Fases 2 e 3 | 🟡 em andamento |
| 5 | Busca por número de peito | Fase 4 | ⚪ |
| 6 | Reconhecimento facial (piloto, validação, jurídico) | Fase 4 | ⚪ |

---

## Fase 0 — Decisões e preparação

### Decisões comerciais
- [x] **0.1 👤 Gateway de pagamento:** **Mercado Pago** (Checkout Pro) — seguimos com a recomendação ao iniciar a Fase 2.
      Simule uma venda de R$ 12,90 no Pix e no cartão nos dois antes de decidir (simulação de custos na conversa de 15/11/2026).
- [ ] **0.2 👤 Preços da loja:**
  - [ ] Foto avulsa: R$ 12,90? (valor da Tabela 2026)
  - [ ] Pacote "todas as minhas fotos": R$ 119,90? (valor da Tabela 2026)
  - [ ] Regra do pacote sem reconhecimento facial: o cliente seleciona as fotos dele e paga **o menor valor** entre "quantidade × R$ 12,90" e R$ 119,90? (sugestão)
  - [ ] Pré-venda R$ 100: entra agora ou depois? (sugestão: depois, na Fase 3)
- [x] **0.3 👤 Formas de pagamento:** Pix e cartão à vista? Aceitar parcelamento no pacote? Receber o cartão na hora ou em 14/30 dias (taxa menor)? *(Pix e cartão à vista; cartão com recebimento em 30 dias; sem boleto — 17/11)*
- [ ] **0.4 👤 Prazos padrão:** quanto tempo as fotos ficam à venda (sugestão: 6 meses) e por quanto tempo o comprador pode baixar de novo (sugestão: 30 dias). *Serão só o padrão: cada evento poderá ter o seu prazo no painel.*
- [ ] **0.5 👤 Padrão de exportação do Lightroom** — agora é **uma exportação só**:
  - [ ] Versão de venda: JPEG, lado maior ~3000 px, qualidade ~85, **sem** marca d'água.
  - [x] ~~Versão de prévia~~ → o painel cria a prévia (1200 px) e a miniatura (520 px) com marca d'água sozinho, na hora do envio.

### Jurídico e fiscal
- [ ] **0.6 👤 Contador:** confirmar que a venda de fotos digitais está coberta pela atividade do seu MEI e como emitir nota.
- [ ] **0.7 👤 Limite do MEI:** acompanhar o faturamento total (serviços + loja) frente ao limite de **R$ 81.000/ano** (~R$ 6.750/mês). A Fase 3 terá um alerta no painel.
- [x] **0.8 🤖 Termos de compra** escritos com as suas decisões (versão 2026-11-v2) → página `/termos-de-compra`. Falta preencher razão social, CNPJ e endereço (`src/config/store.ts` → `seller`). (o que é comprado, prazo de download, uso permitido das fotos, direito de arrependimento, contato) para você revisar.
- [ ] **0.9 👤 Revisar e aprovar** os Termos de compra (idealmente com advogado ou contador).

### Contas e acessos
- [x] **0.10 👤 Criar/acessar a conta do gateway** escolhido como **pessoa jurídica (CNPJ do MEI)** e validar os dados bancários. *(conta PJ do Mercado Pago aprovada — 17/11)*
- [x] **0.11 👤 Gerar as credenciais de API** do gateway (primeiro as de **teste**; as de produção na Fase 4) — eu te guio na hora. *(credenciais de produção da conta PJ — 17/11)*
- [x] **0.12 👤 Cloudflare:** ativar o **R2** *(R2 ativado em 15/11; falta só o alerta de orçamento de US$ 5)* na conta (pode pedir cartão mesmo dentro do gratuito) e, se preferir, o plano **Workers Paid (US$ 5/mês)**.

**✅ Pronto quando:** gateway escolhido, preços e prazos definidos, R2 ativo e termos em revisão.

---

## Fase 1 — Eventos no painel (criar, configurar, subir fotos e gerar o link)

### Armazenamento e banco
- [x] **1.1 🤖 Bucket R2 privado** `venart-fotos` (venda, prévia e miniatura), ligado ao servidor. Criado no primeiro deploy.
- [x] **1.2 🤖 Tabelas no banco:** `events` (dados, preços, prazos, status, capa, visibilidade) e `event_photos` (nome do arquivo, número #0001, tamanho, pronta).
- [x] **1.3 🤖 Regras de acesso:** prévias e miniaturas só de eventos publicados (rascunho: só você logado); a versão de venda **não tem nenhum endereço público** (a entrega após compra vem na Fase 2, com link temporário).

### Envio pelo painel
- [x] **1.4 🤖 Tela "Eventos" no painel** (tudo configurado por você, no painel): *(duplicar evento entregue na Fase 3)*
  - [x] dados do evento: nome, data, local, modalidade, descrição curta, capa (escolhida entre as fotos);
  - [x] preços **do evento** (foto avulsa e pacote; já vêm com R$ 12,90 e R$ 119,90, ajustáveis);
  - [x] prazo de venda e de download **do evento** (padrão 180 e 30 dias, ajustáveis);
  - [x] status: rascunho → publicado → encerrado (e reabrir);
  - [x] visibilidade: **só pelo link** (padrão) ou **também listado no site** (a opção já fica salva; a área no site vem na Fase 4);
  - [x] editar, encerrar e excluir (com confirmação pelo nome; apaga também os arquivos);
  - [ ] duplicar evento (ex.: treino semanal) — fica para depois.
- [x] **1.5 🤖 Envio em lote** (uma versão só; prévia e miniatura geradas no navegador):
  - [x] pelo servidor, que confere se cada arquivo é mesmo JPG (até 25 MB por foto);
  - [x] 3 fotos em paralelo, barra de progresso, velocidade e tempo restante; pausar/continuar; tela não apaga durante o envio;
  - [x] **retoma de onde parou**: escolha a mesma pasta de novo e as já enviadas são puladas;
  - [x] numeração #0001… pela ordem do nome do arquivo; tenta de novo sozinho (3×) e lista as falhas com botão "tentar de novo".
- [ ] **1.6 🤖 Teste de volume:** feito localmente com 3.000 fotos registradas (numeração sem buraco nem repetição, galeria pública paginada de 120 em 120) e envio real de 24 fotos. **Falta** medir o envio real de um evento grande na sua internet (item 1.12).
- [ ] **1.7 👤 Criar no Lightroom** a predefinição de exportação de venda (item 0.5).

### Galeria pública
- [x] **1.8 🤖 Página do evento** `/e/<evento>`: grade com carregamento progressivo, ampliar foto (deslizar no celular), "ir para foto nº", seleção das fotos com total (aplica o pacote) e **pedido pelo WhatsApp** com os números das fotos — ponte até o pagamento automático da Fase 2. Fora do Google; link com título e capa do evento ao compartilhar.
- [x] **1.9 🤖 Gerar link do evento** no painel: **Copiar link**, **Enviar pelo WhatsApp**, **Copiar mensagem pronta**, **Baixar QR Code** e **Ver galeria**.
- [x] **1.10 🤖 Proteção básica das prévias:** marca d'água "VENART" repetida em diagonal + número da foto, tamanho reduzido (1200 px), original sem endereço público.
- [x] **1.11a 🤖 Encerramento automático** da venda ao fim do prazo (a galeria passa a mostrar "venda encerrada").
- [x] **1.11b 🤖 Limpeza automática** dos arquivos no R2 depois do prazo de download — fica para a Fase 2 (precisa saber dos pedidos); por enquanto use "Excluir evento". *(limpeza automática diária entregue na Fase 3)*
- [ ] **1.12 👤 Teste real:** crie um evento de teste no painel publicado, envie ~200 fotos de um treino, abra o link no celular e me conte o tempo de envio e o que achou.

**✅ Pronto quando:** pelo painel, você cria o evento, envia 2 mil fotos sem travar, gera o link e a página do evento abre rápido no celular.

---

## Fase 2 — Loja (pagamento e download)

### Compra
- [x] **2.1 🤖 Seleção de fotos** na galeria e total com a regra do pacote (o preço é recalculado no servidor; o navegador não manda valor).
- [x] **2.2 🤖 Dados do comprador:** nome, e-mail e WhatsApp + aceite obrigatório dos Termos (a versão aceita fica gravada no pedido).
- [x] **2.3 🤖 Tabelas no banco:** `orders` (código VNA-XXXXXX, link secreto, comprador, total, status, pagamento, prazos) e `order_items`.
- [x] **2.4b 🤖 Checkout transparente:** Pix com QR Code e cartão (Card Payment Brick) na página do pedido, sem sair do site; valor sempre do servidor; até 8 tentativas por pedido (anti-teste de cartões); plano B na página do Mercado Pago. Precisa do segredo `MP_PUBLIC_KEY` para o cartão.
- [x] **2.4 🤖 Checkout Pro do Mercado Pago** (página de pagamento deles: Pix e cartão; parcelas conforme 0.3 — hoje só à vista). Pedido não pago expira em 24 h.

### Confirmação do pagamento
- [x] **2.5 🤖 Aviso automático (webhook)** em `/api/webhooks/mercadopago` com **verificação de assinatura** (`MP_WEBHOOK_SECRET`).
- [x] **2.6 🤖 Conferência dupla:** o servidor sempre consulta o pagamento no Mercado Pago (pedido, moeda e valor exato) antes de liberar. A página do pedido também confere sozinha (Pix confirmado aparece em segundos).
- [x] **2.7 🤖 Todos os casos:** pago, pendente, recusado (pode tentar de novo), expirado, reembolsado (bloqueia o download) e **divergente** (valor diferente → fica "para conferir" no painel).
- [x] **2.8 👤 Salvar as credenciais** como segredos na Cloudflare: `MP_ACCESS_TOKEN` (Access Token) e `MP_WEBHOOK_SECRET` (assinatura secreta do webhook). Enquanto não estiverem lá, a galeria continua com o pedido pelo WhatsApp. *(segredos de produção configurados — 17/11)*

### Entrega
- [x] **2.9 🤖 Página "Minhas fotos"** `/pedido/<link secreto>`: botão Baixar em cada foto (arquivo original, nome `venart-<evento>-0001.jpg`) e **Baixar todas (ZIP)** montado no aparelho do comprador.
- [x] **2.10 🤖 Reenvio do acesso:** o comprador pede pelo WhatsApp; no painel **Vendas** há "Enviar link pelo WhatsApp" com a mensagem pronta. (O link também fica salvo no aparelho de quem comprou.)
- [x] **2.11 🤖 Mensagem pronta** de WhatsApp com o link do pedido e o prazo de download.
- [x] **2.12 🤖 Testes** com um simulador do Mercado Pago: Pix pendente → pago, cartão aprovado, recusado → nova tentativa aprovada, valor divergente, reembolso, assinatura falsa (recusada), download sem pagar (bloqueado), link inventado, foto inexistente, outra origem, ZIP idêntico ao original.
- [x] **2.8b 👤 Teste no modo teste do Mercado Pago (conta PF):** compra com cartão `APRO` aprovada e download liberado em 15/11/2026.
- [x] **2.14 InfinitePay — removida (17/11/2026).** A loja usa só o Mercado Pago (conta PJ, produção). Pedidos antigos da InfinitePay continuam no histórico.
- [x] **2.13 👤🤖 Teste no ambiente de testes do Mercado Pago** (com as credenciais de teste e os cartões de teste deles) depois de 2.8. *(teste com cartão APRO no modo teste — 15/11)*
- [x] **Extra 🤖 Painel → Loja → Vendas:** lista com filtros e busca, resumo do mês, conferir pagamento, liberar manualmente (pagou por fora), bloquear download, +30 dias, anotações.
- [x] **Extra 🤖 Segurança:** evento/foto com download ainda válido não pode ser excluído; o link do pedido não é repassado a outros sites.

**✅ Pronto quando:** no modo de teste, uma compra por Pix e outra por cartão liberam o download sozinhas, e um pedido não pago não baixa nada.

---

## Fase 3 — Pós-venda e gestão

- [x] **3.1 🤖 Painel → Vendas:** lista de pedidos (status, valor, fotos, comprador), busca e filtros.
- [x] **3.2 🤖 Ações:** reenviar link, liberar manualmente, bloquear download (reembolso), +30 dias, anotações e **marcar como teste** (sai dos relatórios).
- [x] **3.3 🤖 Relatórios** (Loja → Relatórios e MEI): mês a mês (pedidos, fotos, bruto, **tarifas, líquido**, ticket médio, Pix × cartão), por evento (bruto e líquido) e **a liberar** (cartão). Tarifa, líquido e data de liberação vêm do Mercado Pago em cada pagamento; o limite do MEI usa o bruto.
- [x] **3.4 🤖 Alerta do limite do MEI:** loja + faturamento lançado à mão (serviços), com aviso no início do painel a partir de 70% e 90% de R$ 81.000/ano (proporcional no ano de abertura, se a data de abertura for preenchida em `store.mei.openedAt`).
- [ ] **3.5 🤖 Pré-venda** "todas as minhas fotos" antes do evento — aguardando decisão.
- [x] **3.6 🤖 Planilha para o contador** (CSV que abre no Excel), por mês ou ano.
- [x] **3.7 🤖 Termos de compra e Privacidade** publicados, com links no checkout.
- [x] **3.8 🤖 Duplicar evento** (mesmos dados, preços e prazos; sem fotos; como rascunho).
- [x] **3.9 🤖 Limpeza automática** diária dos arquivos de eventos com prazo encerrado (publicação + venda + download), nunca se houver comprador com download válido; aviso na lista de eventos 14 dias antes.
- [ ] **3.10 👤 Informar a data de abertura do CNPJ** (para o limite proporcional do 1º ano) e lançar o faturamento de serviços do ano.

---

## Marca d'água e proteção (avançado)

- [x] **M.1 🤖 8 modelos** (logotipos grandes, central + repetições, grade, diagonal, distribuídas, logotipos e textos, faixas cruzadas, proteção intensa), com ajustes individuais (opacidade, tamanho, densidade, espaçamento, rotação, posição, espessura das faixas, cor, texto, logotipo, intensidade leve/moderado/forte/máximo). Painel → Loja → Marca d'água e proteção.
- [x] **M.2 🤖 Marca gravada nos pixels** da prévia e da miniatura (canvas, no processamento do envio); o editor usa o mesmo motor (o que se vê é o que é publicado). Original intacto e privado.
- [x] **M.3 🤖 Proteção:** prévia reduzida (800/1200/1600 px, conferida pelo servidor), desfoque leve/moderado/forte (foto inteira ou só bordas), download só com pagamento + link secreto com prazo + limite de downloads por pedido.
- [x] **M.4 🤖 Modelo por galeria** + modelo padrão; "Reaplicar marca d'água" refaz as prévias a partir dos originais (no navegador, com fila, pausa e progresso).
- [x] **M.5 🤖 Logotipo próprio** (PNG ou SVG, convertido em PNG no navegador; SVG nunca é guardado).
- [ ] **M.6 Dependências não atendidas (documentadas):** processamento no servidor (Sharp/FFmpeg não rodam em Cloudflare Workers — exigiria Cloudflare Images ou Workers pago com WASM/filas); vídeos (a plataforma ainda não recebe vídeos); reprocessamento em segundo plano com a aba fechada (precisa do item anterior).

## Galeria de vendas (nova interface)

- [x] **G.1 🤖 Cabeçalho compacto** (nome, data, local, descrição, preços e disponibilidade) e **capa opcional por evento** (painel → evento → "Capa da página": adicionar, substituir, remover e enquadrar; não entra na venda).
- [x] **G.2 🤖 Masonry** com a proporção real de cada arquivo (2:3, 3:2, 1:1, 4:5, 16:9…), sem cortes; 2 colunas no celular, 3 no tablet, 4 no computador; carregamento progressivo.
- [x] **G.3 🤖 Filtros** por formato real (vertical, horizontal, quadrada), ordenação (nº crescente/decrescente, mais recentes/antigas) e busca pelo nº.
- [x] **G.4 🤖 Seleção** com círculo verde + ✓ e borda; foto ampliada com navegação e seleção; **carrinho fixo** com miniaturas, total, economia do pacote e "Finalizar compra".
- [x] **G.5 🤖 Selo "Economize"** só quando o pacote sai mais barato que as avulsas.
- [ ] **G.6 👤 Validar no seu celular** com um evento real (velocidade na sua internet e aparência das fotos).

## Fase 4 — Lançamento

- [x] **4.1 👤 Trocar as credenciais** de teste pelas de **produção** (eu te guio). *(produção ativa na conta PJ — 17/11)*
- [ ] **4.2 👤🤖 Compra real de ponta a ponta** com valor baixo — **Pix real concluído (17/11)**; falta o **cartão no formulário da página** (precisa do segredo `MP_PUBLIC_KEY`).
- [ ] **4.3 👤 Evento piloto:** uma galeria de treino de assessoria ou academia parceira.
- [ ] **4.4 👤 Divulgação:** QR Code no local, stories, mensagem no grupo da assessoria/academia (modelos no Kit de mensagens).
- [ ] **4.5 🤖 Ajustes** com base no piloto (velocidade, textos, dúvidas dos compradores).
- [ ] **4.6 🤖 Eventos no site público** (área que o cliente vê): página `/fotos` com os eventos marcados como "listado no site" e link no menu, ao lado de portfólio e serviços.
- [ ] **4.7 👤 Escolher quais eventos aparecem** no site (no painel, por evento).

**✅ Pronto quando:** primeiras vendas reais concluídas sem intervenção manual.

---

## Fase 5 — Busca por número de peito (corridas)

- [ ] **5.1 🤖 Leitura automática dos números** de peito nas fotos ao enviar (IA de leitura de texto), com revisão no painel.
- [ ] **5.2 🤖 Busca na galeria** por número ("digite seu número de peito").
- [ ] **5.3 👤🤖 Teste de acerto** num evento real (quantos números a IA leu certo) e ajuste.

**✅ Pronto quando:** num evento de corrida, a maioria dos atletas encontra as fotos pelo número.

---

## Fase 6 — Reconhecimento facial

### Jurídico (antes de abrir ao público)
- [x] **6.1 🤖 Rascunho** do termo de consentimento (selfie) e do aviso para eventos. _(termo `selfie-2026-11-v1` em `src/config/store.ts`, mostrado antes de cada busca e na Privacidade; aviso sugerido abaixo. Relatório de impacto: pendente com o advogado.)_
  > **Aviso sugerido para o regulamento/inscrição do evento:** "As fotos do evento serão vendidas na galeria online da Venart, que oferece busca por selfie (reconhecimento facial). Os rostos das fotos são convertidos em códigos numéricos usados só para essa busca e apagados ao fim do prazo de venda. Quem não quiser ser encontrado pela busca pode pedir a remoção pelo WhatsApp (92) …".
- [ ] **6.2 👤 Revisão** por advogado. _(recomendada mesmo com o recurso já disponível: termo, aviso do evento e relatório de impacto)_
- [ ] **6.3 👤 Aviso nos eventos:** cláusula no regulamento/inscrição (organizadores) ou aviso combinado (academias/assessorias).

### Tecnologia
- [x] **6.4 🤖 Tela de consentimento** _(piloto: /painel/rostos/, texto `piloto-2026-11-v1`, registro com data, evento, versão e iniciais; "Revogar e apagar" nas medições)_ antes da busca: caixa de seleção não marcada, texto versionado, **registro guardado** (data/hora, evento, versão, identificador anônimo) e opção de revogar.
- [x] **6.5 🤖 Selfie descartada** após a busca (nunca armazenada). _(processada só no navegador; nem a foto nem a assinatura da selfie vão ao servidor)_
- [x] **6.6 🤖 Índice de rostos** por galeria, **apagado** quando a galeria encerra (0.4). _(só assinaturas de 128 números em `face_index`; apagado na limpeza diária, ao excluir evento/foto e pelo botão "Apagar índice")_
- [ ] **6.7 🤖 Duas opções lado a lado no piloto:** AWS Rekognition × modelo aberto com licença comercial. _(modelo aberto pronto: YuNet (MIT) + SFace (Apache 2.0), rodando no navegador. Rekognition só se o acerto do aberto não for suficiente.)_

### Validação
- [ ] **6.8 👤 Voluntários** que autorizam o teste (você, amigos, atletas parceiros) num evento seu.
- [x] **6.9 🤖 Ferramenta de medição** no painel: % das fotos da pessoa encontradas e % de fotos erradas, por nível de exigência. _(marcação ✓/✗, "faltou a foto nº", tabela por limite 0,30–0,50 e medições salvas)_
- [ ] **6.10 👤🤖 Escolha da tecnologia e do nível de exigência** pelos números reais. _(ferramenta pronta: painel → **Treinar IA** — você responde "mesma pessoa / diferentes" em pares de rostos e o painel recomenda e aplica o nível; rostos < 48 px ou desfocados deixam de ser indexados)_
- [x] **6.11 🤖 Busca por selfie na galeria** _(20/11/2026: ligada evento a evento no painel → Reconhecimento facial, só depois de confirmar o aviso do evento; termo aceito a cada busca e registrado; selfie analisada no celular com o modelo leve (~10 MB) e só a assinatura vai ao servidor; pedido de remoção tira fotos da busca; nível de exigência ajustável)_
- [x] **6.11b 🤖 Galeria privada** _(opção do evento, na criação e na edição: o público não vê a lista nem busca por número; cada pessoa vê só as fotos que a própria selfie encontrou, com chave de acesso por foto válida por 72 h; o fotógrafo logado vê tudo; a foto de capa escolhida continua pública)_
- [ ] **6.12 👤 Liberar em cada evento** só com o aviso do evento (6.3) e, de preferência, depois do piloto (6.8–6.10).

**✅ Pronto quando:** consentimento registrado, avisos nos eventos e acerto medido aprovado por você.

---

## Custos de referência (simulação de 15/11/2026, dólar R$ 5,65)

| Item | Valor |
|---|---|
| Mercado Pago — Pix | 0,99% por venda (R$ 0,13 numa foto de R$ 12,90) |
| Mercado Pago — cartão à vista na hora | 4,98% (menor recebendo em 14/30 dias) |
| Asaas — Pix | grátis até a cota mensal, depois ~R$ 1,99 por Pix (confirmar) |
| Asaas — cartão | 2,99% + R$ 0,49 |
| Cloudflare R2 | US$ 0,015/GB/mês (10 GB grátis); download grátis |
| Cloudflare Workers Paid | US$ 5/mês (opcional no início) |
| AWS Rekognition (Fase 6) | ~US$ 0,001 por foto analisada e por busca |
| Infra estimada | ~R$ 60/mês (17,5 mil fotos/mês) a ~R$ 98/mês (40 mil fotos/mês) |

Confirme sempre as taxas vigentes no painel de cada empresa.

---

## Registro de decisões
| Data | Decisão | Por quem |
|---|---|---|
| 15/11/2026 | Modelo híbrido: grandes corridas na Fotto; treinos, academias e ensaios na loja própria | Gustavo |
| 15/11/2026 | Reconhecimento facial só com consentimento registrado e após validação e revisão jurídica | Gustavo |
| 15/11/2026 | Tudo (evento, dados, preços, fotos, link) é configurado pelo painel Venart; o link é divulgado por você; listagem no site público vem depois | Gustavo |
| 15/11/2026 | Uma exportação só do Lightroom (~3000 px); o painel gera prévia e miniatura com marca d'água | Claude (sugestão) |
| 15/11/2026 | Até o pagamento automático (Fase 2), a galeria envia o pedido pelo WhatsApp com os números das fotos | Claude (sugestão) |
| 15/11/2026 | Termos: uso pessoal + redes (comercial só com licença); crédito @venart_mid pedido, não obrigatório; arrependimento em 7 dias com reembolso total; reenvio gratuito após o prazo enquanto os arquivos existirem; portfólio com remoção a pedido; ajustes extras não incluídos; arquivos apagados após venda + download | Gustavo |
| 16/11/2026 | Adicionada a InfinitePay (conta PJ já ativa) como meio de pagamento principal; Mercado Pago fica como alternativa | Gustavo |
| 17/11/2026 | Checkout transparente: Pix (QR Code) e cartão (formulário seguro do Mercado Pago) na página do pedido; página do Mercado Pago como plano B | Gustavo |
| 17/11/2026 | Boleto retirado do pagamento; relatórios com tarifa e líquido; cartão com recebimento em 30 dias (configurado na conta do Mercado Pago) | Gustavo |
| 17/11/2026 | InfinitePay removida da plataforma; só Mercado Pago (conta PJ aprovada, primeira venda real por Pix concluída) | Gustavo |
| 15/11/2026 | Gateway: Mercado Pago (Checkout Pro), cartão só à vista até decidir 0.3 | Gustavo ("vamos para a próxima fase") |
| | | |
