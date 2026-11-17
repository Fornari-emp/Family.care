/** Tabela de XP e títulos (mesmos valores do protótipo). */

export const XP_THRESHOLDS = [
  0, 100, 250, 500, 900, 1500, 2300, 3300, 4600, 6200, 8200, 10600, 13500, 17000, 21200, 26200,
  32000, 38800, 46700, 55800, 66200,
] as const;

export const MAX_LEVEL = XP_THRESHOLDS.length;
/** Moedas pagas por nível alcançado (no momento em que é alcançado — bug 10). */
export const LEVEL_UP_COINS = 100;

const RANKS: readonly (readonly [number, string])[] = [
  [1, 'Iniciante'],
  [4, 'Poupador'],
  [7, 'Investidor'],
  [11, 'Estrategista'],
  [15, 'Especialista'],
  [19, 'Magnata'],
];

export function getLevel(xp: number): number {
  let level = 1;
  XP_THRESHOLDS.forEach((min, i) => {
    if (xp >= min) level = i + 1;
  });
  return level;
}

export function rankTitle(level: number): string {
  let title = 'Iniciante';
  for (const [min, name] of RANKS) if (level >= min) title = name;
  return title;
}

export interface LevelProgress {
  level: number;
  rank: string;
  /** XP mínimo do nível atual. */
  floorXp: number;
  /** XP necessário para o próximo nível (null no nível máximo). */
  nextXp: number | null;
  /** 0–1. No nível máximo é 1 (bug 11: estado explícito, sem travar). */
  ratio: number;
  isMax: boolean;
}

export function levelProgress(xp: number): LevelProgress {
  const level = getLevel(xp);
  const floorXp = XP_THRESHOLDS[level - 1] ?? 0;
  const isMax = level >= MAX_LEVEL;
  if (isMax) return { level, rank: rankTitle(level), floorXp, nextXp: null, ratio: 1, isMax };
  const nextXp = XP_THRESHOLDS[level] as number;
  const ratio = Math.min(1, Math.max(0, (xp - floorXp) / (nextXp - floorXp)));
  return { level, rank: rankTitle(level), floorXp, nextXp, ratio, isMax };
}
