import * as Notifications from 'expo-notifications';

import { defaultState } from '@/domain/state';
import type { GameState } from '@/domain/types';
import {
  configureNotifications,
  ensurePermission,
  reminderKey,
  syncReminders,
} from '@/notifications/reminders';
import { sp } from '../helpers/game';

const N = Notifications as jest.Mocked<typeof Notifications>;
const NOW = sp('2026-11-17T10:00:00');

function withReminder(enabled: boolean, lastActiveDay: string | null = null): GameState {
  const s = defaultState(NOW);
  return {
    ...s,
    profile: { ...s.profile, reminder: { enabled, hour: 20, minute: 30 } },
    streak: { ...s.streak, lastActiveDay, count: lastActiveDay ? 1 : 0 },
  };
}

beforeEach(() => jest.clearAllMocks());

describe('lembretes por notificação local', () => {
  it('agenda 7 lembretes com id próprio e cancela os anteriores', async () => {
    expect(await syncReminders(withReminder(true), NOW)).toBe(7);
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(7);
    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(7);
    const first = N.scheduleNotificationAsync.mock.calls[0]![0];
    expect(first.identifier).toBe('invest-level-reminder-0');
    expect((first.trigger as { date: Date }).date.toISOString()).toBe('2026-11-17T23:30:00.000Z');
  });

  it('não lembra hoje se a sequência já está garantida', async () => {
    expect(await syncReminders(withReminder(true, '2026-11-17'), NOW)).toBe(6);
  });

  it('desligado só cancela', async () => {
    expect(await syncReminders(withReminder(false), NOW)).toBe(0);
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalled();
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('sem permissão não agenda; erro não derruba o app', async () => {
    N.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
    expect(await syncReminders(withReminder(true), NOW)).toBe(0);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    N.getPermissionsAsync.mockRejectedValueOnce(new Error('x'));
    expect(await syncReminders(withReminder(true), NOW)).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('permissão: já concedida, pedida, negada sem poder pedir de novo', async () => {
    expect(await ensurePermission()).toBe(true);
    N.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
    N.requestPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    expect(await ensurePermission()).toBe(false);
    N.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    expect(await ensurePermission()).toBe(false);
    expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('chave de reagendamento muda só quando precisa', () => {
    const a = reminderKey(withReminder(true), NOW);
    expect(reminderKey(withReminder(true), sp('2026-11-17T22:00:00'))).toBe(a);
    expect(reminderKey(withReminder(true, '2026-11-17'), NOW)).not.toBe(a);
    expect(reminderKey(withReminder(true), sp('2026-11-18T08:00:00'))).not.toBe(a);
  });

  it('configura o handler uma única vez', () => {
    configureNotifications();
    configureNotifications();
    expect(N.setNotificationHandler).toHaveBeenCalledTimes(1);
  });
});
