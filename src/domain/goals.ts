/**
 * Metas de patrimônio: 3 padrão (do protótipo) + metas personalizadas.
 * Cada meta paga uma única vez (`claimed`), mesmo que o saldo caia e volte a subir (bug 14).
 *
 * Anti-farm de recompensas:
 * - Só conta para RESGATE o saldo de aportes registrados há pelo menos 3 dias
 *   (resgates contam sempre). "Registrar, resgatar e excluir" deixa de render.
 * - Metas pessoais só podem ser resgatadas 7 dias após criadas/editadas e no máximo
 *   1 por semana (limite guardado na semana, não na meta — excluir não libera).
 */
import {
  addDays,
  dayKey,
  daysBetween,
  DEFAULT_TIME_ZONE,
  isValidDayKey,
  type DayKey,
} from './dates';
import type { Cents } from './money';
import { totalInvested } from './portfolio';
import type { CategoryId, Entry, Goal } from './types';

export const CUSTOM_GOAL_REWARD = { coins: 100, xp: 50 } as const;
export const MAX_CUSTOM_GOALS = 20;
export const MAX_GOAL_NAME = 40;
/** Dias desde o registro para um aporte contar no resgate de metas. */
export const GOAL_SETTLE_DAYS = 3;
/** Idade mínima (dias desde criação/edição) para resgatar meta pessoal. */
export const CUSTOM_GOAL_MIN_AGE_DAYS = 7;

export function defaultGoals(createdAt: string): Goal[] {
  const g = (id: string, name: string, reais: number, reward: number): Goal => ({
    id,
    kind: 'default',
    name,
    targetCents: reais * 100,
    rewardCoins: reward,
    rewardXp: Math.floor(reward / 2),
    claimed: false,
    createdAt,
  });
  return [
    g('g-1k', 'Primeiros R$ 1.000', 1_000, 200),
    g('g-5k', 'Chegar a R$ 5.000', 5_000, 600),
    g('g-10k', 'Chegar a R$ 10.000', 10_000, 1200),
  ];
}

export type GoalWaitReason = 'settling' | 'too-recent';

export interface GoalView {
  goal: Goal;
  /** Saldo atual (inclui aportes recentes) — usado para o progresso exibido. */
  currentCents: Cents;
  /** Saldo que conta para resgate (aportes com 3+ dias de registro). */
  settledCents: Cents;
  ratio: number;
  reached: boolean;
  claimable: boolean;
  /** Alcançada mas ainda aguardando: por que e a partir de quando libera. */
  waiting: { reasons: GoalWaitReason[]; availableOn: DayKey } | null;
  /** Prazo vencido sem atingir a meta. */
  overdue: boolean;
  daysLeft: number | null;
}

/** Dia (no fuso do usuário) em que o registro foi feito ou editado pela última vez. */
export function registeredDay(e: Entry, tz: string): DayKey {
  return dayKey(new Date(e.updatedAt ?? e.createdAt), tz);
}

/** Saldo que conta para resgate em `today`: aportes maduros − todos os resgates. */
export function settledTotal(
  entries: readonly Entry[],
  today: DayKey,
  tz: string,
  category?: CategoryId,
): Cents {
  let sum = 0;
  for (const e of entries) {
    if (category !== undefined && e.category !== category) continue;
    if (e.kind === 'withdrawal') sum -= e.amountCents;
    else if (daysBetween(registeredDay(e, tz), today) >= GOAL_SETTLE_DAYS) sum += e.amountCents;
  }
  return sum;
}

/** Primeiro dia em que o saldo maduro alcança `target`, sem novos registros. */
function settleDay(
  entries: readonly Entry[],
  target: Cents,
  tz: string,
  category?: CategoryId,
): DayKey | null {
  const scoped = entries.filter((e) => category === undefined || e.category === category);
  let sum = -scoped.filter((e) => e.kind === 'withdrawal').reduce((s, e) => s + e.amountCents, 0);
  const contributions = scoped
    .filter((e) => e.kind === 'contribution')
    .map((e) => ({ day: registeredDay(e, tz), cents: e.amountCents }))
    .sort((x, y) => x.day.localeCompare(y.day));
  for (const c of contributions) {
    sum += c.cents;
    if (sum >= target) return addDays(c.day, GOAL_SETTLE_DAYS);
  }
  return null;
}

/** Dia a partir do qual a meta pessoal tem idade para resgate. */
export function customGoalReadyDay(goal: Goal, tz: string): DayKey {
  return addDays(dayKey(new Date(goal.editedAt ?? goal.createdAt), tz), CUSTOM_GOAL_MIN_AGE_DAYS);
}

export function evaluateGoal(
  goal: Goal,
  entries: readonly Entry[],
  today: DayKey,
  tz: string = DEFAULT_TIME_ZONE,
): GoalView {
  const currentCents = Math.max(0, totalInvested(entries, goal.category));
  const settledCents = Math.max(0, settledTotal(entries, today, tz, goal.category));
  const reached = currentCents >= goal.targetCents;
  const daysLeft = goal.deadline ? daysBetween(today, goal.deadline) : null;

  let waiting: GoalView['waiting'] = null;
  if (reached && !goal.claimed) {
    const reasons: GoalWaitReason[] = [];
    let availableOn = today;
    if (settledCents < goal.targetCents) {
      reasons.push('settling');
      const d = settleDay(entries, goal.targetCents, tz, goal.category);
      if (d && d > availableOn) availableOn = d;
    }
    if (goal.kind === 'custom') {
      const ready = customGoalReadyDay(goal, tz);
      if (ready > today) {
        reasons.push('too-recent');
        if (ready > availableOn) availableOn = ready;
      }
    }
    if (reasons.length > 0) waiting = { reasons, availableOn };
  }

  return {
    goal,
    currentCents,
    settledCents,
    ratio: Math.min(1, currentCents / goal.targetCents),
    reached,
    claimable: reached && !goal.claimed && waiting === null,
    waiting,
    overdue: daysLeft !== null && daysLeft < 0 && !reached && !goal.claimed,
    daysLeft,
  };
}

export type GoalError =
  | 'not-found'
  | 'not-reached'
  | 'already-claimed'
  | 'invalid-name'
  | 'invalid-target'
  | 'invalid-deadline'
  | 'too-many-goals'
  | 'not-custom'
  | 'not-settled'
  | 'goal-too-recent'
  | 'weekly-goal-limit';

export interface GoalInput {
  name: string;
  targetCents: Cents;
  deadline?: DayKey;
  category?: CategoryId;
}

export function validateGoalInput(input: GoalInput, today: DayKey): GoalError | null {
  const name = input.name.trim();
  if (name.length === 0 || name.length > MAX_GOAL_NAME) return 'invalid-name';
  if (!Number.isSafeInteger(input.targetCents) || input.targetCents < 100) return 'invalid-target';
  if (input.deadline !== undefined) {
    if (!isValidDayKey(input.deadline) || daysBetween(today, input.deadline) < 0) {
      return 'invalid-deadline';
    }
  }
  return null;
}

export function createCustomGoal(id: string, input: GoalInput, createdAt: string): Goal {
  return {
    id,
    kind: 'custom',
    name: input.name.trim(),
    targetCents: input.targetCents,
    ...(input.deadline ? { deadline: input.deadline } : {}),
    ...(input.category ? { category: input.category } : {}),
    rewardCoins: CUSTOM_GOAL_REWARD.coins,
    rewardXp: CUSTOM_GOAL_REWARD.xp,
    claimed: false,
    createdAt,
  };
}
