# Loja de fotos — checklist de implementação

Venda de fotos direto pelo site: galeria por evento com marca d'água, pagamento por **Pix ou cartão**
e **download liberado automaticamente** após a confirmação do pagamento.

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
| 1 | Galerias de evento (envio e visualização com marca d'água) | Fase 0 (itens 0.4 e 0.5) | ⚪ |
| 2 | Loja: carrinho, pagamento e download automático | Fases 0 e 1 | ⚪ |
| 3 | Pós-venda e gestão (pedidos, relatórios, limite do MEI) | Fase 2 | ⚪ |
| 4 | Lançamento (teste real e divulgação) | Fases 2 e 3 | ⚪ |
| 5 | Busca por número de peito | Fase 4 | ⚪ |
| 6 | Reconhecimento facial (piloto, validação, jurídico) | Fase 4 | ⚪ |

---

## Fase 0 — Decisões e preparação

### Decisões comerciais
- [ ] **0.1 👤 Gateway de pagamento:** Mercado Pago (recomendado) ou Asaas.
      Simule uma venda de R$ 12,90 no Pix e no cartão nos dois antes de decidir (simulação de custos na conversa de 15/11/2026).
- [ ] **0.2 👤 Preços da loja:**
  - [ ] Foto avulsa: R$ 12,90? (valor da Tabela 2026)
  - [ ] Pacote "todas as minhas fotos": R$ 119,90? (valor da Tabela 2026)
  - [ ] Regra do pacote sem reconhecimento facial: o cliente seleciona as fotos dele e paga **o menor valor** entre "quantidade × R$ 12,90" e R$ 119,90? (sugestão)
  - [ ] Pré-venda R$ 100: entra agora ou depois? (sugestão: depois, na Fase 3)
- [ ] **0.3 👤 Formas de pagamento:** Pix e cartão à vista? Aceitar parcelamento no pacote? Receber o cartão na hora ou em 14/30 dias (taxa menor)?
- [ ] **0.4 👤 Prazo das galerias:** quanto tempo as fotos ficam à venda (sugestão: 6 meses) e por quanto tempo o comprador pode baixar de novo (sugestão: 30 dias).
- [ ] **0.5 👤 Padrão de exportação do Lightroom** (vou te passar as predefinições prontas):
  - [ ] Versão de venda: lado maior ~3000 px, JPEG qualidade ~85 (sugestão: equilíbrio entre qualidade e espaço).
  - [ ] Versão de prévia: lado maior ~1200 px, com marca d'água Venart.

### Jurídico e fiscal
- [ ] **0.6 👤 Contador:** confirmar que a venda de fotos digitais está coberta pela atividade do seu MEI e como emitir nota.
- [ ] **0.7 👤 Limite do MEI:** acompanhar o faturamento total (serviços + loja) frente ao limite de **R$ 81.000/ano** (~R$ 6.750/mês). A Fase 3 terá um alerta no painel.
- [ ] **0.8 🤖 Rascunho dos Termos de compra** (o que é comprado, prazo de download, uso permitido das fotos, direito de arrependimento, contato) para você revisar.
- [ ] **0.9 👤 Revisar e aprovar** os Termos de compra (idealmente com advogado ou contador).

### Contas e acessos
- [ ] **0.10 👤 Criar/acessar a conta do gateway** escolhido como **pessoa jurídica (CNPJ do MEI)** e validar os dados bancários.
- [ ] **0.11 👤 Gerar as credenciais de API** do gateway (primeiro as de **teste**; as de produção na Fase 4) — eu te guio na hora.
- [ ] **0.12 👤 Cloudflare:** ativar o **R2** na conta (pode pedir cartão mesmo dentro do gratuito) e, se preferir, o plano **Workers Paid (US$ 5/mês)**.

**✅ Pronto quando:** gateway escolhido, preços e prazos definidos, R2 ativo e termos em revisão.

---

## Fase 1 — Galerias de evento

### Armazenamento e banco
- [ ] **1.1 🤖 Bucket R2 privado** `venart-fotos` (originais e prévias), ligado ao servidor.
- [ ] **1.2 🤖 Tabelas no banco:** `galleries` (evento, data, local, preço, prazo, status rascunho/publicada/encerrada, capa) e `photos` (arquivo de venda, prévia, ordem, tamanho).
- [ ] **1.3 🤖 Regras de acesso:** prévias com marca d'água abertas ao público; originais **nunca** acessíveis sem compra (só por link temporário assinado).

### Envio pelo painel
- [ ] **1.4 🤖 Tela "Galerias"** no painel: criar galeria (nome, data, local, categoria, capa, preço).
- [ ] **1.5 🤖 Envio em lote** das duas versões (venda + prévia), pareadas pelo nome do arquivo:
  - [ ] direto do navegador para o R2 (sem passar pelo limite do servidor);
  - [ ] vários arquivos em paralelo, com barra de progresso;
  - [ ] **retoma de onde parou** se a internet cair;
  - [ ] ignora duplicadas e avisa arquivos sem par.
- [ ] **1.6 🤖 Teste de volume:** 10.000 fotos numa galeria (tempo de envio e de carregamento medidos).
- [ ] **1.7 👤 Criar no Lightroom** as duas predefinições de exportação (com o meu passo a passo).

### Galeria pública
- [ ] **1.8 🤖 Página do evento** `/fotos/<evento>`: grade de prévias com carregamento progressivo (rápida mesmo com 10 mil fotos), ampliar foto, navegação por ordem/horário.
- [ ] **1.9 🤖 Lista de eventos** `/fotos` e link "Fotos de eventos" no site; QR Code da galeria no painel (reaproveita a tela de QR Codes).
- [ ] **1.10 🤖 Proteção básica das prévias:** marca d'água (do Lightroom), tamanho reduzido, sem download direto do original.
- [ ] **1.11 🤖 Encerramento automático** da galeria ao fim do prazo (0.4) e **limpeza** dos arquivos no R2.

**✅ Pronto quando:** você cria uma galeria, envia 2 mil fotos sem travar e a página pública abre rápido no celular.

---

## Fase 2 — Loja (pagamento e download)

### Compra
- [ ] **2.1 🤖 Seleção de fotos** na galeria (marcar várias) e **carrinho** com o total, aplicando a regra do pacote (0.2).
- [ ] **2.2 🤖 Dados do comprador:** nome, e-mail e WhatsApp (para reenviar o link) + aceite dos Termos de compra.
- [ ] **2.3 🤖 Tabelas no banco:** `orders` (código, comprador, total, status, gateway, datas) e `order_items`.
- [ ] **2.4 🤖 Checkout do gateway** (página de pagamento do próprio Mercado Pago/Asaas: você não lida com dados de cartão).

### Confirmação do pagamento
- [ ] **2.5 🤖 Aviso automático do gateway (webhook)** para o servidor, com **verificação de assinatura** (impede pagamento falso).
- [ ] **2.6 🤖 Conferência dupla:** o servidor consulta o pagamento no gateway antes de liberar (não confia só no aviso).
- [ ] **2.7 🤖 Tratar todos os casos:** pago, pendente (Pix aguardando), recusado, expirado, estornado/reembolsado (bloqueia o download).
- [ ] **2.8 👤 Salvar as credenciais** como segredos na Cloudflare (eu te guio: nunca vão no código).

### Entrega
- [ ] **2.9 🤖 Página "Minhas fotos"** `/pedido/<código>`: download de cada foto e **"baixar todas" (ZIP)**, com links temporários.
- [ ] **2.10 🤖 Reenvio do acesso:** o comprador informa e-mail ou WhatsApp e recebe o link de novo (dentro do prazo de 0.4).
- [ ] **2.11 🤖 Mensagem pronta** de WhatsApp com o link do pedido (o envio de e-mail automático fica para avaliar, pois exige domínio próprio).
- [ ] **2.12 🤖 Testes no ambiente de testes do gateway:** Pix pago, Pix expirado, cartão aprovado, cartão recusado, reembolso, webhook repetido, tentativa de baixar sem pagar.

**✅ Pronto quando:** no modo de teste, uma compra por Pix e outra por cartão liberam o download sozinhas, e um pedido não pago não baixa nada.

---

## Fase 3 — Pós-venda e gestão

- [ ] **3.1 🤖 Painel → Vendas:** lista de pedidos (status, valor, fotos, comprador), busca e filtros.
- [ ] **3.2 🤖 Ações:** reenviar link, liberar manualmente (ex.: pagou por fora), registrar reembolso.
- [ ] **3.3 🤖 Relatórios:** vendas por galeria e por mês, ticket médio, Pix × cartão, taxas pagas, valor líquido.
- [ ] **3.4 🤖 Alerta do limite do MEI:** soma o faturamento da loja + valores informados dos serviços e avisa ao chegar a 70% e 90% de R$ 81.000/ano.
- [ ] **3.5 🤖 Pré-venda** "todas as minhas fotos" antes do evento (se aprovada em 0.2).
- [ ] **3.6 🤖 Exportar pedidos** em planilha (para o contador).
- [ ] **3.7 🤖 Termos de compra e Privacidade** publicados no site, com links no checkout.

**✅ Pronto quando:** você consegue acompanhar e resolver qualquer pedido sem precisar de mim.

---

## Fase 4 — Lançamento

- [ ] **4.1 👤 Trocar as credenciais** de teste pelas de **produção** (eu te guio).
- [ ] **4.2 👤🤖 Compra real de ponta a ponta** com valor baixo (você mesmo compra uma foto por Pix e outra por cartão).
- [ ] **4.3 👤 Evento piloto:** uma galeria de treino de assessoria ou academia parceira.
- [ ] **4.4 👤 Divulgação:** QR Code no local, stories, mensagem no grupo da assessoria/academia (modelos no Kit de mensagens).
- [ ] **4.5 🤖 Ajustes** com base no piloto (velocidade, textos, dúvidas dos compradores).

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
- [ ] **6.1 🤖 Rascunho** do termo de consentimento (selfie), do aviso para eventos e do relatório de impacto (LGPD).
- [ ] **6.2 👤 Revisão** por advogado.
- [ ] **6.3 👤 Aviso nos eventos:** cláusula no regulamento/inscrição (organizadores) ou aviso combinado (academias/assessorias).

### Tecnologia
- [ ] **6.4 🤖 Tela de consentimento** antes da busca: caixa de seleção não marcada, texto versionado, **registro guardado** (data/hora, evento, versão, identificador anônimo) e opção de revogar.
- [ ] **6.5 🤖 Selfie descartada** após a busca (nunca armazenada).
- [ ] **6.6 🤖 Índice de rostos** por galeria, **apagado** quando a galeria encerra (0.4).
- [ ] **6.7 🤖 Duas opções lado a lado no piloto:** AWS Rekognition × modelo aberto com licença comercial.

### Validação
- [ ] **6.8 👤 Voluntários** que autorizam o teste (você, amigos, atletas parceiros) num evento seu.
- [ ] **6.9 🤖 Ferramenta de medição** no painel: % das fotos da pessoa encontradas e % de fotos erradas, por nível de exigência.
- [ ] **6.10 👤🤖 Escolha da tecnologia e do nível de exigência** pelos números reais.
- [ ] **6.11 👤 Liberar ao público** somente após 6.2, 6.3 e 6.10.

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
| | | |
