/**
 * "Liga de treino" (item 18): rivais FICTÍCIOS, claramente identificados, cujo XP cresce
 * ao longo da semana de forma determinística (semente = semana ISO). Não há outras pessoas.
 */
import type { WeekKey } from './dates';
import { seededInt, seededUnit } from './random';

export const LEAGUE_NAME = 'Liga de treino';
export const LEAGUE_DISCLAIMER =
  'Rivais fictícios controlados pelo app. A liga com outras pessoas ainda não existe.';

const RIVALS = [
  'Coruja Prudente',
  'Formiga Poupadora',
  'Tartaruga Constante',
  'Castor Construtor',
  'Lebre Apressada',
] as const;

export interface LeagueRow {
  position: number;
  name: string;
  xp: number;
  isPlayer: boolean;
  isBot: boolean;
}

/** XP final da semana de cada rival (entre 150 e 1.100, varia por semana). */
export function rivalWeekTarget(week: WeekKey, index: number): number {
  return seededInt(`${week}:rival:${index}`, 150, 1100);
}

/** XP de um rival dado quanto da semana já passou (0–1). Curva suave, nunca diminui. */
export function rivalXpAt(week: WeekKey, index: number, elapsed: number): number {
  const t = Math.min(1, Math.max(0, elapsed));
  const shape = 0.8 + seededUnit(`${week}:shape:${index}`) * 0.6; // 0.8–1.4
  return Math.round(rivalWeekTarget(week, index) * Math.pow(t, shape));
}

export function leagueStandings(
  week: WeekKey,
  elapsed: number,
  player: { name: string; xp: number },
): LeagueRow[] {
  const rows = [
    ...RIVALS.map((name, i) => ({
      name,
      xp: rivalXpAt(week, i, elapsed),
      isPlayer: false,
      isBot: true,
    })),
    { name: player.name, xp: player.xp, isPlayer: true, isBot: false },
  ];
  // Em empate, o jogador fica à frente.
  rows.sort((a, b) => b.xp - a.xp || Number(b.isPlayer) - Number(a.isPlayer));
  return rows.map((r, i) => ({ ...r, position: i + 1 }));
}

export function playerPosition(week: WeekKey, elapsed: number, playerXp: number): number {
  const row = leagueStandings(week, elapsed, { name: 'você', xp: playerXp }).find(
    (r) => r.isPlayer,
  );
  return row?.position ?? RIVALS.length + 1;
}
