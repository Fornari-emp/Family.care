/**
 * Sequência diária (bug 6).
 *
 * Regra: um dia conta quando o usuário conclui ao menos 1 AÇÃO VÁLIDA:
 * registrar um aporte com data de hoje OU ler a dica do dia. Abrir o app não conta.
 * Dias perdidos podem ser salvos por "Congelar sequência" (máx. 2 guardados).
 */
import { addDays, daysBetween, weekDays, type DayKey } from './dates';
import type { StreakState } from './types';

export const MAX_FREEZES = 2;
const HISTORY_DAYS = 60;

export function emptyStreak(): StreakState {
  return { count: 0, best: 0, lastActiveDay: null, freezes: 0, activeDays: [], frozenDays: [] };
}

function trim(days: DayKey[], today: DayKey): DayKey[] {
  return days.filter((d) => daysBetween(d, today) < HISTORY_DAYS);
}

export interface ReconcileResult {
  streak: StreakState;
  frozenUsed: DayKey[];
  broken: boolean;
}

/**
 * Aplica a passagem do tempo: se houve dias sem ação, usa congelamentos (um por dia)
 * quando houver suficientes; senão, a sequência zera (sem gastar congelamentos à toa).
 */
export function reconcileStreak(streak: StreakState, today: DayKey): ReconcileResult {
  const last = streak.lastActiveDay;
  if (last === null || streak.count === 0) return { streak, frozenUsed: [], broken: false };
  const missed = daysBetween(last, today) - 1;
  if (missed <= 0) return { streak, frozenUsed: [], broken: false };

  if (streak.freezes >= missed) {
    const frozenUsed = Array.from({ length: missed }, (_, i) => addDays(last, i + 1));
    return {
      streak: {
        ...streak,
        freezes: streak.freezes - missed,
        lastActiveDay: addDays(today, -1),
        frozenDays: trim([...streak.frozenDays, ...frozenUsed], today),
      },
      frozenUsed,
      broken: false,
    };
  }
  return { streak: { ...streak, count: 0 }, frozenUsed: [], broken: true };
}

export interface ActionResult extends ReconcileResult {
  extended: boolean;
}

/** Registra uma ação válida em `today`. Idempotente no mesmo dia. */
export function registerValidAction(streak: StreakState, today: DayKey): ActionResult {
  const rec = reconcileStreak(streak, today);
  const s = rec.streak;
  if (s.lastActiveDay === today) return { ...rec, extended: false };
  const continues = s.count > 0 && s.lastActiveDay === addDays(today, -1);
  const count = continues ? s.count + 1 : 1;
  return {
    ...rec,
    extended: true,
    streak: {
      ...s,
      count,
      best: Math.max(s.best, count),
      lastActiveDay: today,
      activeDays: trim([...s.activeDays.filter((d) => d !== today), today], today),
    },
  };
}

export type StreakStatus = 'safe' | 'at-risk' | 'none';

/** Situação de hoje: já garantida, em risco (precisa de ação hoje) ou sem sequência. */
export function streakStatus(streak: StreakState, today: DayKey): StreakStatus {
  const { streak: s } = reconcileStreak(streak, today);
  if (s.count === 0) return 'none';
  return s.lastActiveDay === today ? 'safe' : 'at-risk';
}

/** Contagem exibida hoje (já considerando dias perdidos/congelamentos). */
export function displayStreak(streak: StreakState, today: DayKey): number {
  return reconcileStreak(streak, today).streak.count;
}

export function addFreeze(streak: StreakState): StreakState | null {
  if (streak.freezes >= MAX_FREEZES) return null;
  return { ...streak, freezes: streak.freezes + 1 };
}

export type DotState = 'done' | 'frozen' | 'today' | 'missed' | 'future';

/** Pontinhos de segunda a domingo da semana atual (sem inventar dias). */
export function weekDots(streak: StreakState, today: DayKey): { day: DayKey; state: DotState }[] {
  return weekDays(today).map((day) => {
    let state: DotState;
    if (streak.activeDays.includes(day)) state = 'done';
    else if (streak.frozenDays.includes(day)) state = 'frozen';
    else if (day === today) state = 'today';
    else state = daysBetween(day, today) > 0 ? 'missed' : 'future';
    return { day, state };
  });
}
