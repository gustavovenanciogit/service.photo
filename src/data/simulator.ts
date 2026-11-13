/**
 * SIMULADOR DE ORÇAMENTO — REGRAS E PACOTES
 * ------------------------------------------------------------------
 * Os valores de hora extra e entrega expressa vêm do catálogo
 * (src/data/services.ts): mudou lá, muda aqui.
 * Os percentuais seguem a Tabela 2026 (página 06).
 */
import type { QuotePackage, QuoteRules } from '../lib/quote.ts';
import { categories } from './categories.ts';
import { activePackages, isPricePublic, packages } from './services.ts';

const priceOf = (id: string) => {
  const p = packages.find((x) => x.id === id);
  if (!p || p.price === null) throw new Error(`Simulador: pacote "${id}" sem preço no catálogo.`);
  return p.price;
};

export const quoteRules: QuoteRules = {
  extraHour: priceOf('extra-hora'), // R$ 150
  expressDelivery: priceOf('extra-entrega-expressa'), // R$ 120
  sundayPct: 20, // domingos e feriados
  after22Pct: 15, // após 22h
  depositPct: 30, // sinal para reservar a data
  pixDiscountPct: 5, // desconto no Pix à vista
  installments: 3, // sem juros no cartão
  maxExtraHours: 10,
};

/** Observações por categoria mostradas no resumo. */
const categoryNotes: Record<string, string[]> = {
  'eventos-sociais': ['Eventos acima de 100 convidados: sob consulta.'],
  'ensaios-externos': ['Ensaio em 1 local. Roupa e maquiagem por conta do cliente.'],
};

/** Entrega já é em até 48h? Então a entrega expressa não faz sentido. */
const fastDelivery = (delivery: string | null) => !!delivery && /^Em (24h|48h)$/.test(delivery);

/** Pacotes disponíveis no simulador (sem adicionais e sem compras pela Fotto). */
export const simulatorGroups = categories
  .map((c) => ({
    slug: c.slug,
    title: c.title,
    items: activePackages
      .filter((p) => p.category === c.slug && !p.addon && !p.buyAt && isPricePublic(p) && p.price !== null)
      .map(
        (p): QuotePackage & { label: string; group?: string } => ({
          id: p.id,
          name: p.name,
          category: [c.title, c.groups?.find((g) => g.id === p.group)?.title].filter(Boolean).join(' · '),
          label: p.group ? `${p.name} — ${c.groups?.find((g) => g.id === p.group)?.title}` : p.name,
          price: p.price!,
          hourly: p.priceUnit === '/hora' ? { min: 2 } : undefined,
          subscription: p.subscription,
          allowExpress: !p.subscription && !fastDelivery(p.delivery),
          notes: [
            ...(categoryNotes[c.slug] ?? []),
            ...(p.subscription ? ['Assinatura com pagamento mensal antecipado e cancelamento com 30 dias de aviso.'] : []),
          ],
        }),
      ),
  }))
  .filter((g) => g.items.length > 0);

export const simulatorPackages = simulatorGroups.flatMap((g) => g.items);
