/**
 * DÚVIDAS FREQUENTES
 * ------------------------------------------------------------------
 * Respostas baseadas na Tabela 2026 e nas informações do fotógrafo.
 * Edite `answer` à vontade (parágrafos separados por linha em branco).
 * Respostas com `confirmed: false` não aparecem ao público: no lugar,
 * aparece um convite para tirar a dúvida pelo WhatsApp.
 *
 * Não publique políticas (pagamento, cancelamento, reembolso) que você
 * não pratica de fato.
 */

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  /** Botão extra abaixo da resposta (link definido em src/config/site.ts). */
  link?: 'fotto';
  confirmed: boolean;
}

export const faq: FaqItem[] = [
  {
    id: 'como-contratar',
    question: 'Como faço para contratar uma sessão fotográfica?',
    answer:
      'Escolha o serviço na tabela de preços e me chame no WhatsApp informando a data, o local e o pacote desejado. Confirmamos juntos horário, duração, localização e condições comerciais e, com o sinal pago, a data fica reservada.',
    confirmed: true,
  },
  {
    id: 'pagamento-antecipado',
    question: 'Preciso pagar antecipadamente?',
    answer:
      'Sim. Para reservar a data é cobrado um sinal de 30% do valor.\n\nNas assinaturas (planos mensais e quinzenais), o pagamento é mensal e antecipado, e o cancelamento deve ser avisado com 30 dias de antecedência.',
    confirmed: true,
  },
  {
    id: 'formas-de-pagamento',
    question: 'Quais formas de pagamento são aceitas?',
    answer: 'Pix e cartão de crédito. No cartão, em até 3x sem juros. No Pix à vista, você tem 5% de desconto.',
    confirmed: true,
  },
  {
    id: 'cobertura-personalizada',
    question: 'Posso solicitar uma cobertura personalizada?',
    answer:
      'Sim. Os pacotes podem ser complementados com os adicionais da tabela, como hora extra (R$ 150), entrega expressa em 48h (R$ 120) e vídeo curto (sob consulta, somente a pedido do cliente).\n\nEventos acima de 100 convidados são orçados sob consulta. Me chame no WhatsApp e montamos a proposta.',
    confirmed: true,
  },
  {
    id: 'prazo-de-entrega',
    question: 'Qual é o prazo para receber minhas fotografias?',
    answer:
      'Depende do pacote, e o prazo aparece em cada item da tabela de preços. Alguns exemplos: Atleta Foco em 24h, ensaio esportivo em 7 dias, ensaios externos em 7 a 10 dias e galeria completa de eventos sociais em até 10 dias úteis.\n\nSe precisar antes, existe a entrega expressa em 48h (R$ 120).',
    confirmed: true,
  },
  {
    id: 'horas-adicionais',
    question: 'Posso contratar horas adicionais?',
    answer:
      'Sim. A hora extra custa R$ 150. Em domingos e feriados há acréscimo de 20%, e as horas após as 22h têm acréscimo de 15%.',
    confirmed: true,
  },
  {
    id: 'fora-de-manaus',
    question: 'Você realiza fotografias fora de Manaus?',
    answer: 'Sim. O deslocamento para fora de Manaus é cobrado a R$ 1,50 por km, com mínimo de R$ 80, mais alimentação.',
    confirmed: true,
  },
  {
    id: 'link-das-fotos',
    question: 'Como recebo o link das minhas fotografias?',
    answer:
      'A entrega é 100% digital, com todas as fotos selecionadas e editadas. Conforme o serviço, você recebe o link pela Fotto, pelo Google Drive ou em uma galeria online.',
    confirmed: true,
  },
  {
    id: 'fotto',
    question: 'Como funciona a compra de fotos esportivas pela Fotto?',
    answer:
      'Acesse o evento criado na plataforma Fotto, encontre suas fotos e faça a compra: R$ 12,90 por foto avulsa ou R$ 119,90 por todas as fotos em que você aparece (R$ 100 na pré-venda).\n\nA cobertura é feita em pontos estratégicos da prova, por 1 fotógrafo, por isso não é garantida foto de todos os participantes. Na pré-venda, se você não for fotografado, o valor é devolvido.',
    link: 'fotto',
    confirmed: true,
  },
  {
    id: 'remarcar',
    question: 'É possível remarcar uma sessão?',
    answer:
      'Sim, a remarcação é feita mediante os pagamentos já antecipados. Nos ensaios externos, a remarcação é sem custo em caso de chuva.',
    confirmed: true,
  },
];
