import type { DayKey, WeekKey } from './dates';
import type { Cents } from './money';

export type CategoryId =
  | 'tesouro-selic'
  | 'tesouro-ipca'
  | 'cdb'
  | 'lci-lca'
  | 'fii'
  | 'acoes'
  | 'etf'
  | 'cripto'
  | 'previdencia'
  | 'outros';

export type EntryKind = 'contribution' | 'withdrawal';

/** Um aporte ou resgate registrado pelo usuário (o app não movimenta dinheiro). */
export interface Entry {
  id: string;
  kind: EntryKind;
  amountCents: Cents;
  category: CategoryId;
  /** Data do aporte/resgate (dia civil no fuso do usuário). */
  day: DayKey;
  /** Instante do registro (ISO UTC). */
  createdAt: string;
  updatedAt?: string;
  note?: string;
}

export type ShopSlot = 'suit' | 'accessory' | 'aura' | 'pet' | 'frame';

export interface Equipped {
  suit: string;
  accessory: string | null;
  aura: string | null;
  pet: string | null;
  frame: string | null;
}

export interface StreakState {
  /** Dias seguidos com ao menos uma ação válida. */
  count: number;
  best: number;
  /** Último dia "coberto" (ação válida ou congelamento). */
  lastActiveDay: DayKey | null;
  /** Congelamentos guardados (máx. 2). */
  freezes: number;
  /** Últimos dias com ação válida (para os pontinhos da semana). */
  activeDays: DayKey[];
  /** Últimos dias salvos por congelamento. */
  frozenDays: DayKey[];
}

export type DailyMissionId = 'm-contribution' | 'm-portfolio' | 'm-tip' | 'm-league';
export type WeeklyMissionId = 'w-contribution-days' | 'w-streak' | 'w-xp';

export interface DailyState {
  day: DayKey;
  /** Aportes de hoje que já entraram na conta de recompensa (retorno decrescente). */
  rewardedContributions: number;
  xpFromContributions: number;
  coinsFromContributions: number;
  tipRead: boolean;
  chestOpened: boolean;
  missionsDone: DailyMissionId[];
}

export interface WeeklyState {
  week: WeekKey;
  xp: number;
  /** Dias distintos desta semana em que houve aporte com data de hoje. */
  contributionDays: DayKey[];
  /** Maior sequência atingida nesta semana (missão "Manter 7 dias"). */
  bestStreak: number;
  claimed: WeeklyMissionId[];
}

/** Semanas ISO seguidas com pelo menos um aporte (constância > volume). */
export interface WeekRunState {
  count: number;
  best: number;
  lastWeek: WeekKey | null;
}

export interface Goal {
  id: string;
  kind: 'default' | 'custom';
  name: string;
  targetCents: Cents;
  /** Prazo opcional (só metas personalizadas). */
  deadline?: DayKey;
  /** Filtra o progresso por categoria (opcional, metas personalizadas). */
  category?: CategoryId;
  rewardCoins: number;
  rewardXp: number;
  claimed: boolean;
  createdAt: string;
}

export interface Profile {
  nickname: string;
  onboarded: boolean;
  timeZone: string;
  sound: boolean;
  haptics: boolean;
  reminder: { enabled: boolean; hour: number; minute: number };
  /** Valor máximo aceito por registro. */
  maxAmountCents: Cents;
}

export interface Stats {
  contributionsCount: number;
  tipsRead: number;
  purchases: number;
  chestsOpened: number;
  leaguePodiums: number;
}

export interface GameState {
  profile: Profile;
  xp: number;
  coins: number;
  entries: Entry[];
  streak: StreakState;
  daily: DailyState;
  weekly: WeeklyState;
  weekRun: WeekRunState;
  goals: Goal[];
  achievements: string[];
  ownedItems: string[];
  equipped: Equipped;
  stats: Stats;
}
