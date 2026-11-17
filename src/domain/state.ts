import { dayKey, DEFAULT_TIME_ZONE, weekKeyOfDay } from './dates';
import { defaultGoals } from './goals';
import { emptyDaily, emptyWeekly } from './missions';
import { DEFAULT_MAX_AMOUNT_CENTS } from './rewards';
import { defaultEquipped, DEFAULT_SUIT } from './shop';
import { emptyStreak } from './streak';
import type { GameState, Profile } from './types';

export const STARTING_COINS = 150;
/** `updatedAt` de um estado sem nenhuma ação do usuário (perde para qualquer outro). */
export const PRISTINE_UPDATED_AT = '1970-01-01T00:00:00.000Z';

export function defaultProfile(timeZone: string = DEFAULT_TIME_ZONE): Profile {
  return {
    nickname: 'Investidor',
    onboarded: false,
    timeZone,
    sound: true,
    haptics: true,
    reminder: { enabled: false, hour: 20, minute: 0 },
    maxAmountCents: DEFAULT_MAX_AMOUNT_CENTS,
    publicLeague: false,
  };
}

/** Estado inicial. `profile` permite preservar preferências num "reiniciar progresso". */
export function defaultState(now: Date, profile: Profile = defaultProfile()): GameState {
  const today = dayKey(now, profile.timeZone);
  return {
    profile,
    xp: 0,
    coins: STARTING_COINS,
    entries: [],
    streak: emptyStreak(),
    daily: emptyDaily(today),
    weekly: emptyWeekly(weekKeyOfDay(today)),
    weekRun: { count: 0, best: 0, lastWeek: null },
    goals: defaultGoals(now.toISOString()),
    achievements: [],
    ownedItems: [DEFAULT_SUIT],
    equipped: defaultEquipped(),
    stats: { contributionsCount: 0, tipsRead: 0, purchases: 0, chestsOpened: 0, leaguePodiums: 0 },
    tombstones: [],
    updatedAt: PRISTINE_UPDATED_AT,
  };
}
