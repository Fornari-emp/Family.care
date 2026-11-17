/**
 * Números reais da carteira (item 16): total aportado e série acumulada por data real.
 * Nada de rendimento fixo inventado.
 */
import type { DayKey } from './dates';
import type { Cents } from './money';
import type { CategoryId, Entry } from './types';

export function signedAmount(e: Entry): Cents {
  return e.kind === 'contribution' ? e.amountCents : -e.amountCents;
}

/** Saldo registrado (aportes − resgates). */
export function totalInvested(entries: readonly Entry[], category?: CategoryId): Cents {
  return entries
    .filter((e) => category === undefined || e.category === category)
    .reduce((sum, e) => sum + signedAmount(e), 0);
}

export function totalContributed(entries: readonly Entry[]): Cents {
  return entries.filter((e) => e.kind === 'contribution').reduce((s, e) => s + e.amountCents, 0);
}

export interface Holding {
  category: CategoryId;
  cents: Cents;
  share: number;
}

/** Saldo por categoria (só categorias com saldo positivo), do maior para o menor. */
export function holdingsByCategory(entries: readonly Entry[]): Holding[] {
  const map = new Map<CategoryId, Cents>();
  for (const e of entries) map.set(e.category, (map.get(e.category) ?? 0) + signedAmount(e));
  const positive = [...map.entries()].filter(([, c]) => c > 0);
  const total = positive.reduce((s, [, c]) => s + c, 0);
  return positive
    .map(([category, cents]) => ({ category, cents, share: total > 0 ? cents / total : 0 }))
    .sort((a, b) => b.cents - a.cents);
}

/** Total acumulado ao fim de cada dia com movimento, em ordem cronológica. */
export function cumulativeSeries(entries: readonly Entry[]): { day: DayKey; cents: Cents }[] {
  const perDay = new Map<DayKey, Cents>();
  for (const e of entries) perDay.set(e.day, (perDay.get(e.day) ?? 0) + signedAmount(e));
  let acc = 0;
  return [...perDay.keys()].sort().map((day) => {
    acc += perDay.get(day) ?? 0;
    return { day, cents: acc };
  });
}

/** Ordena do mais recente para o mais antigo (data, depois instante do registro). */
export function sortEntries(entries: readonly Entry[]): Entry[] {
  return [...entries].sort((a, b) =>
    a.day === b.day ? b.createdAt.localeCompare(a.createdAt) : b.day.localeCompare(a.day),
  );
}

export interface EntryFilter {
  kind?: Entry['kind'];
  category?: CategoryId;
  from?: DayKey;
  to?: DayKey;
}

export function filterEntries(entries: readonly Entry[], f: EntryFilter): Entry[] {
  return sortEntries(entries).filter(
    (e) =>
      (f.kind === undefined || e.kind === f.kind) &&
      (f.category === undefined || e.category === f.category) &&
      (f.from === undefined || e.day >= f.from) &&
      (f.to === undefined || e.day <= f.to),
  );
}

/** Garante que nenhuma categoria fique com saldo negativo (resgate maior que o aportado). */
export function hasNegativeBalance(entries: readonly Entry[]): boolean {
  const map = new Map<CategoryId, Cents>();
  for (const e of entries) map.set(e.category, (map.get(e.category) ?? 0) + signedAmount(e));
  return [...map.values()].some((c) => c < 0);
}
