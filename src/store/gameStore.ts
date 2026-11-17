/**
 * Store Zustand: segura o estado do jogo, delega TODA regra a `applyAction` (domínio puro)
 * e persiste após cada mudança. A interface só lê o estado e chama `dispatch`.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';

import { applyAction, type Action, type GameEvent, type Result } from '@/domain/engine';
import { defaultState } from '@/domain/state';
import type { GameState } from '@/domain/types';

import { consoleLogger, loadState, saveState, type KeyValueStorage, type Logger } from './storage';

export interface GameStore {
  state: GameState;
  hydrated: boolean;
  /** Mensagem amigável de problema ao carregar/salvar (item 26). */
  issue: string | null;
  /** Eventos da última ação (toasts, level-up, baú…). */
  lastEvents: GameEvent[];
  hydrate: () => Promise<void>;
  dispatch: (action: Action) => Result;
  dismissIssue: () => void;
  /** Substitui todo o estado (importar backup) e salva. */
  importState: (state: GameState) => Promise<void>;
  /** Resolve quando todos os salvamentos pendentes terminarem. */
  whenSaved: () => Promise<void>;
}

export interface StoreDeps {
  storage: KeyValueStorage;
  clock?: () => Date;
  newId?: () => string;
  logger?: Logger;
}

let idCounter = 0;
export function defaultNewId(): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const SAVE_FAILED = 'Não foi possível salvar sua última alteração. Tente novamente.';

export function createGameStore(deps: StoreDeps): StoreApi<GameStore> {
  const clock = deps.clock ?? (() => new Date());
  const newId = deps.newId ?? defaultNewId;
  const logger = deps.logger ?? consoleLogger;
  // Salvamentos em fila, para nunca gravar um estado antigo por cima de um novo.
  let saving: Promise<unknown> = Promise.resolve();

  return createStore<GameStore>()((set, get) => {
    const persist = (state: GameState) => {
      saving = saving.then(async () => {
        const ok = await saveState(deps.storage, state, clock(), logger);
        if (!ok) set({ issue: SAVE_FAILED });
      });
      return saving;
    };

    return {
      state: defaultState(clock()),
      hydrated: false,
      issue: null,
      lastEvents: [],

      hydrate: async () => {
        const loaded = await loadState(deps.storage, clock(), logger);
        const synced = applyAction(loaded.state, { type: 'SYNC' }, { now: clock(), newId });
        set({
          state: synced.state,
          hydrated: true,
          issue: loaded.userMessage ?? null,
          lastEvents: synced.events,
        });
        if (loaded.status !== 'ok' || synced.state !== loaded.state) await persist(synced.state);
      },

      dispatch: (action) => {
        const prev = get().state;
        const result = applyAction(prev, action, { now: clock(), newId });
        set({ state: result.state, lastEvents: result.events });
        if (result.state !== prev) void persist(result.state);
        return result;
      },

      dismissIssue: () => set({ issue: null }),

      importState: async (state) => {
        // Aplica a virada de dia no estado importado antes de exibir.
        const synced = applyAction(state, { type: 'SYNC' }, { now: clock(), newId });
        set({ state: synced.state, lastEvents: [] });
        await persist(synced.state);
      },

      whenSaved: () => saving.then(() => undefined),
    };
  });
}
