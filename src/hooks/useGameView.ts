/** Valores derivados usados em várias telas. */
import { useMemo } from 'react';

import { dayKey } from '@/domain/dates';
import { levelProgress } from '@/domain/levels';
import { displayStreak } from '@/domain/streak';
import { useGame } from '@/store';

export function useToday(): string {
  const tz = useGame((s) => s.state.profile.timeZone);
  // Recalcula a cada render; a virada de dia é aplicada pelo SYNC no foco do app.
  return dayKey(new Date(), tz);
}

export function useHeaderData() {
  const state = useGame((s) => s.state);
  const today = useToday();
  return useMemo(
    () => ({
      nickname: state.profile.nickname,
      timeZone: state.profile.timeZone,
      coins: state.coins,
      xp: state.xp,
      streak: displayStreak(state.streak, today),
      progress: levelProgress(state.xp),
    }),
    [state, today],
  );
}
