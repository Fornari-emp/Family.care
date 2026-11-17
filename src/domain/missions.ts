/**
 * Missões diárias e semanais.
 *
 * - Bug 8: missões só são concluídas pelo EVENTO real (não por tocar na linha).
 * - Bug 3: "Manter 7 dias de sequência" progride com a sequência.
 * - Bug 4: semanais concluídas têm resgate explícito, pago uma única vez.
 */
import type { DayKey, WeekKey } from './dates';
import type { DailyMissionId, DailyState, WeeklyMissionId, WeeklyState } from './types';

export type MissionEvent = 'contribution' | 'portfolio-visit' | 'tip-read' | 'league-visit';

export interface DailyMissionDef {
  id: DailyMissionId;
  title: string;
  hint: string;
  xp: number;
  coins: number;
  trigger: MissionEvent;
  /** Para onde a interface leva ao tocar na missão. */
  route: 'investir' | 'dica' | 'metas';
}

export const DAILY_MISSIONS: readonly DailyMissionDef[] = [
  {
    id: 'm-contribution',
    title: 'Registrar um aporte',
    hint: 'Registre um aporte que você fez hoje',
    xp: 60,
    coins: 25,
    trigger: 'contribution',
    route: 'investir',
  },
  {
    id: 'm-portfolio',
    title: 'Conferir sua carteira',
    hint: 'Abra a aba Investir',
    xp: 25,
    coins: 10,
    trigger: 'portfolio-visit',
    route: 'investir',
  },
  {
    id: 'm-tip',
    title: 'Ler a dica do dia',
    hint: '30 segundos de leitura',
    xp: 35,
    coins: 15,
    trigger: 'tip-read',
    route: 'dica',
  },
  {
    id: 'm-league',
    title: 'Visitar a Liga',
    hint: 'Veja sua posição na liga de treino',
    xp: 30,
    coins: 10,
    trigger: 'league-visit',
    route: 'metas',
  },
];

export interface WeeklyMissionDef {
  id: WeeklyMissionId;
  title: string;
  goal: number;
  rewardCoins: number;
}

export const WEEKLY_MISSIONS: readonly WeeklyMissionDef[] = [
  // "3 dias diferentes" em vez de "3 vezes": aportes repetidos no mesmo dia não farmam a missão.
  { id: 'w-contribution-days', title: 'Aportar em 3 dias da semana', goal: 3, rewardCoins: 250 },
  { id: 'w-streak', title: 'Manter 7 dias de sequência', goal: 7, rewardCoins: 400 },
  { id: 'w-xp', title: 'Acumular 500 XP na semana', goal: 500, rewardCoins: 300 },
];

export function emptyDaily(day: DayKey): DailyState {
  return {
    day,
    rewardedContributions: 0,
    xpFromContributions: 0,
    coinsFromContributions: 0,
    tipRead: false,
    chestOpened: false,
    missionsDone: [],
  };
}

export function emptyWeekly(week: WeekKey): WeeklyState {
  return { week, xp: 0, contributionDays: [], bestStreak: 0, claimed: [] };
}

export interface DailyCompletion {
  daily: DailyState;
  completed: DailyMissionDef[];
}

/** Marca como concluídas as missões diárias disparadas por `event` (cada uma, uma vez por dia). */
export function completeDailyByEvent(daily: DailyState, event: MissionEvent): DailyCompletion {
  const completed = DAILY_MISSIONS.filter(
    (m) => m.trigger === event && !daily.missionsDone.includes(m.id),
  );
  if (completed.length === 0) return { daily, completed };
  return {
    daily: { ...daily, missionsDone: [...daily.missionsDone, ...completed.map((m) => m.id)] },
    completed,
  };
}

export function weeklyProgress(weekly: WeeklyState, id: WeeklyMissionId): number {
  const def = WEEKLY_MISSIONS.find((m) => m.id === id);
  if (!def) return 0;
  const raw =
    id === 'w-contribution-days'
      ? weekly.contributionDays.length
      : id === 'w-streak'
        ? weekly.bestStreak
        : weekly.xp;
  return Math.min(def.goal, raw);
}

export type WeeklyStatus = 'in-progress' | 'claimable' | 'claimed';

export function weeklyStatus(weekly: WeeklyState, id: WeeklyMissionId): WeeklyStatus {
  if (weekly.claimed.includes(id)) return 'claimed';
  const def = WEEKLY_MISSIONS.find((m) => m.id === id);
  return def && weeklyProgress(weekly, id) >= def.goal ? 'claimable' : 'in-progress';
}

export type ClaimError = 'not-found' | 'not-complete' | 'already-claimed';

/** Resgata uma missão semanal concluída. Retorna erro se não puder pagar. */
export function claimWeekly(
  weekly: WeeklyState,
  id: WeeklyMissionId,
): { weekly: WeeklyState; coins: number } | { error: ClaimError } {
  const def = WEEKLY_MISSIONS.find((m) => m.id === id);
  if (!def) return { error: 'not-found' };
  const status = weeklyStatus(weekly, id);
  if (status === 'claimed') return { error: 'already-claimed' };
  if (status !== 'claimable') return { error: 'not-complete' };
  return { weekly: { ...weekly, claimed: [...weekly.claimed, id] }, coins: def.rewardCoins };
}
