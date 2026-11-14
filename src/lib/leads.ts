/**
 * Envia o pedido do site para o painel do fotógrafo.
 * Não atrasa nem bloqueia o WhatsApp: se falhar (sem internet, servidor fora),
 * o cliente continua o atendimento normalmente pelo WhatsApp.
 */
export interface LeadPayload {
  source: 'formulario' | 'simulador';
  name?: string;
  phone?: string;
  service?: string;
  package_id?: string;
  event_date?: string;
  location?: string;
  message?: string;
  total?: number;
  details?: string;
  /** Campo-armadilha anti-robô (deve ir vazio). */
  website?: string;
}

export function sendLead(lead: LeadPayload) {
  try {
    void fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
      keepalive: true, // conclui o envio mesmo se a página trocar para o WhatsApp
      credentials: 'same-origin',
    }).catch(() => {});
  } catch {
    /* sem suporte: segue só pelo WhatsApp */
  }
}
