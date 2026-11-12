# Pendências de confirmação

A imagem da **tabela de preços** não estava disponível nesta sessão de desenvolvimento
(foi enviada só uma captura de tela da conversa). Por isso **nenhum valor foi inventado**:
tudo abaixo está marcado como pendente no código e o site mostra "Sob consulta" ao público
até ser confirmado.

> Para ver os selos amarelos "Pendente de confirmação" no site, rode `npm run dev`.
> Eles **não** aparecem na versão publicada.

## 1. Contato e identidade — `src/config/site.ts`
- [ ] `name` — nome profissional (hoje: "Gustavo Fotografia")
- [ ] `whatsappNumber` — número no formato `5592XXXXXXXXX`
- [ ] `instagramUser` — usuário sem @
- [ ] `fottoUrl` — link da sua página na Fotto
- [ ] URL definitiva do site (`SITE_URL` no deploy, ou `astro.config.mjs`)

## 2. Pacotes — `src/data/services.ts` (26 pacotes, todos `confirmed: false`)
Para **cada** pacote, transcrever da tabela:
- [ ] nome exato do pacote (pode ser diferente dos nomes provisórios)
- [ ] valor (`price`) e unidade (`priceUnit`: por sessão, por mês, por hora...)
- [ ] duração (`duration`)
- [ ] quantidade de fotos (`photos`), quando houver
- [ ] prazo de entrega (`delivery`)
- [ ] benefícios/inclusos (`benefits`) e observações (`conditions`)
- [ ] etiqueta de destaque (`highlight`), se quiser usar alguma
- [ ] marcar `confirmed: true`

Observação: o "Ensaio esportivo — R$ 350" veio do **exemplo** do briefing. Está salvo como
rascunho e só será publicado após `confirmed: true`.

## 3. Dúvidas frequentes — `src/data/faq.ts`
Respostas que dependem de política comercial sua (não publicadas até confirmar):
- [ ] Preciso pagar antecipadamente?
- [ ] Quais formas de pagamento são aceitas?
- [ ] Posso solicitar uma cobertura personalizada?
- [ ] Você realiza fotografias fora de Manaus?
- [ ] Como recebo o link das minhas fotografias?
- [ ] Como funciona a compra de fotos esportivas pela Fotto?
- [ ] É possível remarcar uma sessão?

## 4. Imagens
- [ ] Foto de destaque em `src/assets/hero/`
- [ ] Fotos do portfólio em `src/assets/portfolio/<categoria>/`
- [ ] (opcional) `public/og-image.png` com uma foto sua — imagem de compartilhamento 1200×630
