import { useEffect } from 'react';

import { gameStore } from '@/store';

import { configureNotifications, reminderKey, syncReminders } from './reminders';

/** Mantém os lembretes agendados em dia com o estado do jogo. */
export function useReminderSync(): void {
  useEffect(() => {
    configureNotifications();
    let lastKey = '';
    const check = () => {
      const { hydrated, state } = gameStore.getState();
      if (!hydrated) return;
      const now = new Date();
      const key = reminderKey(state, now);
      if (key === lastKey) return;
      lastKey = key;
      void syncReminders(state, now);
    };
    check();
    return gameStore.subscribe(check);
  }, []);
}
