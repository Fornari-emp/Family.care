/**
 * Reducer central do jogo. Toda regra passa por aqui como função pura:
 * `applyAction(estado, ação, { now, newId })` → `{ state, events, error? }`.
 *
 * - Antes de cada ação, `sync` aplica a virada de dia/semana no fuso do usuário.
 * - Os `events` dizem à interface o que mostrar (toasts, level-up, baú…).
 * - Em caso de erro, nenhuma mudança da ação é aplicada (apenas a virada de dia).
 */
import { newlyUnlocked } from './achievements';
import { chestReward } from './chest';
import {
  addDays,
  dayKey,
  isValidTimeZone,
  mondayOf,
  weekKeyOfDay,
  type DayKey,
  type WeekKey,
} from './dates';
import {
  createCustomGoal,
  evaluateGoal,
  MAX_CUSTOM_GOALS,
  validateGoalInput,
  type GoalError,
  type GoalInput,
} from './goals';
import { getLevel, LEVEL_UP_COINS } from './levels';
import { playerPosition } from './league';
import {
  claimWeekly,
  completeDailyByEvent,
  emptyDaily,
  emptyWeekly,
  type ClaimError,
  type MissionEvent,
} from './missions';
import type { Cents } from './money';
import { hasNegativeBalance } from './portfolio';
import {
  contributionReward,
  DEFAULT_MAX_AMOUNT_CENTS,
  MIN_AMOUNT_CENTS,
  validateAmount,
  validateEntryDay,
  type AmountError,
  type DayError,
  type Reward,
} from './rewards';
import { buyItem, equipItem, getItem, unequipSlot, type ShopError } from './shop';
import { defaultState } from './state';
import { reconcileStreak, registerValidAction } from './streak';
import type {
  CategoryId,
  Entry,
  EntryKind,
  GameState,
  Profile,
  ShopSlot,
  WeeklyMissionId,
} from './types';

export const RESET_CONFIRMATION = 'REINICIAR';
export const MAX_NICKNAME = 20;
const MAX_NOTE = 80;

export interface EntryInput {
  kind: EntryKind;
  amountCents: Cents;
  category: CategoryId;
  day: DayKey;
  note?: string;
}

export type Action =
  | { type: 'SYNC' }
  | { type: 'ADD_ENTRY'; entry: EntryInput; confirmedLarge?: boolean }
  | {
      type: 'EDIT_ENTRY';
      id: string;
      patch: Partial<Omit<EntryInput, 'kind'>>;
      confirmedLarge?: boolean;
    }
  | { type: 'DELETE_ENTRY'; id: string }
  | { type: 'READ_TIP' }
  | { type: 'VISIT'; screen: 'portfolio' | 'league' }
  | { type: 'OPEN_CHEST' }
  | { type: 'CLAIM_WEEKLY'; id: WeeklyMissionId }
  | { type: 'CLAIM_GOAL'; id: string }
  | { type: 'ADD_GOAL'; goal: GoalInput }
  | { type: 'EDIT_GOAL'; id: string; goal: GoalInput }
  | { type: 'DELETE_GOAL'; id: string }
  | { type: 'BUY'; itemId: string }
  | { type: 'EQUIP'; itemId: string }
  | { type: 'UNEQUIP'; slot: ShopSlot }
  | {
      type: 'UPDATE_PROFILE';
      patch: Partial<
        Pick<Profile, 'nickname' | 'timeZone' | 'sound' | 'haptics' | 'reminder' | 'maxAmountCents'>
      >;
    }
  | { type: 'COMPLETE_ONBOARDING'; nickname: string; firstGoal?: GoalInput }
  | { type: 'RESET'; confirmation: string };

export type GameEvent =
  | { type: 'reward'; source: string; xp: number; coins: number }
  | { type: 'levelUp'; from: number; to: number; levels: number; bonusCoins: number }
  | { type: 'achievement'; id: string; title: string }
  | { type: 'missionCompleted'; id: string; title: string; xp: number; coins: number }
  | { type: 'weeklyClaimed'; id: WeeklyMissionId; coins: number }
  | { type: 'goalClaimed'; id: string; coins: number; xp: number }
  | { type: 'streakExtended'; count: number }
  | { type: 'streakFrozen'; days: DayKey[] }
  | { type: 'streakBroken' }
  | { type: 'chestOpened'; coins: number; xp: number }
  | { type: 'entryAdded'; entry: Entry; reward: Reward | null }
  | { type: 'entryUpdated'; entry: Entry }
  | { type: 'entryDeleted'; id: string }
  | { type: 'goalSaved'; id: string }
  | { type: 'goalDeleted'; id: string }
  | { type: 'purchase'; itemId: string; spent: number }
  | { type: 'equipped'; itemId: string | null; slot: ShopSlot }
  | { type: 'leagueWeekClosed'; week: WeekKey; position: number }
  | { type: 'tipRead' }
  | { type: 'profileUpdated' }
  | { type: 'reset' };

export type EngineError =
  | AmountError
  | DayError
  | ClaimError
  | GoalError
  | ShopError
  | 'entry-not-found'
  | 'negative-balance'
  | 'invalid-note'
  | 'invalid-category'
  | 'chest-already-opened'
  | 'invalid-confirmation'
  | 'invalid-nickname'
  | 'invalid-timezone'
  | 'invalid-profile';

export interface Ctx {
  now: Date;
  newId: () => string;
}

export interface Result {
  state: GameState;
  events: GameEvent[];
  error?: EngineError;
}

type Step = { state: GameState } | { error: EngineError };

// ---------------------------------------------------------------------------
// Utilitários internos
// ---------------------------------------------------------------------------

export function todayOf(state: GameState, now: Date): DayKey {
  return dayKey(now, state.profile.timeZone);
}

function previousWeek(today: DayKey): WeekKey {
  return weekKeyOfDay(addDays(mondayOf(today), -1));
}

/** Soma XP/moedas e paga +100 moedas por CADA nível alcançado, na hora (bug 10). */
function grant(
  state: GameState,
  xp: number,
  coins: number,
  source: string,
  events: GameEvent[],
): GameState {
  if (xp === 0 && coins === 0) return state;
  const from = getLevel(state.xp);
  const to = getLevel(state.xp + xp);
  const levels = to - from;
  const bonusCoins = levels * LEVEL_UP_COINS;
  events.push({ type: 'reward', source, xp, coins });
  if (levels > 0) events.push({ type: 'levelUp', from, to, levels, bonusCoins });
  return {
    ...state,
    xp: state.xp + xp,
    coins: state.coins + coins + bonusCoins,
    weekly: { ...state.weekly, xp: state.weekly.xp + xp },
  };
}

function completeMissions(state: GameState, event: MissionEvent, events: GameEvent[]): GameState {
  const { daily, completed } = completeDailyByEvent(state.daily, event);
  let s: GameState = { ...state, daily };
  for (const m of completed) {
    events.push({ type: 'missionCompleted', id: m.id, title: m.title, xp: m.xp, coins: m.coins });
    s = grant(s, m.xp, m.coins, m.title, events);
  }
  return s;
}

/** Ação válida para a sequência (aporte de hoje ou dica lida). */
function validAction(state: GameState, today: DayKey, events: GameEvent[]): GameState {
  const r = registerValidAction(state.streak, today);
  if (r.extended) events.push({ type: 'streakExtended', count: r.streak.count });
  return {
    ...state,
    streak: r.streak,
    weekly: { ...state.weekly, bestStreak: Math.max(state.weekly.bestStreak, r.streak.count) },
  };
}

/**
 * Virada de dia/semana no fuso do usuário. Relógio voltando para trás não reabre
 * baú nem missões (só avançamos).
 */
export function sync(state: GameState, now: Date, events: GameEvent[] = []): GameState {
  const today = todayOf(state, now);
  const week = weekKeyOfDay(today);
  let s = state;

  if (today > s.daily.day) s = { ...s, daily: emptyDaily(today) };

  const rec = reconcileStreak(s.streak, today);
  if (rec.frozenUsed.length > 0) events.push({ type: 'streakFrozen', days: rec.frozenUsed });
  if (rec.broken) events.push({ type: 'streakBroken' });
  if (rec.streak !== s.streak) s = { ...s, streak: rec.streak };

  if (week > s.weekly.week) {
    const closed = s.weekly;
    const position = playerPosition(closed.week, 1, closed.xp);
    events.push({ type: 'leagueWeekClosed', week: closed.week, position });
    if (position <= 3 && closed.xp > 0) {
      s = { ...s, stats: { ...s.stats, leaguePodiums: s.stats.leaguePodiums + 1 } };
    }
    s = { ...s, weekly: emptyWeekly(week) };
  }
  return s;
}

// ---------------------------------------------------------------------------
// Aportes e resgates
// ---------------------------------------------------------------------------

export interface RewardContext {
  rewardedToday: number;
  xpToday: number;
  coinsToday: number;
  isFirstOfWeek: boolean;
  previousWeeksRun: number;
  streakDays: number;
}

/** Contexto de recompensa para um aporte registrado agora (usado na prévia e no registro). */
export function rewardContext(state: GameState, today: DayKey): RewardContext {
  const prev = previousWeek(today);
  const week = weekKeyOfDay(today);
  const { weekRun } = state;
  const previousWeeksRun =
    weekRun.lastWeek === week ? weekRun.count - 1 : weekRun.lastWeek === prev ? weekRun.count : 0;
  const after = registerValidAction(state.streak, today).streak.count;
  return {
    rewardedToday: state.daily.rewardedContributions,
    xpToday: state.daily.xpFromContributions,
    coinsToday: state.daily.coinsFromContributions,
    isFirstOfWeek: state.weekly.contributionDays.length === 0,
    previousWeeksRun,
    streakDays: after,
  };
}

/**
 * Prévia reativa da recompensa (bug 9). Não altera o estado.
 * Retorna o erro de validação, se houver, para o formulário mostrar.
 */
export function previewContribution(
  state: GameState,
  amountCents: Cents,
  day: DayKey,
  now: Date,
): { reward: Reward; error: AmountError | DayError | null } {
  const s = sync(state, now);
  const today = todayOf(s, now);
  const reward = contributionReward({
    amountCents,
    day,
    today,
    ...rewardContext(s, today),
  });
  const error =
    validateEntryDay(day, today) ?? validateAmount(amountCents, s.profile.maxAmountCents, true);
  return { reward, error };
}

function validateNote(note: string | undefined): boolean {
  return note === undefined || note.trim().length <= MAX_NOTE;
}

function addEntry(
  state: GameState,
  input: EntryInput,
  confirmedLarge: boolean,
  ctx: Ctx,
  events: GameEvent[],
): Step {
  const today = todayOf(state, ctx.now);
  const amountError = validateAmount(
    input.amountCents,
    state.profile.maxAmountCents,
    confirmedLarge,
  );
  if (amountError) return { error: amountError };
  const dayError = validateEntryDay(input.day, today);
  if (dayError) return { error: dayError };
  if (!validateNote(input.note)) return { error: 'invalid-note' };

  const note = input.note?.trim();
  const entry: Entry = {
    id: ctx.newId(),
    kind: input.kind,
    amountCents: input.amountCents,
    category: input.category,
    day: input.day,
    createdAt: ctx.now.toISOString(),
    ...(note ? { note } : {}),
  };
  const entries = [...state.entries, entry];
  if (input.kind === 'withdrawal') {
    if (hasNegativeBalance(entries)) return { error: 'negative-balance' };
    events.push({ type: 'entryAdded', entry, reward: null });
    return { state: { ...state, entries } };
  }

  let s: GameState = {
    ...state,
    entries,
    stats: { ...state.stats, contributionsCount: state.stats.contributionsCount + 1 },
  };

  const reward = contributionReward({
    amountCents: input.amountCents,
    day: input.day,
    today,
    ...rewardContext(s, today),
  });
  events.push({ type: 'entryAdded', entry, reward });
  // Aporte com data passada: entra no patrimônio, mas não rende XP, sequência nem missão.
  if (input.day !== today) return { state: s };

  const week = weekKeyOfDay(today);
  if (s.weekRun.lastWeek !== week) {
    const count = s.weekRun.lastWeek === previousWeek(today) ? s.weekRun.count + 1 : 1;
    s = { ...s, weekRun: { count, best: Math.max(s.weekRun.best, count), lastWeek: week } };
  }
  s = {
    ...s,
    daily: {
      ...s.daily,
      rewardedContributions: s.daily.rewardedContributions + 1,
      xpFromContributions: s.daily.xpFromContributions + reward.xp,
      coinsFromContributions: s.daily.coinsFromContributions + reward.coins,
    },
    weekly: s.weekly.contributionDays.includes(today)
      ? s.weekly
      : { ...s.weekly, contributionDays: [...s.weekly.contributionDays, today] },
  };
  s = validAction(s, today, events);
  s = grant(s, reward.xp, reward.coins, 'Aporte registrado', events);
  s = completeMissions(s, 'contribution', events);
  return { state: s };
}

function editEntry(
  state: GameState,
  id: string,
  patch: Partial<Omit<EntryInput, 'kind'>>,
  confirmedLarge: boolean,
  ctx: Ctx,
  events: GameEvent[],
): Step {
  const current = state.entries.find((e) => e.id === id);
  if (!current) return { error: 'entry-not-found' };
  const today = todayOf(state, ctx.now);

  if (patch.amountCents !== undefined && patch.amountCents !== current.amountCents) {
    const err = validateAmount(patch.amountCents, state.profile.maxAmountCents, confirmedLarge);
    if (err) return { error: err };
  }
  if (patch.day !== undefined && patch.day !== current.day) {
    const err = validateEntryDay(patch.day, today);
    if (err) return { error: err };
  }
  if (!validateNote(patch.note)) return { error: 'invalid-note' };

  const note = patch.note === undefined ? current.note : patch.note.trim() || undefined;
  const updated: Entry = {
    id: current.id,
    kind: current.kind,
    amountCents: patch.amountCents ?? current.amountCents,
    category: patch.category ?? current.category,
    day: patch.day ?? current.day,
    createdAt: current.createdAt,
    updatedAt: ctx.now.toISOString(),
    ...(note ? { note } : {}),
  };
  const entries = state.entries.map((e) => (e.id === id ? updated : e));
  if (hasNegativeBalance(entries)) return { error: 'negative-balance' };
  // XP já ganho não é retirado; metas são reavaliadas a partir de `entries`.
  events.push({ type: 'entryUpdated', entry: updated });
  return { state: { ...state, entries } };
}

function deleteEntry(state: GameState, id: string, events: GameEvent[]): Step {
  if (!state.entries.some((e) => e.id === id)) return { error: 'entry-not-found' };
  const entries = state.entries.filter((e) => e.id !== id);
  if (hasNegativeBalance(entries)) return { error: 'negative-balance' };
  events.push({ type: 'entryDeleted', id });
  return { state: { ...state, entries } };
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

function cleanNickname(raw: string): string | null {
  const n = raw.trim().replace(/\s+/g, ' ');
  return n.length >= 1 && n.length <= MAX_NICKNAME ? n : null;
}

function updateProfile(
  state: GameState,
  patch: Extract<Action, { type: 'UPDATE_PROFILE' }>['patch'],
  events: GameEvent[],
): Step {
  const profile: Profile = { ...state.profile };
  if (patch.nickname !== undefined) {
    const n = cleanNickname(patch.nickname);
    if (!n) return { error: 'invalid-nickname' };
    profile.nickname = n;
  }
  if (patch.timeZone !== undefined) {
    if (!isValidTimeZone(patch.timeZone)) return { error: 'invalid-timezone' };
    profile.timeZone = patch.timeZone;
  }
  if (patch.sound !== undefined) profile.sound = patch.sound;
  if (patch.haptics !== undefined) profile.haptics = patch.haptics;
  if (patch.reminder !== undefined) {
    const { hour, minute } = patch.reminder;
    const ok =
      Number.isInteger(hour) &&
      hour >= 0 &&
      hour <= 23 &&
      Number.isInteger(minute) &&
      minute >= 0 &&
      minute <= 59;
    if (!ok) return { error: 'invalid-profile' };
    profile.reminder = { ...patch.reminder };
  }
  if (patch.maxAmountCents !== undefined) {
    const m = patch.maxAmountCents;
    if (!Number.isSafeInteger(m) || m < MIN_AMOUNT_CENTS || m > DEFAULT_MAX_AMOUNT_CENTS * 10) {
      return { error: 'invalid-profile' };
    }
    profile.maxAmountCents = m;
  }
  events.push({ type: 'profileUpdated' });
  return { state: { ...state, profile } };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function handle(state: GameState, action: Action, ctx: Ctx, events: GameEvent[]): Step {
  const today = todayOf(state, ctx.now);
  switch (action.type) {
    case 'SYNC':
      return { state };

    case 'ADD_ENTRY':
      return addEntry(state, action.entry, action.confirmedLarge ?? false, ctx, events);

    case 'EDIT_ENTRY':
      return editEntry(state, action.id, action.patch, action.confirmedLarge ?? false, ctx, events);

    case 'DELETE_ENTRY':
      return deleteEntry(state, action.id, events);

    case 'READ_TIP': {
      if (state.daily.tipRead) return { state };
      let s: GameState = {
        ...state,
        daily: { ...state.daily, tipRead: true },
        stats: { ...state.stats, tipsRead: state.stats.tipsRead + 1 },
      };
      events.push({ type: 'tipRead' });
      s = validAction(s, today, events);
      s = completeMissions(s, 'tip-read', events);
      return { state: s };
    }

    case 'VISIT':
      return {
        state: completeMissions(
          state,
          action.screen === 'portfolio' ? 'portfolio-visit' : 'league-visit',
          events,
        ),
      };

    case 'OPEN_CHEST': {
      if (state.daily.chestOpened) return { error: 'chest-already-opened' };
      const { coins, xp } = chestReward(today);
      events.push({ type: 'chestOpened', coins, xp });
      const s: GameState = {
        ...state,
        daily: { ...state.daily, chestOpened: true },
        stats: { ...state.stats, chestsOpened: state.stats.chestsOpened + 1 },
      };
      return { state: grant(s, xp, coins, 'Baú diário', events) };
    }

    case 'CLAIM_WEEKLY': {
      const r = claimWeekly(state.weekly, action.id);
      if ('error' in r) return r;
      events.push({ type: 'weeklyClaimed', id: action.id, coins: r.coins });
      return { state: grant({ ...state, weekly: r.weekly }, 0, r.coins, 'Missão semanal', events) };
    }

    case 'CLAIM_GOAL': {
      const goal = state.goals.find((g) => g.id === action.id);
      if (!goal) return { error: 'not-found' };
      if (goal.claimed) return { error: 'already-claimed' };
      if (!evaluateGoal(goal, state.entries, today).reached) return { error: 'not-reached' };
      const goals = state.goals.map((g) => (g.id === goal.id ? { ...g, claimed: true } : g));
      events.push({ type: 'goalClaimed', id: goal.id, coins: goal.rewardCoins, xp: goal.rewardXp });
      return {
        state: grant(
          { ...state, goals },
          goal.rewardXp,
          goal.rewardCoins,
          'Meta concluída',
          events,
        ),
      };
    }

    case 'ADD_GOAL': {
      const err = validateGoalInput(action.goal, today);
      if (err) return { error: err };
      if (state.goals.filter((g) => g.kind === 'custom').length >= MAX_CUSTOM_GOALS) {
        return { error: 'too-many-goals' };
      }
      const goal = createCustomGoal(ctx.newId(), action.goal, ctx.now.toISOString());
      events.push({ type: 'goalSaved', id: goal.id });
      return { state: { ...state, goals: [...state.goals, goal] } };
    }

    case 'EDIT_GOAL': {
      const goal = state.goals.find((g) => g.id === action.id);
      if (!goal) return { error: 'not-found' };
      if (goal.kind !== 'custom') return { error: 'not-custom' };
      if (goal.claimed) return { error: 'already-claimed' };
      const err = validateGoalInput(action.goal, today);
      if (err) return { error: err };
      const edited = createCustomGoal(goal.id, action.goal, goal.createdAt);
      events.push({ type: 'goalSaved', id: goal.id });
      return {
        state: { ...state, goals: state.goals.map((g) => (g.id === goal.id ? edited : g)) },
      };
    }

    case 'DELETE_GOAL': {
      const goal = state.goals.find((g) => g.id === action.id);
      if (!goal) return { error: 'not-found' };
      if (goal.kind !== 'custom') return { error: 'not-custom' };
      events.push({ type: 'goalDeleted', id: goal.id });
      return { state: { ...state, goals: state.goals.filter((g) => g.id !== goal.id) } };
    }

    case 'BUY': {
      const r = buyItem(state, action.itemId);
      if ('error' in r) return r;
      events.push({ type: 'purchase', itemId: action.itemId, spent: r.spent });
      return {
        state: { ...r.state, stats: { ...r.state.stats, purchases: r.state.stats.purchases + 1 } },
      };
    }

    case 'EQUIP': {
      const r = equipItem(state, action.itemId);
      if ('error' in r) return r;
      const slot = getItem(action.itemId)?.slot ?? 'suit';
      events.push({ type: 'equipped', itemId: action.itemId, slot });
      return r;
    }

    case 'UNEQUIP': {
      const r = unequipSlot(state, action.slot);
      if ('error' in r) return r;
      events.push({ type: 'equipped', itemId: null, slot: action.slot });
      return r;
    }

    case 'UPDATE_PROFILE':
      return updateProfile(state, action.patch, events);

    case 'COMPLETE_ONBOARDING': {
      const nickname = cleanNickname(action.nickname);
      if (!nickname) return { error: 'invalid-nickname' };
      let s: GameState = { ...state, profile: { ...state.profile, nickname, onboarded: true } };
      if (action.firstGoal) {
        const r = handle(s, { type: 'ADD_GOAL', goal: action.firstGoal }, ctx, events);
        if ('error' in r) return r;
        s = r.state;
      }
      return { state: s };
    }

    case 'RESET': {
      if (action.confirmation.trim() !== RESET_CONFIRMATION)
        return { error: 'invalid-confirmation' };
      events.push({ type: 'reset' });
      // Reinicia o progresso; preferências do perfil são mantidas.
      return { state: defaultState(ctx.now, state.profile) };
    }
  }
}

/** Ponto de entrada único das regras do jogo. */
export function applyAction(state: GameState, action: Action, ctx: Ctx): Result {
  const events: GameEvent[] = [];
  const synced = sync(state, ctx.now, events);
  const syncEventCount = events.length;
  const step = handle(synced, action, ctx, events);
  if ('error' in step) {
    // Descarta eventos da ação que falhou, mantém os da virada de dia.
    return { state: synced, events: events.slice(0, syncEventCount), error: step.error };
  }
  let s = step.state;
  if (action.type !== 'RESET') {
    const unlocked = newlyUnlocked(s);
    if (unlocked.length > 0) {
      s = { ...s, achievements: [...s.achievements, ...unlocked.map((a) => a.id)] };
      for (const a of unlocked) events.push({ type: 'achievement', id: a.id, title: a.title });
    }
  }
  return { state: s, events };
}
