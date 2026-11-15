/**
 * LISTA SUGERIDA DE PROSPECTS — Manaus (pesquisa de novembro/2026)
 * ------------------------------------------------------------------
 * Importada pelo botão "Importar lista sugerida" na Fila de abordagem
 * (não duplica quem já estiver cadastrado com o mesmo @ ou nome).
 *
 * Fonte: resultados de busca públicos (Instagram, Facebook e diretórios).
 * Seguidores, endereços e telefones podem estar desatualizados.
 * Itens com ⚠️ nas anotações precisam de confirmação antes do contato.
 * O `hook` só usa informações vistas nas fontes.
 */
export interface Prospect {
  name: string;
  type: 'academia' | 'assessoria' | 'organizador';
  instagram?: string;
  phone?: string;
  contact?: string;
  hook: string;
  notes: string;
}

export const prospects: Prospect[] = [
  // ── Organizadores (prioridade) ──
  { name: 'FAJJE — Federação de Jiu-Jitsu do Amazonas', type: 'organizador', instagram: 'fajjeamazonas', hook: 'a divulgação do Amazon Open 2026', notes: 'Federação estadual. Organiza campeonatos: um acordo pode render várias coberturas + venda na Fotto. Prioridade.' },
  { name: 'Foco Run', type: 'organizador', instagram: 'foco.run', hook: 'as provas de 5, 10 e 21 km de vocês', notes: 'Organizadora de provas de rua em Manaus.' },

  // ── Academias de luta ──
  { name: 'White House Jiu-Jitsu School', type: 'academia', instagram: 'whitehousejiujitsuschool', hook: 'as turmas de kids, teens e adultos de vocês', notes: 'Matriz no Aleixo. ~26 mil seguidores (maior alcance). Prioridade.' },
  { name: 'Ribeiro Jiu-Jitsu Manaus', type: 'academia', instagram: 'ribeirojjmanaus', hook: 'as turmas kids e adulto de vocês', notes: '~9,9 mil seguidores. Tem link de aula experimental.' },
  { name: 'AJ Escola de Jiu-Jitsu', type: 'academia', instagram: 'ajescoladejiujitsu', hook: 'as turmas para crianças, adultos e iniciantes de vocês', notes: '~6,1 mil seguidores.' },
  { name: 'Associação Monteiro Jiu-Jitsu', type: 'academia', instagram: 'associacaomonteirojiujitsu', hook: 'o trabalho de vocês na matriz do Parque Dez', notes: 'Matriz no Parque Dez de Novembro.' },
  { name: 'Equipe Sete Jiu-Jitsu / CTT', type: 'academia', instagram: 'equipesetebjj', contact: 'Prof. Eduardo', hook: 'a história da equipe desde 2003', notes: 'Contato citado no perfil: Prof. Eduardo. ⚠️ Confirmar se é de Manaus.' },
  { name: 'Academia Campeões do Futuro', type: 'academia', instagram: 'team_ajjcf', hook: 'as turmas de jiu-jitsu e luta livre de vocês', notes: 'Petrópolis.' },
  { name: 'Nelio Thai', type: 'academia', instagram: 'neliothai', hook: 'as aulas de muay thai de vocês', notes: 'Rua Cuiabá, 155 — Nossa Senhora das Graças.' },
  { name: 'Black River Vieiralves', type: 'academia', instagram: 'blackrivervieiralves', hook: 'os treinos de muay thai de vocês', notes: 'Muay thai e crosstraining.' },
  { name: 'GF Muay Thai', type: 'academia', phone: '(92) 99148-3867', hook: 'o trabalho da GF com muay thai', notes: 'Av. Parintins, 683 — Cachoeirinha (Facebook). ⚠️ Instagram não encontrado; contato pelo WhatsApp do Facebook.' },
  { name: 'Emerson Muay Thai Team', type: 'academia', phone: '(92) 98148-8779', hook: 'o trabalho da equipe com muay thai', notes: 'Rua Adilber Viana, 54A (Facebook). ⚠️ Instagram não encontrado.' },
  { name: 'Muaythai Roots', type: 'academia', phone: '(92) 99468-7022', hook: 'o trabalho de vocês com muay thai', notes: 'São Francisco (diretório Local Treino). ⚠️ Instagram não encontrado.' },
  { name: 'ACR MMA — Associação Carlos Ribeiro', type: 'academia', instagram: 'acrmma', hook: 'os treinos de luta livre, boxe e MMA de vocês', notes: 'Luta livre, boxe e MMA.' },
  { name: 'Carioca Academy — Unidade Planalto', type: 'academia', instagram: 'cariocacademyoficial', hook: 'os treinos de boxe e MMA da unidade do Planalto', notes: 'Unidade Planalto.' },
  { name: 'Paulinho Boxe Sports Team', type: 'academia', instagram: 'boxesportsteam', hook: 'as aulas de boxe de vocês', notes: 'Boxe.' },
  { name: 'Academia UMM — União Marcial', type: 'academia', instagram: 'uniaomarcial', hook: 'as várias modalidades de luta de vocês', notes: 'Jiu-jitsu, muay thai, boxe, MMA e kickboxing. ⚠️ Confirmar se é de Manaus.' },
  { name: 'A.J.E. Gym & Fight', type: 'academia', instagram: 'ajedeboxeartsmarciais', hook: 'os treinos de boxe e artes marciais de vocês', notes: '~14 mil seguidores. ⚠️ Confirmar se é de Manaus.' },

  // ── Assessorias e grupos de corrida ──
  { name: 'KOHË Assessoria Esportiva', type: 'assessoria', instagram: 'kohe.esportiva', hook: 'o treino em grupo de vocês na Ponta Negra', notes: 'Em Manaus desde 2020; treinos na Ponta Negra (6h) e no Passeio do Mindu. Prioridade.' },
  { name: 'Corre Manaus', type: 'assessoria', instagram: 'corremanaus', hook: 'os treinos de terça e quinta de vocês', notes: 'Grupo de corrida (ter/qui 19h). Também organiza eventos para empresas.' },
  { name: 'RS Team', type: 'assessoria', instagram: 'rsteam.am', hook: 'o trabalho de vocês com corrida', notes: 'Listada no Guia de Assessorias Runners Brasil como de Manaus.' },
  { name: 'Grupo Endurance (Endurance Running Team)', type: 'assessoria', hook: 'o treino de sábado de vocês na Ponta Negra', notes: 'Sábados 6h30, estacionamento da Ponta Negra (informação de 2023). ⚠️ Instagram e contato não encontrados: procure no Instagram antes de importar o contato.' },
];
