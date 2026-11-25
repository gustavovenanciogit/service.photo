# Cartão Digital e Evento em destaque

## Como usar
1. Painel → **Ferramentas → Cartão Digital**.
2. Em **Evento em destaque**, escolha o evento, a previsão de publicação (horário de Manaus) e, se quiser, um texto. Marque **Destaque ativo** e clique em **Salvar**. Vale na hora, sem deploy.
3. Gere o QR Code uma única vez em **QR Codes → Cartão digital (link fixo)**. Ele aponta para `/cartao` e nunca muda.

## Sem evento em destaque: vitrine e redes sociais
Quando o destaque está desligado, o cartão mostra:
- Um **carrossel** com fotos do seu portfólio. Ele passa sozinho a cada 4 segundos, aceita arrastar com o dedo e fica parado para quem configurou o celular com menos movimento.
- Os cartões **Instagram** e **TikTok** com o botão "Seguir".

No painel (Cartão Digital → **Vitrine e redes sociais**) você escolhe:
- quais fotos entram, até 12, na ordem do toque; sem escolha, entram todas;
- o título do carrossel;
- se ele também aparece quando houver evento em destaque.

As fotos vêm do portfólio do site (Site → Fotos). Com evento em destaque, as redes aparecem só como ícones.

O cartão não carrega o feed do Instagram ou do TikTok. Isso exigiria scripts dessas empresas, que colocam cookies de rastreamento, ou a API do Instagram, com chave renovada a cada 60 dias. Por isso a vitrine usa as suas próprias fotos e os botões levam aos perfis.

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

## Aviso por e-mail quando as fotos saírem
Na página de espera, o cliente pode pedir um aviso por e-mail. O pedido é voluntário e exige marcar a autorização (LGPD). Quando você **publica** o evento, o sistema envia um único e-mail com o botão "Encontrar minhas fotos", que leva à galeria.

- **Envio:** os primeiros lotes saem na hora da publicação (cerca de 200 e-mails). O restante e as novas tentativas saem pela tarefa automática a cada 10 minutos. No painel (Cartão Digital → Aviso por e-mail) aparecem as contagens e o botão "Enviar avisos agora".
- **Privacidade:** o e-mail é apagado logo depois do envio; fica só a contagem. Pedidos de eventos que nunca foram publicados são apagados em 180 dias. O cliente pode cancelar na mesma página.
- **Sem configuração, nada aparece:** o formulário só é exibido com o envio configurado.

### Como ligar (uma vez)
1. Crie uma conta grátis no [Resend](https://resend.com). O plano grátis envia cerca de 3 mil e-mails por mês e até 100 por dia.
2. Em **Domains**, adicione e verifique o seu domínio (registros DNS). Sem domínio próprio, o Resend só entrega para o e-mail da sua conta, então serve apenas para teste.
3. Em **API Keys**, crie uma chave com permissão de envio.
4. No painel da Cloudflare → Workers → venart → Settings → Variables and Secrets, adicione **como segredos** (tipo *Secret*):
   - `RESEND_API_KEY`: a chave do passo 3;
   - `EMAIL_FROM`: o remetente, por exemplo `Venart <avisos@seudominio.com.br>` (do domínio verificado).
5. Abra Cartão Digital no painel. "Aviso por e-mail" deve mostrar **Ligado**.

Nunca cole a chave no chat nem no código.

## Preparado para o futuro (ainda não implementado)
- **Estatísticas por evento** (visitas e cliques): os botões já têm `data-track` (lista em `TRACK_EVENTS`, `src/lib/cartao.ts`). A função `track()` das páginas hoje não envia nada.
