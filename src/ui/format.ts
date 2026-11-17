import { addDays, daysBetween, hourIn, weekdayIndex, type DayKey } from '@/domain/dates';

const WEEKDAYS_SHORT = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as const;
const WEEKDAYS_LONG = [
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
  'domingo',
] as const;

export function weekdayLetter(day: DayKey): string {
  return WEEKDAYS_SHORT[weekdayIndex(day)] as string;
}
export function weekdayName(day: DayKey): string {
  return WEEKDAYS_LONG[weekdayIndex(day)] as string;
}

/** `17/11` ou `17/11/2025` quando de outro ano. */
export function formatDay(day: DayKey, today?: DayKey): string {
  const [y, m, d] = day.split('-');
  return today && today.slice(0, 4) !== y ? `${d}/${m}/${y}` : `${d}/${m}`;
}

/** "Hoje", "Ontem" ou a data. */
export function relativeDay(day: DayKey, today: DayKey): string {
  const diff = daysBetween(day, today);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return formatDay(day, today);
}

export function greeting(now: Date, tz: string, nickname: string): string {
  const h = hourIn(now, tz);
  const part = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  return `${part}, ${nickname}!`;
}

export function shiftDay(day: DayKey, delta: number): DayKey {
  return addDays(day, delta);
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;
}

/** "03:12:09" → "3 horas e 12 minutos" para leitores de tela. */
export function spokenDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return plural(m, 'minuto', 'minutos');
  return `${plural(h, 'hora', 'horas')} e ${plural(m, 'minuto', 'minutos')}`;
}
