/**
 * FILA DE ABORDAGEM — textos e meta
 * ------------------------------------------------------------------
 * Edite à vontade. Variáveis:
 *   {saudacao}     → ", João!" (ou "!" sem nome do contato) — use logo após "Fala"/"Olá"/"Oi"
 *   {nome}         → primeiro nome do contato
 *   {cliente}      → nome da academia/assessoria
 *   {gancho}       → frase personalizada ("Vi o treino em grupo de vocês na Ponta Negra e curti muito.")
 *   {apresentacao} → como você se apresenta (abaixo)
 *   {site}         → endereço do site
 */

/** Como você se apresenta na primeira mensagem. */
export const apresentacao = 'Sou o Gustavo, fotógrafo esportivo aqui em Manaus (@venart_mid)';

/** Meta de NOVOS contatos por dia (os follow-ups vencidos entram sempre). */
export const metaDiariaNovos = 5;

/** Primeiro contato, por tipo de cliente (ver tipos em src/data/proposal.ts). */
export const primeiroContato: Record<string, string> = {
  academia:
    'Fala{saudacao} Tudo certo? {apresentacao}. {gancho}\n\nFaço cobertura de treinos, graduações e conteúdo para as redes de academias de luta. Posso te mandar alguns trabalhos e uma proposta rápida, sem compromisso?',
  assessoria:
    'Olá{saudacao} Tudo bem? {apresentacao}. {gancho}\n\nFaço cobertura de treinos de assessorias: vocês ganham fotos profissionais para as redes, e os alunos podem comprar as próprias fotos pela Fotto. Posso te mostrar como funciona?',
  organizador:
    'Olá{saudacao} Tudo bem? {apresentacao}. {gancho}\n\nGostaria de oferecer a cobertura fotográfica dos próximos eventos de vocês, com as fotos disponíveis para os participantes na Fotto. Posso te enviar uma proposta?',
  atleta:
    'Fala{saudacao} Tudo certo? {apresentacao}. {gancho}\n\nTenho sessões e um plano mensal para atletas, com fotos para redes sociais e patrocinadores. Quer que eu te mande os detalhes?',
  outro:
    'Olá{saudacao} Tudo bem? {apresentacao}. {gancho}\n\nPosso te mandar alguns trabalhos e uma proposta, sem compromisso?',
};

/** Mensagens seguintes da cadência (iguais para todos os tipos). */
export const followUps = {
  follow1:
    'Oi{saudacao} Tudo bem? Passando de novo por aqui 😊 Separei alguns trabalhos meus aqui de Manaus: {site}/#portfolio\n\nSe fizer sentido para a {cliente}, te mando uma proposta sem compromisso.',
  follow2:
    'Oi{saudacao} Último toque por aqui, prometo não incomodar 😅 Se em algum momento precisarem de fotos (treino, graduação ou evento), é só me chamar. Minha tabela: {site}/precos',
  retomada:
    'Oi{saudacao} Tudo certo? Passando para saber como estão as coisas na {cliente}. Estou com agenda aberta para as próximas semanas: se quiserem registrar treinos ou algum evento, me chama!',
};
