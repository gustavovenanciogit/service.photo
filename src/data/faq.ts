/**
 * DÚVIDAS FREQUENTES
 * ------------------------------------------------------------------
 * Edite `answer` e marque `confirmed: true` quando a resposta estiver
 * validada por você. Respostas com `confirmed: false` NÃO são exibidas
 * ao público: no lugar, aparece um convite para tirar a dúvida pelo
 * WhatsApp. No modo dev, aparece o selo "Pendente de confirmação" e o
 * rascunho, para você revisar.
 *
 * Não publique políticas (pagamento, cancelamento, reembolso) que você
 * não pratica de fato.
 */

export interface FaqItem {
  id: string;
  question: string;
  /** Resposta (texto simples; parágrafos separados por linha em branco). */
  answer: string;
  confirmed: boolean;
}

export const faq: FaqItem[] = [
  {
    id: 'como-contratar',
    question: 'Como faço para contratar uma sessão fotográfica?',
    answer:
      'Escolha o serviço na tabela de preços e me chame no WhatsApp informando a data, o local e o pacote desejado. Confirmamos juntos horário, duração, localização e condições comerciais e, depois disso, o serviço é agendado.',
    confirmed: true,
  },
  {
    id: 'pagamento-antecipado',
    question: 'Preciso pagar antecipadamente?',
    answer: 'PENDENTE: informe se há sinal/entrada e em que momento o pagamento é feito.',
    confirmed: false,
  },
  {
    id: 'formas-de-pagamento',
    question: 'Quais formas de pagamento são aceitas?',
    answer: 'PENDENTE: informe as formas aceitas (Pix, cartão, parcelamento etc.).',
    confirmed: false,
  },
  {
    id: 'cobertura-personalizada',
    question: 'Posso solicitar uma cobertura personalizada?',
    answer: 'PENDENTE: confirme se monta pacotes sob medida e como funciona o orçamento.',
    confirmed: false,
  },
  {
    id: 'prazo-de-entrega',
    question: 'Qual é o prazo para receber minhas fotografias?',
    answer:
      'O prazo de entrega varia conforme o pacote contratado e é informado na tabela de preços e confirmado no momento do agendamento.',
    confirmed: true,
  },
  {
    id: 'horas-adicionais',
    question: 'Posso contratar horas adicionais?',
    answer:
      'Sim. Horas adicionais fazem parte dos extras da tabela de preços. Consulte a categoria "Extras e pagamento" ou fale comigo pelo WhatsApp.',
    confirmed: true,
  },
  {
    id: 'fora-de-manaus',
    question: 'Você realiza fotografias fora de Manaus?',
    answer: 'PENDENTE: confirme se atende fora de Manaus e como é cobrado o deslocamento.',
    confirmed: false,
  },
  {
    id: 'link-das-fotos',
    question: 'Como recebo o link das minhas fotografias?',
    answer: 'PENDENTE: informe como as fotos são entregues (Google Drive, galeria online, Fotto etc.).',
    confirmed: false,
  },
  {
    id: 'fotto',
    question: 'Como funciona a compra de fotos esportivas pela Fotto?',
    answer: 'PENDENTE: explique como o atleta encontra e compra as fotos na Fotto.',
    confirmed: false,
  },
  {
    id: 'remarcar',
    question: 'É possível remarcar uma sessão?',
    answer: 'PENDENTE: informe as condições para remarcação.',
    confirmed: false,
  },
];
