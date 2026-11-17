/**
 * Sincronização com a nuvem (Fase 4). O app continua offline-first: o estado local é a
 * fonte do dia a dia e a nuvem é mesclada a ele.
 *
 * Fluxo de `syncNow`:
 * 1. Baixa o estado remoto (com revisão) e valida/migra igual a um backup.
 * 2. Primeiro sync neste aparelho com dados dos dois lados → pede a escolha do usuário.
 * 3. Senão, mescla (regras em `domain/merge.ts`), aplica localmente e envia se mudou.
 * 4. Se outro aparelho salvou no meio (conflito de revisão), repete (até 3 vezes).
 */
import type { StoreApi } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { isPristine, mergeStates } from '@/domain/merge';
import type { GameState } from '@/domain/types';
import type { GameStore } from '@/store/gameStore';
import { CURRENT_SCHEMA_VERSION } from '@/store/schema';
import { parseSaved, type KeyValueStorage } from '@/store/storage';

import {
  CloudError,
  cloudMessage,
  EMAIL_RE,
  type CloudApi,
  type CloudUser,
  type LeagueStanding,
} from './api';

export const META_KEY = 'invest-level:cloud-meta';
export const AUTO_SYNC_DELAY_MS = 4000;
const MAX_ATTEMPTS = 3;

export type CloudStatus = 'signed-out' | 'idle' | 'syncing' | 'needs-choice' | 'error';
export type FirstSyncChoice = 'use-cloud' | 'use-device' | 'merge';

export interface StateSummary {
  nickname: string;
  entries: number;
  xp: number;
  coins: number;
  updatedAt: string;
}

export interface CloudState {
  status: CloudStatus;
  user: CloudUser | null;
  lastSyncedAt: string | null;
  error: string | null;
  choice: { device: StateSummary; cloud: StateSummary } | null;
  league: { week: string; standings: LeagueStanding[] } | null;
}

interface Meta {
  userId: string;
  revision: number;
  lastSyncedAt: string;
}

export function summarize(s: GameState): StateSummary {
  return {
    nickname: s.profile.nickname,
    entries: s.entries.length,
    xp: s.xp,
    coins: s.coins,
    updatedAt: s.updatedAt,
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface CloudDeps {
  api: CloudApi;
  game: StoreApi<GameStore>;
  storage: KeyValueStorage;
  clock?: () => Date;
  autoSyncDelayMs?: number;
}

export function createCloudService(deps: CloudDeps) {
  const { api, game, storage } = deps;
  const clock = deps.clock ?? (() => new Date());
  const store = createStore<CloudState>()(() => ({
    status: 'signed-out',
    user: null,
    lastSyncedAt: null,
    error: null,
    choice: null,
    league: null,
  }));

  let inFlight: Promise<void> | null = null;
  let pendingRemote: { revision: number; state: GameState } | null = null;
  let applying = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function readMeta(): Promise<Meta | null> {
    try {
      const raw = await storage.getItem(META_KEY);
      return raw ? (JSON.parse(raw) as Meta) : null;
    } catch {
      return null;
    }
  }
  async function writeMeta(meta: Meta | null): Promise<void> {
    await storage.setItem(META_KEY, meta ? JSON.stringify(meta) : '');
  }

  function parseRemote(remote: { schemaVersion: number; state: unknown }): GameState {
    const parsed = parseSaved(
      JSON.stringify({ schemaVersion: remote.schemaVersion, data: remote.state }),
      clock(),
    );
    if (!parsed.ok) {
      throw new CloudError(
        'unknown',
        parsed.reason === 'future-version'
          ? 'Os dados da nuvem são de uma versão mais nova do app. Atualize o app.'
          : 'Os dados da nuvem estão inválidos.',
      );
    }
    return parsed.state;
  }

  /** Aplica no aparelho sem perder ações feitas enquanto sincronizava. */
  async function applyLocal(next: GameState, snapshot: GameState): Promise<GameState> {
    const current = game.getState().state;
    const target = current === snapshot ? next : mergeStates(current, next);
    if (same(target, current)) return current;
    applying = true;
    try {
      await game.getState().importState(target);
    } finally {
      applying = false;
    }
    return game.getState().state;
  }

  async function push(expected: number, state: GameState, user: CloudUser): Promise<number> {
    const revision = await api.pushState(expected, CURRENT_SCHEMA_VERSION, state);
    const now = clock().toISOString();
    await writeMeta({ userId: user.id, revision, lastSyncedAt: now });
    store.setState({ lastSyncedAt: now });
    return revision;
  }

  async function runSync(user: CloudUser): Promise<void> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const meta = await readMeta();
      const firstOnDevice = !meta || meta.userId !== user.id;
      const local = game.getState().state;
      const remoteRaw = await api.pullState();

      try {
        if (!remoteRaw) {
          await push(0, local, user);
          return;
        }
        const remote = parseRemote(remoteRaw);

        if (firstOnDevice && !isPristine(local) && !isPristine(remote)) {
          pendingRemote = { revision: remoteRaw.revision, state: remote };
          store.setState({
            status: 'needs-choice',
            choice: { device: summarize(local), cloud: summarize(remote) },
          });
          return;
        }

        const merged = firstOnDevice && isPristine(local) ? remote : mergeStates(local, remote);
        const applied = await applyLocal(merged, local);
        if (same(applied, remote)) {
          const now = clock().toISOString();
          await writeMeta({ userId: user.id, revision: remoteRaw.revision, lastSyncedAt: now });
          store.setState({ lastSyncedAt: now });
        } else {
          await push(remoteRaw.revision, applied, user);
        }
        return;
      } catch (e) {
        if (e instanceof CloudError && e.kind === 'conflict' && attempt < MAX_ATTEMPTS) continue;
        throw e;
      }
    }
  }

  async function syncNow(): Promise<void> {
    const user = store.getState().user;
    if (!user || store.getState().status === 'needs-choice') return;
    if (inFlight) return inFlight;
    store.setState({ status: 'syncing', error: null });
    inFlight = (async () => {
      try {
        await runSync(user);
        if (store.getState().status === 'syncing') store.setState({ status: 'idle' });
        await syncLeague();
      } catch (e) {
        console.warn('[invest-level] falha ao sincronizar', e);
        store.setState({
          status: 'error',
          error: e instanceof CloudError && e.message !== e.kind ? e.message : cloudMessage(e),
        });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  /** Primeiro login com dados nos dois lados: o usuário decide. */
  async function resolveChoice(choice: FirstSyncChoice): Promise<void> {
    const user = store.getState().user;
    const remote = pendingRemote;
    if (!user || !remote) return;
    store.setState({ status: 'syncing', choice: null, error: null });
    try {
      const local = game.getState().state;
      if (choice === 'use-cloud') {
        await applyLocal(remote.state, local);
        const now = clock().toISOString();
        await writeMeta({ userId: user.id, revision: remote.revision, lastSyncedAt: now });
        store.setState({ lastSyncedAt: now });
      } else {
        const next = choice === 'merge' ? mergeStates(local, remote.state) : local;
        const applied = await applyLocal(next, local);
        await push(remote.revision, applied, user);
      }
      pendingRemote = null;
      store.setState({ status: 'idle' });
      await syncLeague();
    } catch (e) {
      pendingRemote = null;
      store.setState({ status: 'error', error: cloudMessage(e) });
    }
  }

  async function syncLeague(): Promise<void> {
    const user = store.getState().user;
    const s = game.getState().state;
    if (!user || !s.profile.publicLeague) {
      store.setState({ league: null });
      return;
    }
    const week = s.weekly.week;
    try {
      await api.joinLeague(week, s.profile.nickname);
      await api.submitLeagueXp(week, s.weekly.xp, s.profile.nickname);
      store.setState({ league: { week, standings: await api.leagueStandings(week) } });
    } catch (e) {
      console.warn('[invest-level] falha na liga', e);
    }
  }

  async function setUser(user: CloudUser | null): Promise<void> {
    const prev = store.getState().user;
    if (prev?.id === user?.id) return;
    store.setState({
      user,
      status: user ? 'idle' : 'signed-out',
      error: null,
      choice: null,
      league: null,
    });
    if (user) await syncNow();
  }

  return {
    store,
    syncNow,
    resolveChoice,
    syncLeague,

    async init(): Promise<() => void> {
      const unsubAuth = api.onUserChange((u) => void setUser(u));
      // Sincroniza alguns segundos depois de cada mudança feita pelo usuário.
      const unsubGame = game.subscribe((s, prev) => {
        if (applying || s.state === prev.state || !store.getState().user) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void syncNow(), deps.autoSyncDelayMs ?? AUTO_SYNC_DELAY_MS);
      });
      try {
        await setUser(await api.getUser());
      } catch (e) {
        console.warn('[invest-level] falha ao ler sessão', e);
      }
      return () => {
        unsubAuth();
        unsubGame();
        if (timer) clearTimeout(timer);
      };
    },

    async sendCode(email: string): Promise<void> {
      const clean = email.trim().toLowerCase();
      if (!EMAIL_RE.test(clean)) throw new CloudError('invalid-email');
      await api.sendCode(clean);
    },

    async verifyCode(email: string, code: string): Promise<void> {
      const digits = code.replace(/\D/g, '');
      if (digits.length < 6) throw new CloudError('invalid-code');
      const user = await api.verifyCode(email.trim().toLowerCase(), digits);
      await setUser(user);
    },

    /** Sai da conta. Os dados continuam no aparelho. */
    async signOut(): Promise<void> {
      await api.signOut();
      await writeMeta(null);
      pendingRemote = null;
      await setUser(null);
    },

    /** Liga/desliga a participação na liga com outras pessoas. */
    async setPublicLeague(enabled: boolean): Promise<void> {
      const s = game.getState().state;
      if (!enabled && store.getState().user) {
        try {
          await api.leaveLeague(s.weekly.week);
        } catch (e) {
          console.warn('[invest-level] falha ao sair da liga', e);
        }
      }
      game.getState().dispatch({ type: 'UPDATE_PROFILE', patch: { publicLeague: enabled } });
      await syncLeague();
    },

    /** Exclui a conta e os dados da nuvem. Os dados do aparelho são mantidos. */
    async deleteAccount(): Promise<void> {
      await api.deleteAccount();
      await api.signOut().catch(() => undefined);
      await writeMeta(null);
      pendingRemote = null;
      await setUser(null);
    },
  };
}

export type CloudService = ReturnType<typeof createCloudService>;
