/**
 * Lembrete diário de sequência: calcula QUANDO avisar, no fuso do usuário.
 * Não avisa hoje se a sequência já está garantida, e não avisa horário que já passou.
 */
import { addDays, dayKey, type DayKey } from './dates';
import { fromZonedTime } from 'date-fns-tz';

export const REMINDER_DAYS_AHEAD = 7;

export interface ReminderConfig {
  enabled: boolean;
  hour: number;
  minute: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Instante (UTC) do horário do lembrete no dia `day`, no fuso `tz`. */
export function reminderInstant(day: DayKey, hour: number, minute: number, tz: string): Date {
  return fromZonedTime(`${day}T${pad(hour)}:${pad(minute)}:00`, tz);
}

/** Próximos disparos (até 7). Vazio se o lembrete estiver desligado. */
export function reminderSchedule(
  now: Date,
  tz: string,
  config: ReminderConfig,
  actedToday: boolean,
  daysAhead = REMINDER_DAYS_AHEAD,
): Date[] {
  if (!config.enabled) return [];
  const today = dayKey(now, tz);
  const out: Date[] = [];
  for (let i = 0; i < daysAhead; i++) {
    if (i === 0 && actedToday) continue;
    const at = reminderInstant(addDays(today, i), config.hour, config.minute, tz);
    if (at.getTime() > now.getTime()) out.push(at);
  }
  return out;
}

export const REMINDER_MESSAGES = [
  'Sua sequência te espera: registre um aporte de hoje ou leia a dica do dia.',
  'Dois minutinhos: a dica de hoje já está disponível.',
  'Mantenha o ritmo! Uma ação hoje garante sua sequência.',
] as const;

export function reminderMessage(day: DayKey): string {
  const n = Number(day.slice(-2));
  return REMINDER_MESSAGES[n % REMINDER_MESSAGES.length] as string;
}
