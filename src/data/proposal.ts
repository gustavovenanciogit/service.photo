/**
 * PROPOSTAS — CONFIGURAÇÃO
 * ------------------------------------------------------------------
 * Tipos de cliente, textos de apresentação e o catálogo usado no
 * gerador de propostas (/proposta/nova).
 *
 * Nos textos, use:
 *   {saudacao} → "Olá, Carlos!" (ou "Olá!" se não houver responsável)
 *   {cliente}  → nome do cliente
 * O texto pode ser editado em cada proposta antes de enviar.
 */
import { categories } from './categories.ts';
import { activePackages } from './services.ts';

export interface ClientType {
  id: string;
  label: string;
  /** Pasta do portfólio com as fotos de exemplo (src/assets/portfolio/<pasta>). */
  portfolio: string;
  intro: string;
}

export const clientTypes: ClientType[] = [
  {
    id: 'academia',
    label: 'Academia de luta',
    portfolio: 'artes-marciais',
    intro:
      '{saudacao} Preparei esta proposta para levar fotografia profissional aos treinos da {cliente}. Fotos de qualidade valorizam a academia nas redes sociais, mostram a rotina dos alunos e ajudam a atrair novos atletas. Abaixo estão os serviços que separei para vocês, com valores e condições.',
  },
  {
    id: 'assessoria',
    label: 'Assessoria de corrida',
    portfolio: 'esportes',
    intro:
      '{saudacao} Preparei esta proposta para a {cliente}. A ideia é registrar os treinos com fotos profissionais: a assessoria ganha conteúdo para as redes, e os alunos podem comprar as próprias fotos pela Fotto. Confira abaixo os serviços, valores e condições.',
  },
  {
    id: 'organizador',
    label: 'Organizador de prova/evento esportivo',
    portfolio: 'esportes',
    intro:
      '{saudacao} Segue a proposta de cobertura fotográfica para {cliente}. Os participantes podem encontrar e comprar suas fotos pela Fotto. Confira abaixo os detalhes, valores e condições.',
  },
  {
    id: 'atleta',
    label: 'Atleta',
    portfolio: 'artes-marciais',
    intro:
      '{saudacao} Preparei esta proposta para acompanhar sua trajetória com fotos profissionais: material para redes sociais, patrocinadores e campeonatos. Veja abaixo os serviços que separei para você.',
  },
  {
    id: 'evento',
    label: 'Evento social',
    portfolio: 'eventos-sociais',
    intro:
      '{saudacao} Obrigado pelo contato! Preparei esta proposta para registrar o seu evento, dos detalhes aos momentos mais especiais. Confira abaixo o pacote, os valores e as condições.',
  },
  {
    id: 'ensaio',
    label: 'Ensaio',
    portfolio: 'ensaios',
    intro:
      '{saudacao} Que bom que você quer fazer um ensaio! Preparei esta proposta com o pacote que combina com o que conversamos. Confira abaixo os detalhes, valores e condições.',
  },
  {
    id: 'empresa',
    label: 'Empresa / evento corporativo',
    portfolio: 'eventos-corporativos',
    intro:
      '{saudacao} Segue a proposta de cobertura fotográfica para {cliente}, com registro profissional do evento. Confira abaixo os serviços, valores e condições.',
  },
  {
    id: 'outro',
    label: 'Outro',
    portfolio: '',
    intro: '{saudacao} Preparei esta proposta para {cliente}. Confira abaixo os serviços, valores e condições.',
  },
];

/** Validade padrão (dias) de uma proposta nova. Pode ser alterada em cada proposta. */
export const defaultValidityDays = 7;

/** Assinatura das mensagens enviadas ao cliente. */
export const proposalSignature = 'Venart · Fotografia';

/** Catálogo para o gerador: tudo com valor em reais (avulsos, planos e adicionais). */
export const proposalCatalog = categories
  .map((c) => ({
    title: c.title,
    items: activePackages
      .filter((p) => p.category === c.slug && p.price !== null && !p.priceLabel && !p.buyAt && p.confirmed)
      .map((p) => {
        const group = c.groups?.find((g) => g.id === p.group)?.title;
        return {
          id: p.id,
          name: p.name,
          label: group ? `${p.name} — ${group}` : p.name,
          category: [c.title, group].filter(Boolean).join(' · '),
          categorySlug: c.slug,
          price: p.price!,
          unit: p.priceUnit && p.priceUnit !== '/mês' ? p.priceUnit : undefined,
          monthly: !!p.subscription || p.priceUnit === '/mês',
          details: [
            p.description,
            p.duration && `Duração: ${p.duration}`,
            p.delivery && `Entrega: ${p.delivery}`,
            ...p.benefits,
          ].filter((x): x is string => !!x),
        };
      }),
  }))
  .filter((g) => g.items.length > 0);

/** Observações da tabela por categoria (rodapés), incluídas automaticamente na proposta. */
export const categoryNotes = Object.fromEntries(categories.map((c) => [c.slug, c.notes]));
