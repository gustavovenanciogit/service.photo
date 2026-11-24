# Cartão Digital e Evento em destaque

## Como usar
1. Painel → **Ferramentas → Cartão Digital**.
2. Em **Evento em destaque**, escolha o evento, a previsão de publicação (horário de Manaus) e, se quiser, um texto. Marque **Destaque ativo** e clique em **Salvar**. Vale na hora, sem deploy.
3. Gere o QR Code uma única vez em **QR Codes → Cartão digital (link fixo)**. Ele aponta para `/cartao` e nunca muda.

## Endereços
| Endereço | O que é |
|---|---|
| `/cartao` | Cartão público. O botão principal mostra o evento em destaque; abaixo ficam "Contratar fotógrafo", "Conhecer meu trabalho" e, se ligado, "Ver outros eventos". |
| `/eventos/<endereço>` | Página permanente do evento. Antes da publicação mostra nome, data, local, capa enviada, "Fotografias em preparação" e a previsão; depois, "Fotografias disponíveis" e o botão "Encontrar minhas fotos", que leva à galeria real `/e/<endereço>`. |
| `/eventos/` | Outros eventos. Funciona só com "Ver outros eventos" ligado e lista apenas os eventos marcados "Mostrar este evento em Outros eventos". |

## Regras de segurança
- Antes da publicação não sai nenhuma foto do evento e nenhum download. A galeria, a API e as prévias continuam bloqueadas até o status real ser "publicado".
- A contagem regressiva só aparece com uma previsão válida e no futuro; ela nunca fica negativa. Se a previsão passar, a página avisa que as fotos ainda estão em preparação.
- Um rascunho só ganha página pública depois de ser escolhido no Cartão Digital (`announced = 1`). Dá para retirar a página em "Páginas de espera no ar".
- Os links dos botões aceitam apenas `https://`, `http://` ou endereços do site (`/…`).

## Preparado para o futuro (ainda não implementado)
- **Avise-me quando as fotos saírem**: cadastro voluntário, com consentimento (LGPD) e aviso por e-mail. Depende de uma integração de envio autorizada. Nenhuma mensagem é disparada automaticamente.
- **Estatísticas por evento** (visitas e cliques): os botões já têm `data-track` (lista em `TRACK_EVENTS`, `src/lib/cartao.ts`). A função `track()` das páginas hoje não envia nada.
