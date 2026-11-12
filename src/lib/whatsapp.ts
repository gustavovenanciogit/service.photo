/**
 * MENSAGENS DE WHATSAPP
 * ------------------------------------------------------------------
 * Cada origem de contato gera um texto diferente. Para mudar o texto
 * de uma mensagem, edite a função correspondente abaixo.
 *
 * Este módulo não depende do Astro: também roda no navegador (formulário)
 * e nos testes (tests/whatsapp.test.ts).
 */

export const formatBRL = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/ /g, ' ');

/** Monta o link wa.me. Sem número configurado, abre o WhatsApp para o cliente escolher o contato. */
export const whatsappLink = (number: string, message: string): string => {
  const digits = number.replace(/\D/g, '');
  const text = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
};

export const messages = {
  general: () =>
    'Olá! Vim pelo seu site e gostaria de saber mais sobre os seus serviços fotográficos.',

  quote: () =>
    'Olá! Vim pelo seu site e gostaria de solicitar um orçamento. Posso te passar os detalhes?',

  category: (categoryTitle: string) =>
    `Olá! Vim pelo seu site e tenho interesse nos serviços de ${categoryTitle}. Pode me passar mais informações?`,

  /**
   * Pacote selecionado. `price` é o valor já formatado ("R$ 350", "R$ 550/mês")
   * e só deve ser enviado se for público/confirmado; sem ele, a mensagem pede o valor.
   * `category` diferencia pacotes de mesmo nome (ex.: "Premium").
   */
  package: (name: string, price?: string | null, category?: string) => {
    const label = category ? `${name} (${category})` : name;
    return price
      ? `Olá! Vim pelo seu site e tenho interesse no pacote ${label}, anunciado por ${price}. Gostaria de consultar sua disponibilidade e saber como funciona o agendamento.`
      : `Olá! Vim pelo seu site e tenho interesse no pacote ${label}. Gostaria de saber o valor, consultar sua disponibilidade e entender como funciona o agendamento.`;
  },

  /** Item adicional (extras). */
  addon: (name: string, price?: string | null) =>
    price
      ? `Olá! Vim pelo seu site e tenho uma dúvida sobre o adicional ${name} (${price}). Pode me explicar como funciona?`
      : `Olá! Vim pelo seu site e gostaria de um orçamento para o adicional ${name}.`,

  faq: (question?: string) =>
    question
      ? `Olá! Vim pelo seu site e tenho uma dúvida: "${question}". Pode me ajudar?`
      : 'Olá! Vim pelo seu site, li as dúvidas frequentes e ainda tenho uma pergunta. Pode me ajudar?',

  form: (data: QuoteFormData) => {
    const lines = ['Olá! Vim pelo seu site e gostaria de um pré-orçamento.', ''];
    lines.push(`*Nome:* ${data.name.trim()}`);
    lines.push(`*Serviço:* ${data.service.trim()}`);
    if (data.date) lines.push(`*Data prevista:* ${formatDateBR(data.date)}`);
    if (data.location?.trim()) lines.push(`*Local:* ${data.location.trim()}`);
    if (data.message?.trim()) lines.push('', `*Mensagem:* ${data.message.trim()}`);
    return lines.join('\n');
  },
};

export interface QuoteFormData {
  name: string;
  service: string;
  /** AAAA-MM-DD (valor do input type="date"). */
  date?: string;
  location?: string;
  message?: string;
}

/** 2026-12-05 → 05/12/2026 (sem fuso horário, evitando "voltar um dia"). */
export const formatDateBR = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};
