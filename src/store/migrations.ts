/**
 * Migrações versionadas do estado persistido.
 *
 * - v0: formato do protótipo HTML (`window.storage`, valores em reais, categorias por nome).
 * - v1: formato atual (centavos, ids de categoria, sequência por ação válida…).
 *
 * Cada migração recebe o `data` da versão N e devolve o da versão N+1.
 */
import { categoryFromLegacyName } from '@/domain/categories';
import { dayKey, isValidDayKey } from '@/domain/dates';
import { reaisToCents } from '@/domain/money';
import { getItem } from '@/domain/shop';
import { defaultState } from '@/domain/state';
import type { Entry, GameState, ShopSlot } from '@/domain/types';

import { CURRENT_SCHEMA_VERSION } from './schema';

export type MigrationError = 'unknown-format' | 'future-version';

type Migration = (data: unknown, now: Date) => unknown;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

const LEGACY_GOALS: Record<string, string> = { g1: 'g-1k', g2: 'g-5k', g3: 'g-10k' };
const LEGACY_ACHIEVEMENTS: Record<string, string> = {
  a1: 'first-contribution',
  a2: 'streak-7',
  a3: 'level-7',
  a4: 'total-1k',
  a5: 'total-10k',
  a6: 'level-15',
};

/** Protótipo → v1. Mantém o que é confiável; o resto recomeça limpo. */
function v0ToV1(data: unknown, now: Date): GameState {
  const old = isObj(data) ? data : {};
  const base = defaultState(now);
  const today = dayKey(now, base.profile.timeZone);

  const entries: Entry[] = (Array.isArray(old.investments) ? old.investments : [])
    .filter(isObj)
    .map((iv, i): Entry | null => {
      const cents = typeof iv.amount === 'number' ? reaisToCents(iv.amount) : 0;
      const day = str(iv.date);
      if (cents < 1 || !isValidDayKey(day) || day > today) return null;
      return {
        id: `legacy-${str(iv.id, String(i)) || i}`,
        kind: 'contribution',
        amountCents: cents,
        category: categoryFromLegacyName(str(iv.category)),
        day,
        createdAt: `${day}T12:00:00.000Z`,
      };
    })
    .filter((e): e is Entry => e !== null);

  const owned = new Set(base.ownedItems);
  if (Array.isArray(old.ownedItems)) {
    for (const id of old.ownedItems) if (typeof id === 'string' && getItem(id)) owned.add(id);
  }

  const equipped = { ...base.equipped };
  if (isObj(old.equipped)) {
    for (const slot of ['suit', 'accessory', 'aura', 'pet', 'frame'] as ShopSlot[]) {
      const id = old.equipped[slot];
      if (typeof id === 'string' && owned.has(id) && getItem(id)?.slot === slot) {
        (equipped as Record<ShopSlot, string | null>)[slot] = id;
      }
    }
  }

  const claimedGoals = new Set(
    (Array.isArray(old.goals) ? old.goals : [])
      .filter(isObj)
      .filter((g) => g.claimed === true)
      .map((g) => LEGACY_GOALS[str(g.id)])
      .filter(Boolean),
  );
  const achievements = (Array.isArray(old.achievements) ? old.achievements : [])
    .filter(isObj)
    .filter((a) => a.unlocked === true)
    .map((a) => LEGACY_ACHIEVEMENTS[str(a.id)])
    .filter((id): id is string => Boolean(id));

  const nickname = str(old.nickname).trim().slice(0, 20);
  return {
    ...base,
    profile: {
      ...base.profile,
      nickname: nickname || base.profile.nickname,
      onboarded: true,
      sound: old.sound !== false,
      haptics: old.haptics !== false,
    },
    xp: num(old.xp),
    coins: num(old.coins, base.coins),
    entries,
    // A sequência antiga contava aberturas do app; guardamos só como recorde.
    streak: { ...base.streak, best: num(old.streak) },
    goals: base.goals.map((g) => (claimedGoals.has(g.id) ? { ...g, claimed: true } : g)),
    achievements,
    ownedItems: [...owned],
    equipped,
    stats: { ...base.stats, contributionsCount: entries.length },
  };
}

/** `MIGRATIONS[n]` leva da versão n para n+1. */
const MIGRATIONS: Record<number, Migration> = {
  0: v0ToV1,
};

function looksLikePrototype(raw: Record<string, unknown>): boolean {
  return Array.isArray(raw.investments) && 'xp' in raw;
}

/**
 * Detecta a versão do JSON bruto e aplica as migrações até a atual.
 * Não valida o resultado (isso é feito pelo schema em `storage.ts`).
 */
export function migrate(
  raw: unknown,
  now: Date,
): { data: unknown; fromVersion: number } | { error: MigrationError } {
  if (!isObj(raw)) return { error: 'unknown-format' };

  let version: number;
  let data: unknown;
  if (typeof raw.schemaVersion === 'number' && 'data' in raw) {
    version = raw.schemaVersion;
    data = raw.data;
  } else if (looksLikePrototype(raw)) {
    version = 0;
    data = raw;
  } else {
    return { error: 'unknown-format' };
  }

  if (version > CURRENT_SCHEMA_VERSION) return { error: 'future-version' };
  const fromVersion = version;
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { error: 'unknown-format' };
    data = step(data, now);
    version += 1;
  }
  return { data, fromVersion };
}
