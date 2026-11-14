/**
 * Mostra, abaixo de um campo de data do site, se a data está livre na agenda do fotógrafo.
 * O servidor só responde "ocupada" ou "livre" — nunca o motivo nem o cliente.
 * Sem conexão (ou no `npm run dev`, sem servidor), simplesmente não mostra nada.
 */
export function watchAvailability(input: HTMLInputElement, output: HTMLElement) {
  let seq = 0;
  const check = async () => {
    const date = input.value;
    const mine = ++seq;
    output.textContent = '';
    output.className = 'mt-1.5 text-xs';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    try {
      const res = await fetch(`/api/availability?date=${date}`);
      if (!res.ok || mine !== seq) return;
      const { busy } = (await res.json()) as { busy: boolean };
      if (mine !== seq) return;
      output.textContent = busy
        ? 'Já tenho um compromisso reservado nessa data. Me chame no WhatsApp para ver horários ou outra data.'
        : '✓ Data livre na agenda — a confirmação é feita pelo WhatsApp.';
      output.className = `mt-1.5 text-xs ${busy ? 'text-amber-300' : 'text-brand'}`;
    } catch {
      /* sem resposta: não mostra nada */
    }
  };
  input.addEventListener('change', check);
  return check;
}
