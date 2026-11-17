/**
 * Mesclagem de estados entre aparelhos (sincronização da Fase 4). Função pura.
 *
 * Regras:
 * - Registros (aportes/resgates) e metas pessoais: união por `id`; se existem nos dois,
 *   vence a edição mais recente. Lápides (exclusões) removem o item se forem mais novas
 *   que a última edição dele — assim um registro apagado não "ressuscita".
 * - Progresso do jogo (XP, moedas, sequência, missões, loja, perfil…): vence o aparelho
 *   com a ação mais recente (`updatedAt`). Não somamos XP/moedas dos dois lados para não
 *   criar moedas do nada (gastar num aparelho e ganhar no outro).
 * - O status "resgatada" das metas acompanha o progresso vencedor (a recompensa foi paga
 *   nele). Conquistas são unidas (não pagam recompensa).
 */
import type { Entry, GameState, Goal, Tombstone } from './types';

const tsKey = (t: Pick<Tombstone, 'kind' | 'id'>) => `${t.kind}:${t.id}`;

function mergeTombstones(a: readonly Tombstone[], b: readonly Tombstone[]): Tombstone[] {
  const map = new Map<string, Tombstone>();
  for (const t of [...a, ...b]) {
    const prev = map.get(tsKey(t));
    if (!prev || t.at > prev.at) map.set(tsKey(t), t);
  }
  return [...map.values()].sort((x, y) => x.at.localeCompare(y.at)).slice(-2000);
}

const entryStamp = (e: Entry) => e.updatedAt ?? e.createdAt;
const goalStamp = (g: Goal) => g.editedAt ?? g.createdAt;

function unionById<T extends { id: string }>(
  a: readonly T[],
  b: readonly T[],
  stamp: (x: T) => string,
): T[] {
  const map = new Map<string, T>();
  for (const item of [...a, ...b]) {
    const prev = map.get(item.id);
    if (!prev || stamp(item) > stamp(prev)) map.set(item.id, item);
  }
  return [...map.values()];
}

function alive<T extends { id: string }>(
  items: readonly T[],
  kind: Tombstone['kind'],
  tombs: ReadonlyMap<string, Tombstone>,
  stamp: (x: T) => string,
): T[] {
  return items.filter((it) => {
    const t = tombs.get(tsKey({ kind, id: it.id }));
    return !t || stamp(it) > t.at;
  });
}

/** Estado sem nenhuma ação do usuário (aparelho novo). */
export function isPristine(s: GameState): boolean {
  return (
    s.entries.length === 0 &&
    s.xp === 0 &&
    s.goals.every((g) => g.kind === 'default' && !g.claimed) &&
    s.achievements.length === 0 &&
    s.ownedItems.length <= 1 &&
    s.tombstones.length === 0
  );
}

export function mergeStates(local: GameState, remote: GameState): GameState {
  const winner = local.updatedAt >= remote.updatedAt ? local : remote;
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const tombs = new Map(tombstones.map((t) => [tsKey(t), t]));

  const entries = alive(
    unionById(local.entries, remote.entries, entryStamp),
    'entry',
    tombs,
    entryStamp,
  );

  const winnerGoals = new Map(winner.goals.map((g) => [g.id, g]));
  const customs = alive(
    unionById(
      local.goals.filter((g) => g.kind === 'custom'),
      remote.goals.filter((g) => g.kind === 'custom'),
      goalStamp,
    ),
    'goal',
    tombs,
    goalStamp,
  ).map((g) => {
    const w = winnerGoals.get(g.id);
    return w ? { ...g, claimed: w.claimed } : g;
  });
  const goals = [...winner.goals.filter((g) => g.kind === 'default'), ...customs];

  const achievements = [
    ...new Set([...winner.achievements, ...local.achievements, ...remote.achievements]),
  ];

  return {
    ...winner,
    entries,
    goals,
    achievements,
    tombstones,
    updatedAt: local.updatedAt > remote.updatedAt ? local.updatedAt : remote.updatedAt,
  };
}
