/**
 * Schema Zod do estado persistido. Validamos TUDO ao carregar (item 25):
 * dados inválidos nunca chegam às regras do jogo.
 */
import { z } from 'zod';

import { CATEGORY_IDS } from '@/domain/categories';
import { isValidDayKey } from '@/domain/dates';
import type { GameState } from '@/domain/types';

export const CURRENT_SCHEMA_VERSION = 1;

const dayKey = z.string().refine(isValidDayKey, 'data inválida');
const weekKey = z.string().regex(/^\d{4}-W\d{2}$/);
const int = z.number().int();
const nonNeg = int.min(0);
const cents = nonNeg.max(Number.MAX_SAFE_INTEGER);
const category = z.enum(CATEGORY_IDS);
const iso = z.string().min(1);

const entry = z.object({
  id: z.string().min(1),
  kind: z.enum(['contribution', 'withdrawal']),
  amountCents: cents.min(1),
  category,
  day: dayKey,
  createdAt: iso,
  updatedAt: iso.optional(),
  note: z.string().max(80).optional(),
});

const goal = z.object({
  id: z.string().min(1),
  kind: z.enum(['default', 'custom']),
  name: z.string().min(1).max(40),
  targetCents: cents.min(1),
  deadline: dayKey.optional(),
  category: category.optional(),
  rewardCoins: nonNeg,
  rewardXp: nonNeg,
  claimed: z.boolean(),
  createdAt: iso,
});

const dailyMission = z.enum(['m-contribution', 'm-portfolio', 'm-tip', 'm-league']);
const weeklyMission = z.enum(['w-contribution-days', 'w-streak', 'w-xp']);

export const gameStateSchema = z.object({
  profile: z.object({
    nickname: z.string().min(1).max(20),
    onboarded: z.boolean(),
    timeZone: z.string().min(1),
    sound: z.boolean(),
    haptics: z.boolean(),
    reminder: z.object({
      enabled: z.boolean(),
      hour: int.min(0).max(23),
      minute: int.min(0).max(59),
    }),
    maxAmountCents: cents.min(100),
  }),
  xp: nonNeg,
  coins: nonNeg,
  entries: z.array(entry),
  streak: z.object({
    count: nonNeg,
    best: nonNeg,
    lastActiveDay: dayKey.nullable(),
    freezes: nonNeg.max(2),
    activeDays: z.array(dayKey),
    frozenDays: z.array(dayKey),
  }),
  daily: z.object({
    day: dayKey,
    rewardedContributions: nonNeg,
    xpFromContributions: nonNeg,
    coinsFromContributions: nonNeg,
    tipRead: z.boolean(),
    chestOpened: z.boolean(),
    missionsDone: z.array(dailyMission),
  }),
  weekly: z.object({
    week: weekKey,
    xp: nonNeg,
    contributionDays: z.array(dayKey),
    bestStreak: nonNeg,
    claimed: z.array(weeklyMission),
  }),
  weekRun: z.object({ count: nonNeg, best: nonNeg, lastWeek: weekKey.nullable() }),
  goals: z.array(goal),
  achievements: z.array(z.string()),
  ownedItems: z.array(z.string()),
  equipped: z.object({
    suit: z.string().min(1),
    accessory: z.string().nullable(),
    aura: z.string().nullable(),
    pet: z.string().nullable(),
    frame: z.string().nullable(),
  }),
  stats: z.object({
    contributionsCount: nonNeg,
    tipsRead: nonNeg,
    purchases: nonNeg,
    chestsOpened: nonNeg,
    leaguePodiums: nonNeg,
  }),
}) satisfies z.ZodType<GameState>;

export interface Envelope {
  schemaVersion: number;
  savedAt: string;
  data: GameState;
}
