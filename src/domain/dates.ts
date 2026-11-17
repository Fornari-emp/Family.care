/**
 * "Hoje" e "semana" sempre no fuso do usuário.
 *
 * Corrige os bugs 2 e 5 do protótipo: `today()` usava UTC (`toISOString`) e a semana
 * era um cálculo aproximado, diferente do texto "Termina em X dias".
 *
 * Convenções:
 * - `DayKey` é uma data civil `YYYY-MM-DD` no fuso do usuário.
 * - `WeekKey` é a semana ISO 8601 `YYYY-Www` (segunda a domingo).
 * - Aritmética de dias é feita sobre datas civis em UTC puro, então não depende do
 *   fuso do processo nem de horário de verão.
 */
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export type DayKey = string;
export type WeekKey = string;

export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
const MS_PER_DAY = 86_400_000;
const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidTimeZone(tz: string): boolean {
  try {
    formatInTimeZone(new Date(0), tz, 'yyyy');
    return true;
  } catch {
    return false;
  }
}

export function isValidDayKey(key: string): key is DayKey {
  const m = DAY_KEY_RE.exec(key);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function toUtcMs(key: DayKey): number {
  const m = DAY_KEY_RE.exec(key);
  if (!m) throw new Error(`DayKey inválida: ${key}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcMs(ms: number): DayKey {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Dia civil de `now` no fuso `tz`. */
export function dayKey(now: Date, tz: string = DEFAULT_TIME_ZONE): DayKey {
  return formatInTimeZone(now, tz, 'yyyy-MM-dd');
}

/** Hora (0–23) de `now` no fuso `tz`. */
export function hourIn(now: Date, tz: string = DEFAULT_TIME_ZONE): number {
  return Number(formatInTimeZone(now, tz, 'H'));
}

export function addDays(key: DayKey, n: number): DayKey {
  return fromUtcMs(toUtcMs(key) + n * MS_PER_DAY);
}

/** Número de dias de `a` até `b` (positivo se `b` é depois de `a`). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / MS_PER_DAY);
}

/** 0 = segunda … 6 = domingo (ISO). */
export function weekdayIndex(key: DayKey): number {
  return (new Date(toUtcMs(key)).getUTCDay() + 6) % 7;
}

export function mondayOf(key: DayKey): DayKey {
  return addDays(key, -weekdayIndex(key));
}

/** Semana ISO 8601 da data civil, ex.: `2026-W47`. */
export function weekKeyOfDay(key: DayKey): WeekKey {
  const thursday = addDays(key, 3 - weekdayIndex(key));
  const isoYear = Number(thursday.slice(0, 4));
  const jan4 = `${isoYear}-01-04`;
  const week1Monday = mondayOf(jan4);
  const week = Math.floor(daysBetween(week1Monday, thursday) / 7) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

export function isoWeekKey(now: Date, tz: string = DEFAULT_TIME_ZONE): WeekKey {
  return weekKeyOfDay(dayKey(now, tz));
}

/** Os 7 dias (segunda→domingo) da semana que contém `key`. */
export function weekDays(key: DayKey): DayKey[] {
  const monday = mondayOf(key);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Quantos dias faltam na semana DEPOIS de hoje (domingo = 0, "termina hoje").
 * Mesma definição de semana usada em missões, liga e XP semanal.
 */
export function daysLeftInWeek(now: Date, tz: string = DEFAULT_TIME_ZONE): number {
  return 6 - weekdayIndex(dayKey(now, tz));
}

/** Instante (UTC) da meia-noite local que inicia o dia `key` no fuso `tz`. */
export function startOfDayInstant(key: DayKey, tz: string = DEFAULT_TIME_ZONE): Date {
  return fromZonedTime(`${key}T00:00:00`, tz);
}

/** Milissegundos até a próxima meia-noite no fuso do usuário. */
export function msUntilNextDay(now: Date, tz: string = DEFAULT_TIME_ZONE): number {
  const next = startOfDayInstant(addDays(dayKey(now, tz), 1), tz);
  return next.getTime() - now.getTime();
}

/** Fração já decorrida da semana ISO (0 na segunda 00:00, ~1 no domingo 23:59). */
export function weekElapsedFraction(now: Date, tz: string = DEFAULT_TIME_ZONE): number {
  const today = dayKey(now, tz);
  const start = startOfDayInstant(mondayOf(today), tz).getTime();
  const end = startOfDayInstant(addDays(mondayOf(today), 7), tz).getTime();
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

/** `hh:mm:ss` a partir de milissegundos. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return [hh, mm, ss].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Soma meses a uma data civil, ajustando para o último dia do mês (31/01 + 1 → 28/02). */
export function addMonths(key: DayKey, n: number): DayKey {
  const m = DAY_KEY_RE.exec(key);
  if (!m) throw new Error(`DayKey inválida: ${key}`);
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + n;
  const y = Math.floor(total / 12);
  const mo = total % 12;
  const lastDay = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const d = Math.min(Number(m[3]), lastDay);
  return fromUtcMs(Date.UTC(y, mo, d));
}
