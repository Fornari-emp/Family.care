/** Baú diário: um por dia LOCAL; recompensa determinística pelo dia (40–120 moedas, 50 XP). */
import type { DayKey } from './dates';
import { seededInt } from './random';

export const CHEST_XP = 50;

export function chestReward(day: DayKey): { coins: number; xp: number } {
  return { coins: 40 + seededInt(`chest:${day}`, 0, 4) * 20, xp: CHEST_XP };
}
