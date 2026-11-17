/**
 * Recompensas de aporte e regras anti-abuso (bug 13).
 *
 * Princípio: a recompensa valoriza CONSTÂNCIA (sequência diária, semanas seguidas
 * aportando) muito mais que VOLUME, para não incentivar investir além do que se pode.
 */
import { daysBetween, isValidDayKey, type DayKey } from './dates';
import type { Cents } from './money';

export const MIN_AMOUNT_CENTS: Cents = 100; // R$ 1,00
export const DEFAULT_MAX_AMOUNT_CENTS: Cents = 100_000_000; // R$ 1.000.000,00
export const CONFIRM_ABOVE_CENTS: Cents = 5_000_000; // R$ 50.000,00
export const MAX_BACKDATE_DAYS = 30;

export const BASE_XP = 40;
export const BASE_COINS = 15;
export const FIRST_OF_WEEK_XP = 30;
export const MAX_VOLUME_XP = 20;
/** Aportes 1–3 do dia: 100%; 4–5: 25%; 6º em diante: 0. */
export const SLOT_FACTORS = [1, 1, 1, 0.25, 0.25] as const;
export const WEEK_RUN_BONUS_PER_WEEK = 0.1;
export const WEEK_RUN_BONUS_MAX = 0.5;
export const STREAK_BONUS_PER_DAY = 0.02;
export const STREAK_BONUS_MAX = 0.3;
/** Teto diário de XP/moedas vindos de aportes. */
export const DAILY_CONTRIBUTION_XP_CAP = 400;
export const DAILY_CONTRIBUTION_COINS_CAP = 120;

export type AmountError = 'below-min' | 'above-max' | 'needs-confirmation';
export type DayError = 'invalid-date' | 'future-date' | 'too-old';

export function validateAmount(
  cents: Cents,
  maxCents: Cents,
  confirmedLarge = false,
): AmountError | null {
  if (!Number.isSafeInteger(cents) || cents < MIN_AMOUNT_CENTS) return 'below-min';
  if (cents > maxCents) return 'above-max';
  if (cents > CONFIRM_ABOVE_CENTS && !confirmedLarge) return 'needs-confirmation';
  return null;
}

/** Data permitida: de hoje até 30 dias atrás. Nunca no futuro. */
export function validateEntryDay(day: DayKey, today: DayKey): DayError | null {
  if (!isValidDayKey(day)) return 'invalid-date';
  const age = daysBetween(day, today);
  if (age < 0) return 'future-date';
  if (age > MAX_BACKDATE_DAYS) return 'too-old';
  return null;
}

export function slotFactor(index: number): number {
  return SLOT_FACTORS[index] ?? 0;
}

/** Bônus de volume quase simbólico: R$ 10 = 5, R$ 100 = 10, R$ 10.000+ = 20. */
export function volumeXp(cents: Cents): number {
  const reais = cents / 100;
  if (reais < 1) return 0;
  return Math.min(MAX_VOLUME_XP, Math.floor(5 * Math.log10(reais)));
}

export function constancyMultiplier(previousWeeksRun: number, streakDays: number): number {
  const weeks = Math.min(
    WEEK_RUN_BONUS_MAX,
    WEEK_RUN_BONUS_PER_WEEK * Math.max(0, previousWeeksRun),
  );
  const streak = Math.min(STREAK_BONUS_MAX, STREAK_BONUS_PER_DAY * Math.max(0, streakDays));
  return 1 + weeks + streak;
}

export interface RewardInput {
  amountCents: Cents;
  day: DayKey;
  today: DayKey;
  /** Quantos aportes de hoje já foram recompensados. */
  rewardedToday: number;
  xpToday: number;
  coinsToday: number;
  isFirstOfWeek: boolean;
  /** Semanas seguidas ANTERIORES à atual com aporte. */
  previousWeeksRun: number;
  streakDays: number;
}

export type RewardNote = 'retroactive' | 'diminishing' | 'daily-limit' | null;

export interface Reward {
  xp: number;
  coins: number;
  note: RewardNote;
  breakdown: {
    base: number;
    volume: number;
    firstOfWeek: number;
    multiplier: number;
    slot: number;
  };
}

/**
 * XP e moedas de um aporte. Pura: usada tanto no registro quanto na prévia do formulário.
 * Aportes com data passada contam no patrimônio, mas não rendem XP nem moedas.
 */
export function contributionReward(input: RewardInput): Reward {
  const multiplier = constancyMultiplier(input.previousWeeksRun, input.streakDays);
  const volume = volumeXp(input.amountCents);
  const firstOfWeek = input.isFirstOfWeek ? FIRST_OF_WEEK_XP : 0;
  const slot = slotFactor(input.rewardedToday);
  const breakdown = { base: BASE_XP, volume, firstOfWeek, multiplier, slot };

  if (input.day !== input.today) {
    return { xp: 0, coins: 0, note: 'retroactive', breakdown: { ...breakdown, slot: 0 } };
  }

  const rawXp = Math.round((BASE_XP + volume + firstOfWeek) * multiplier * slot);
  const rawCoins = Math.round(BASE_COINS * multiplier * slot);
  const xp = Math.max(0, Math.min(rawXp, DAILY_CONTRIBUTION_XP_CAP - input.xpToday));
  const coins = Math.max(0, Math.min(rawCoins, DAILY_CONTRIBUTION_COINS_CAP - input.coinsToday));

  let note: RewardNote = null;
  if (slot === 0 || xp < rawXp || coins < rawCoins) note = 'daily-limit';
  else if (slot < 1) note = 'diminishing';
  return { xp, coins, note, breakdown };
}
