/**
 * FILA DE ABORDAGEM — regras
 * ------------------------------------------------------------------
 * Cadência de cada prospect (etapa → próxima ação):
 *   0  Ainda não abordado ........ "Primeiro contato" (entra na fila conforme a meta diária)
 *   1  1º contato enviado ........ "Follow-up 1" depois de 3 dias
 *   2  Follow-up 1 enviado ....... "Follow-up 2" depois de mais 4 dias (dia 7)
 *   3  Follow-up 2 enviado ....... pausa de 30 dias → "Retomar contato"
 *   4  Retomada enviada .......... fim da cadência (fica em "Contatado" sem novo lembrete)
 * Quando a pessoa responde, o cliente vai para "Em negociação" e sai da fila.
 * Funções puras: servidor, painel e testes usam as mesmas regras.
 */
import type { Client, ClientStage } from './crm.ts';
import { addDaysISO } from './schedule.ts';

export const STEPS = [
  { step: 0, id: 'primeiro', label: 'Primeiro contato', waitDays: 3 },
  { step: 1, id: 'follow1', label: 'Follow-up 1', waitDays: 4 },
  { step: 2, id: 'follow2', label: 'Follow-up 2', waitDays: 30 },
  { step: 3, id: 'retomada', label: 'Retomar contato', waitDays: 0 },
] as const;
export type StepId = (typeof STEPS)[number]['id'];

export const LAST_STEP = STEPS.length; // 4 = cadência concluída

export type OutreachAction = 'sent' | 'replied' | 'skip' | 'lost';

/** Próxima mensagem da cadência para o cliente (ou null se não há). */
export const nextStep = (c: Pick<Client, 'outreach_step'>) => STEPS.find((s) => s.step === c.outreach_step) ?? null;

/** Canal preferido: Instagram se tiver @, senão WhatsApp. */
export const channelOf = (c: Pick<Client, 'instagram' | 'phone'>): 'instagram' | 'whatsapp' | null =>
  c.instagram ? 'instagram' : c.phone.replace(/\D/g, '').length >= 10 ? 'whatsapp' : null;

/** Mudança de estado do cliente após uma ação na fila. */
export function applyOutreach(
  c: Pick<Client, 'stage' | 'outreach_step' | 'next_followup' | 'last_contact'>,
  action: OutreachAction,
  today: string,
): { stage: ClientStage; outreach_step: number; next_followup: string; last_contact: string } {
  if (action === 'replied') return { stage: 'negotiating', outreach_step: c.outreach_step, next_followup: '', last_contact: today };
  if (action === 'lost') return { stage: 'lost', outreach_step: c.outreach_step, next_followup: '', last_contact: c.last_contact };
  if (action === 'skip') return { stage: c.stage, outreach_step: c.outreach_step, next_followup: addDaysISO(today, 1), last_contact: c.last_contact };
  // 'sent'
  const step = nextStep(c);
  if (!step) return { stage: c.stage, outreach_step: c.outreach_step, next_followup: '', last_contact: today };
  const next = c.outreach_step + 1;
  return {
    stage: c.stage === 'prospect' ? 'contacted' : c.stage,
    outreach_step: next,
    next_followup: next < LAST_STEP ? addDaysISO(today, step.waitDays) : '',
    last_contact: today,
  };
}

/** Está "em cadência"? (só prospects e contatados; negociação, clientes e perdidos saem) */
const inCadence = (c: Pick<Client, 'stage'>) => c.stage === 'prospect' || c.stage === 'contacted';

export interface QueueItem<C> {
  client: C;
  step: (typeof STEPS)[number];
  overdueDays: number;
}

/**
 * Fila do dia:
 *  1. Follow-ups/retomadas vencidos (mais atrasados primeiro);
 *  2. Novos contatos (etapa 0) até completar a meta diária de novos,
 *     descontando os novos já enviados hoje.
 */
export function buildQueue<C extends Client>(clients: C[], today: string, dailyNew: number) {
  const followUps: QueueItem<C>[] = [];
  const fresh: QueueItem<C>[] = [];
  for (const c of clients) {
    if (!inCadence(c)) continue;
    const step = nextStep(c);
    if (!step) continue;
    if (c.outreach_step === 0) {
      if (c.next_followup && c.next_followup > today) continue; // "pular hoje"
      fresh.push({ client: c, step, overdueDays: 0 });
    } else if (c.next_followup && c.next_followup <= today) {
      const overdue = Math.round((Date.parse(today) - Date.parse(c.next_followup)) / 86_400_000);
      followUps.push({ client: c, step, overdueDays: overdue });
    }
  }
  followUps.sort((a, b) => b.overdueDays - a.overdueDays);
  // Novos: primeiro quem tem canal de contato; depois a ordem de cadastro (a lista sugerida começa pelas prioridades).
  fresh.sort(
    (a, b) =>
      Number(!!channelOf(b.client)) - Number(!!channelOf(a.client)) ||
      a.client.created_at.localeCompare(b.client.created_at) ||
      a.client.name.localeCompare(b.client.name),
  );
  const sentNewToday = clients.filter((c) => c.outreach_step === 1 && c.last_contact === today).length;
  const room = Math.max(0, dailyNew - sentNewToday);
  return {
    followUps,
    fresh: fresh.slice(0, room),
    waitingNew: fresh.length,
    sentToday: clients.filter((c) => c.last_contact === today).length,
    sentNewToday,
  };
}

/** Preenche o texto da mensagem. */
export function fillMessage(
  template: string,
  c: Pick<Client, 'name' | 'contact' | 'hook' | 'instagram'>,
  vars: { apresentacao: string; site: string },
) {
  const first = c.contact.trim().split(/\s+/)[0] ?? '';
  const hookSentence = c.hook.trim() ? `Vi ${c.hook.trim()} e curti muito.` : 'Acompanho o trabalho de vocês e curto muito a energia dos treinos.';
  return template
    // No modelo: "Fala{saudacao}" → "Fala, João!" (ou "Fala!" sem nome do contato)
    .replace(/\{saudacao\}/g, first ? `, ${first}!` : '!')
    .replace(/\{nome\}/g, first)
    .replace(/\{cliente\}/g, c.name.trim())
    .replace(/\{gancho\}/g, hookSentence)
    .replace(/\{apresentacao\}/g, vars.apresentacao)
    .replace(/\{site\}/g, vars.site)
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
