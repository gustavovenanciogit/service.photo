/**
 * KIT DE MENSAGENS (painel → Mensagens)
 * ------------------------------------------------------------------
 * Edite à vontade. Variáveis preenchidas automaticamente:
 *   {nome}      → nome do contato (ex.: Mestre João)
 *   {cliente}   → academia, assessoria, evento ou pessoa
 *   {site}      → endereço do site
 *   {fotto}     → link da Fotto
 *   {instagram} → @ do Instagram
 * Condições e valores citados aqui seguem a Tabela 2026.
 */

export interface MessageTemplate {
  id: string;
  title: string;
  /** Quando usar. */
  when: string;
  text: string;
}

export const messageGroups: { title: string; items: MessageTemplate[] }[] = [
  {
    title: 'Prospecção',
    items: [
      {
        id: 'academia',
        title: 'Primeiro contato · Academia de luta',
        when: 'Direct do Instagram ou WhatsApp do responsável.',
        text: 'Fala, {nome}! Tudo certo? Sou o Gustavo, fotógrafo esportivo aqui em Manaus ({instagram}). Acompanho o trabalho da {cliente} e curto muito a energia dos treinos de vocês.\n\nTrabalho com cobertura de treinos, graduações e conteúdo para as redes de academias de luta. Posso te mandar alguns trabalhos e uma proposta rápida, sem compromisso?',
      },
      {
        id: 'assessoria',
        title: 'Primeiro contato · Assessoria de corrida',
        when: 'Direct do Instagram ou WhatsApp do treinador.',
        text: 'Olá, {nome}! Tudo bem? Sou o Gustavo, fotógrafo esportivo em Manaus ({instagram}).\n\nFaço cobertura de treinos de assessorias: a {cliente} ganha fotos profissionais para as redes, e os alunos podem comprar as próprias fotos pela Fotto. Posso te mostrar como funciona e mandar uma proposta?',
      },
      {
        id: 'organizador',
        title: 'Primeiro contato · Organizador de prova',
        when: 'Antes de uma corrida ou campeonato.',
        text: 'Olá, {nome}! Sou o Gustavo, fotógrafo esportivo aqui de Manaus ({instagram}). Vi que vocês estão organizando {cliente} e gostaria de oferecer a cobertura fotográfica do evento, com as fotos disponíveis para os participantes na Fotto.\n\nPosso te enviar uma proposta?',
      },
      {
        id: 'atleta',
        title: 'Primeiro contato · Atleta',
        when: 'Atletas de luta ou corrida que você quer acompanhar.',
        text: 'Fala, {nome}! Tudo certo? Sou o Gustavo, fotógrafo esportivo em Manaus ({instagram}). Acompanho sua trajetória e acho que dá pra fazer um material muito forte pra suas redes e patrocinadores.\n\nTenho sessões avulsas e um plano mensal para atletas. Quer que eu te mande os detalhes?',
      },
    ],
  },
  {
    title: 'Atendimento',
    items: [
      {
        id: 'quanto-custa',
        title: 'Resposta para "quanto custa?"',
        when: 'Quando alguém pede preço sem dar detalhes.',
        text: 'Oi, {nome}! Obrigado pelo contato 😊\n\nOs valores dependem do tipo de cobertura. Aqui está a tabela completa: {site}/precos\n\nE se quiser simular com extras (horas, domingo, entrega expressa): {site}/simulador\n\nMe conta: é para qual tipo de evento ou ensaio, e em que data? Assim já te mando uma proposta certinha.',
      },
      {
        id: 'reserva',
        title: 'Fechamento · Reserva da data',
        when: 'Quando o cliente aceitar a proposta.',
        text: 'Fechado, {nome}! Fico muito feliz 🙌\n\nPara reservar a data, o sinal é de 30% do valor. O pagamento pode ser no Pix (com 5% de desconto à vista) ou no cartão em até 3x sem juros.\n\nTe mando os dados para o pagamento?',
      },
    ],
  },
  {
    title: 'Follow-up',
    items: [
      {
        id: 'follow-1',
        title: 'Follow-up 1 · 3 dias depois da proposta',
        when: 'Sem resposta depois de enviar a proposta.',
        text: 'Oi, {nome}! Tudo bem? Passando para saber se você conseguiu ver a proposta que te enviei para {cliente}. Ficou alguma dúvida? Posso ajustar algo para encaixar melhor no que vocês precisam.',
      },
      {
        id: 'follow-2',
        title: 'Follow-up 2 · 7 dias depois',
        when: 'Último contato antes de pausar a negociação.',
        text: 'Oi, {nome}! Só passando para lembrar da proposta para {cliente}. Se fizer sentido, consigo reservar a agenda para vocês.\n\nSe não for o momento, sem problemas: me avisa que eu te procuro mais para frente. Obrigado!',
      },
    ],
  },
  {
    title: 'Pós-serviço',
    items: [
      {
        id: 'fotos-fotto',
        title: 'Fotos disponíveis na Fotto',
        when: 'Depois de uma prova ou treino de assessoria (grupo ou stories).',
        text: 'As fotos de {cliente} já estão no ar! 📸\n\nEncontre as suas na Fotto: {fotto}\n\nObrigado a todos que participaram!',
      },
      {
        id: 'depoimento',
        title: 'Pedido de depoimento',
        when: 'Alguns dias depois da entrega.',
        text: 'Oi, {nome}! Foi muito bom fotografar {cliente}. Você poderia me mandar 2 ou 3 frases sobre como foi a experiência? Quero usar no meu site, com a sua autorização. Obrigado! 📸',
      },
      {
        id: 'indicacao',
        title: 'Pedido de indicação',
        when: 'Clientes satisfeitos.',
        text: 'Oi, {nome}! Que bom que você gostou das fotos 😊 Se souber de alguém que esteja precisando de fotógrafo (evento, ensaio, academia ou corrida), vou ficar muito grato pela indicação. Meu site: {site}',
      },
    ],
  },
];
