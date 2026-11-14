/**
 * TEXTOS DOS AVISOS NO TELEGRAM
 * ------------------------------------------------------------------
 * - Aviso de pedido novo do site.
 * - Resumo diário (7h de Manaus): trabalhos do dia, entregas, follow-ups,
 *   propostas vencendo e pedidos sem resposta.
 * Texto simples (sem formatação), para que nada digitado pelo cliente vire comando.
 */
import type { Client, Job, Lead, ProposalRecord } from './crm.ts';
import { daysBetween, dueLabel } from './schedule.ts';
import { formatBRL } from './whatsapp.ts';

const fmtDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso);
const waLink = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  const n = d.length === 10 || d.length === 11 ? `55${d}` : d;
  return n ? `https://wa.me/${n}` : '';
};

export function leadMessage(l: Pick<Lead, 'source' | 'name' | 'phone' | 'service' | 'event_date' | 'location' | 'total' | 'message'>, panelUrl: string) {
  const lines = [`📸 Novo pedido pelo ${l.source === 'simulador' ? 'simulador' : 'formulário'} do site`, ''];
  lines.push(`Nome: ${l.name || '(não informado)'}`);
  if (l.service) lines.push(`Serviço: ${l.service}`);
  if (l.event_date) lines.push(`Data: ${fmtDate(l.event_date)}`);
  if (l.location) lines.push(`Local: ${l.location}`);
  if (l.total) lines.push(`Valor simulado: ${formatBRL(l.total)}`);
  if (l.message) lines.push(`Mensagem: ${l.message.slice(0, 300)}`);
  lines.push('');
  const wa = waLink(l.phone);
  if (wa) lines.push(`Responder no WhatsApp: ${wa}`);
  lines.push(`Ver no painel: ${panelUrl}/painel/pedidos/`);
  return lines.join('\n');
}

export interface DigestData {
  today: string;
  jobs: Job[];
  clients: Pick<Client, 'name' | 'stage' | 'next_followup' | 'phone'>[];
  proposals: Pick<ProposalRecord, 'client_name' | 'status' | 'valid_until'>[];
  newLeads: number;
}

/** Trabalhos que ainda precisam ser entregues. */
export const pendingDeliveries = (jobs: Job[]) =>
  jobs.filter((j) => j.kind === 'trabalho' && j.due_date && ['agendado', 'fotografado', 'editando'].includes(j.status));

/** Resumo do dia. Retorna '' se não houver nada a avisar. */
export function dailyDigest(d: DigestData, panelUrl: string) {
  const blocks: string[] = [];

  const todayJobs = d.jobs.filter((j) => j.kind === 'trabalho' && j.date === d.today && j.status !== 'cancelado');
  if (todayJobs.length) {
    blocks.push(['📅 Trabalhos de hoje', ...todayJobs.map((j) => `• ${j.start_time ? `${j.start_time} · ` : ''}${j.title}${j.client_name ? ` — ${j.client_name}` : ''}${j.location ? ` (${j.location})` : ''}`)].join('\n'));
  }

  const deliveries = pendingDeliveries(d.jobs)
    .filter((j) => daysBetween(d.today, j.due_date) <= 1 && j.date <= d.today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  if (deliveries.length) {
    blocks.push(['📦 Entregas', ...deliveries.map((j) => `• ${dueLabel(j.due_date, d.today).text}: ${j.title}${j.client_name ? ` — ${j.client_name}` : ''}`)].join('\n'));
  }

  const fu = d.clients.filter((c) => c.next_followup && c.next_followup <= d.today && c.stage !== 'lost');
  if (fu.length) {
    blocks.push(['🔁 Follow-ups', ...fu.map((c) => `• ${c.name}${c.next_followup < d.today ? ` (atrasado desde ${fmtDate(c.next_followup)})` : ''}`)].join('\n'));
  }

  const expiring = d.proposals.filter((p) => p.status === 'enviada' && p.valid_until && [0, 1].includes(daysBetween(d.today, p.valid_until)));
  if (expiring.length) {
    blocks.push(['📝 Propostas vencendo', ...expiring.map((p) => `• ${p.client_name} (${p.valid_until === d.today ? 'hoje' : 'amanhã'})`)].join('\n'));
  }

  if (d.newLeads) blocks.push(`📥 ${d.newLeads === 1 ? '1 pedido do site sem resposta' : `${d.newLeads} pedidos do site sem resposta`}`);

  if (!blocks.length) return '';
  return [`Bom dia! Resumo de ${fmtDate(d.today)} ☀️`, '', blocks.join('\n\n'), '', `Painel: ${panelUrl}/painel/`].join('\n');
}
