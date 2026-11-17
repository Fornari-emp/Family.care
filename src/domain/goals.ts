/**
 * Metas de patrimônio: 3 padrão (do protótipo) + metas personalizadas.
 * Cada meta paga uma única vez (`claimed`), mesmo que o saldo caia e volte a subir (bug 14).
 */
import { daysBetween, isValidDayKey, type DayKey } from './dates';
import type { Cents } from './money';
import { totalInvested } from './portfolio';
import type { CategoryId, Entry, Goal } from './types';

export const CUSTOM_GOAL_REWARD = { coins: 100, xp: 50 } as const;
export const MAX_CUSTOM_GOALS = 20;
export const MAX_GOAL_NAME = 40;

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

export interface GoalView {
  goal: Goal;
  currentCents: Cents;
  ratio: number;
  reached: boolean;
  claimable: boolean;
  /** Prazo vencido sem atingir a meta. */
  overdue: boolean;
  daysLeft: number | null;
}

export function evaluateGoal(goal: Goal, entries: readonly Entry[], today: DayKey): GoalView {
  const currentCents = Math.max(0, totalInvested(entries, goal.category));
  const reached = currentCents >= goal.targetCents;
  const daysLeft = goal.deadline ? daysBetween(today, goal.deadline) : null;
  return {
    goal,
    currentCents,
    ratio: Math.min(1, currentCents / goal.targetCents),
    reached,
    claimable: reached && !goal.claimed,
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
  | 'not-custom';

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
