import { applyAction, type Action, type EntryInput, type Result } from '@/domain/engine';
import { defaultState } from '@/domain/state';
import type { CategoryId, GameState } from '@/domain/types';

/** Instante a partir do horário de São Paulo (UTC-3). */
export const sp = (iso: string) => new Date(`${iso}-03:00`);

let counter = 0;
export const ctxAt = (iso: string) => ({ now: sp(iso), newId: () => `id-${++counter}` });

export function fresh(iso = '2026-11-17T10:00:00'): GameState {
  return defaultState(sp(iso));
}

export function act(state: GameState, action: Action, iso: string): Result {
  return applyAction(state, action, ctxAt(iso));
}

/** Aplica a ação e falha o teste se houver erro. */
export function ok(state: GameState, action: Action, iso: string): Result {
  const r = act(state, action, iso);
  if (r.error) throw new Error(`Ação ${action.type} falhou: ${r.error}`);
  return r;
}

export function contribution(
  amountCents: number,
  day: string,
  category: CategoryId = 'cdb',
  extra: Partial<EntryInput> = {},
): Action {
  return {
    type: 'ADD_ENTRY',
    entry: { kind: 'contribution', amountCents, category, day, ...extra },
  };
}

export function withdrawal(amountCents: number, day: string, category: CategoryId = 'cdb'): Action {
  return { type: 'ADD_ENTRY', entry: { kind: 'withdrawal', amountCents, category, day } };
}
