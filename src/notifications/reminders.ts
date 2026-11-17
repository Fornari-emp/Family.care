/**
 * Lembrete diário por notificação LOCAL (nada sai do aparelho).
 * Agenda os próximos 7 dias e reagenda quando a sequência, o horário ou o fuso mudam.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, dayKey } from '@/domain/dates';
import { reminderMessage, reminderSchedule, REMINDER_DAYS_AHEAD } from '@/domain/reminders';
import type { GameState } from '@/domain/types';

const CHANNEL = 'streak-reminder';
const ID_PREFIX = 'invest-level-reminder-';

let configured = false;

export function configureNotifications(): void {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Lembrete de sequência',
      importance: AndroidImportance.DEFAULT,
    }).catch((e: unknown) => console.warn('[invest-level] canal de notificação', e));
  }
}

/** Pede permissão se ainda não tiver. Devolve se pode notificar. */
export async function ensurePermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch (e) {
    console.warn('[invest-level] permissão de notificação', e);
    return false;
  }
}

async function cancelOurs(): Promise<void> {
  await Promise.all(
    Array.from({ length: REMINDER_DAYS_AHEAD }, (_, i) =>
      Notifications.cancelScheduledNotificationAsync(`${ID_PREFIX}${i}`).catch(() => undefined),
    ),
  );
}

/** Chave que muda quando é preciso reagendar. */
export function reminderKey(state: GameState, now: Date): string {
  const { reminder, timeZone } = state.profile;
  const today = dayKey(now, timeZone);
  return [
    reminder.enabled,
    reminder.hour,
    reminder.minute,
    timeZone,
    today,
    state.streak.lastActiveDay === today,
  ].join('|');
}

/** Cancela os lembretes do app e agenda de novo conforme o estado. Nunca lança erro. */
export async function syncReminders(state: GameState, now: Date): Promise<number> {
  try {
    await cancelOurs();
    const { reminder, timeZone } = state.profile;
    const today = dayKey(now, timeZone);
    const dates = reminderSchedule(now, timeZone, reminder, state.streak.lastActiveDay === today);
    if (dates.length === 0) return 0;
    const granted = (await Notifications.getPermissionsAsync()).granted;
    if (!granted) return 0;
    await Promise.all(
      dates.map((date, i) =>
        Notifications.scheduleNotificationAsync({
          identifier: `${ID_PREFIX}${i}`,
          content: { title: 'Invest Level', body: reminderMessage(addDays(today, i)) },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date,
            channelId: CHANNEL,
          },
        }),
      ),
    );
    return dates.length;
  } catch (e) {
    console.warn('[invest-level] falha ao agendar lembretes', e);
    return 0;
  }
}
