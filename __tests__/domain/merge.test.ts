import { isPristine, mergeStates } from '@/domain/merge';
import { PRISTINE_UPDATED_AT } from '@/domain/state';
import type { GameState } from '@/domain/types';
import { act, contribution, fresh, ok } from '../helpers/game';

const D = '2026-11-17';
const t = (h: string) => `${D}T${h}`;

/** Dois aparelhos que partem do mesmo estado sincronizado. */
function twoDevices() {
  let base = ok(fresh(t('08:00:00')), contribution(10_000, D, 'cdb'), t('08:00:00')).state;
  base = ok(
    base,
    { type: 'ADD_GOAL', goal: { name: 'Viagem', targetCents: 500_000 } },
    t('08:01:00'),
  ).state;
  return { a: base, b: base, base };
}

describe('updatedAt e lápides no engine', () => {
  it('ação do usuário atualiza updatedAt; virada de dia (SYNC) não', () => {
    const s = fresh(t('08:00:00'));
    expect(s.updatedAt).toBe(PRISTINE_UPDATED_AT);
    const synced = ok(s, { type: 'SYNC' }, '2026-11-18T08:00:00').state;
    expect(synced.updatedAt).toBe(PRISTINE_UPDATED_AT);
    const acted = ok(s, { type: 'READ_TIP' }, t('09:00:00')).state;
    expect(acted.updatedAt).toBe(new Date(`${t('09:00:00')}-03:00`).toISOString());
    // ação com erro (baú já aberto) não muda updatedAt
    const chest = ok(acted, { type: 'OPEN_CHEST' }, t('09:30:00')).state;
    expect(act(chest, { type: 'OPEN_CHEST' }, t('10:00:00')).state.updatedAt).toBe(chest.updatedAt);
  });

  it('excluir registro/meta e reiniciar deixam lápides', () => {
    const { a } = twoDevices();
    const entryId = a.entries[0]!.id;
    const goalId = a.goals.at(-1)!.id;
    let s = ok(a, { type: 'DELETE_ENTRY', id: entryId }, t('09:00:00')).state;
    s = ok(s, { type: 'DELETE_GOAL', id: goalId }, t('09:01:00')).state;
    expect(s.tombstones.map((x) => `${x.kind}:${x.id}`)).toEqual([
      `entry:${entryId}`,
      `goal:${goalId}`,
    ]);
    const r = ok(a, { type: 'RESET', confirmation: 'REINICIAR' }, t('10:00:00')).state;
    expect(r.tombstones.map((x) => x.kind).sort()).toEqual(['entry', 'goal']);
    expect(r.updatedAt).not.toBe(PRISTINE_UPDATED_AT);
  });
});

describe('mergeStates', () => {
  it('aportes registrados em aparelhos diferentes somam', () => {
    const { a, b } = twoDevices();
    const a2 = ok(a, contribution(20_000, D, 'acoes'), t('09:00:00')).state;
    const b2 = ok(b, contribution(30_000, D, 'fii'), t('09:05:00')).state;
    const m = mergeStates(a2, b2);
    expect(m.entries.map((e) => e.amountCents).sort()).toEqual([10_000, 20_000, 30_000]);
    expect(mergeStates(b2, a2).entries).toHaveLength(3); // simétrico nos registros
  });

  it('edição mais recente vence', () => {
    const { a, b } = twoDevices();
    const id = a.entries[0]!.id;
    const a2 = ok(
      a,
      { type: 'EDIT_ENTRY', id, patch: { amountCents: 11_111 } },
      t('09:00:00'),
    ).state;
    const b2 = ok(
      b,
      { type: 'EDIT_ENTRY', id, patch: { amountCents: 22_222 } },
      t('09:10:00'),
    ).state;
    expect(mergeStates(a2, b2).entries[0]!.amountCents).toBe(22_222);
    expect(mergeStates(b2, a2).entries[0]!.amountCents).toBe(22_222);
  });

  it('registro excluído num aparelho não ressuscita pelo outro', () => {
    const { a, b } = twoDevices();
    const id = a.entries[0]!.id;
    const a2 = ok(a, { type: 'DELETE_ENTRY', id }, t('09:00:00')).state;
    const b2 = ok(b, { type: 'READ_TIP' }, t('09:30:00')).state; // B mais recente, ainda tem o registro
    expect(mergeStates(a2, b2).entries).toEqual([]);
    expect(mergeStates(b2, a2).entries).toEqual([]);
  });

  it('mas uma edição posterior à exclusão mantém o registro', () => {
    const { a, b } = twoDevices();
    const id = a.entries[0]!.id;
    const a2 = ok(a, { type: 'DELETE_ENTRY', id }, t('09:00:00')).state;
    const b2 = ok(
      b,
      { type: 'EDIT_ENTRY', id, patch: { amountCents: 9_999 } },
      t('09:30:00'),
    ).state;
    expect(mergeStates(a2, b2).entries[0]!.amountCents).toBe(9_999);
  });

  it('metas pessoais: união, edição mais recente e exclusão', () => {
    const { a, b } = twoDevices();
    const gid = a.goals.at(-1)!.id;
    const a2 = ok(
      a,
      { type: 'ADD_GOAL', goal: { name: 'Carro', targetCents: 100_000 } },
      t('09:00:00'),
    ).state;
    const b2 = ok(
      b,
      { type: 'EDIT_GOAL', id: gid, goal: { name: 'Viagem 2027', targetCents: 600_000 } },
      t('09:10:00'),
    ).state;
    const m = mergeStates(a2, b2);
    expect(
      m.goals
        .filter((g) => g.kind === 'custom')
        .map((g) => g.name)
        .sort(),
    ).toEqual(['Carro', 'Viagem 2027']);
    expect(m.goals.filter((g) => g.kind === 'default')).toHaveLength(3);
    const a3 = ok(a2, { type: 'DELETE_GOAL', id: gid }, t('09:20:00')).state;
    expect(mergeStates(a3, b2).goals.some((g) => g.id === gid)).toBe(false);
  });

  it('progresso: vence a ação mais recente, sem somar moedas dos dois lados', () => {
    const { a, b } = twoDevices();
    const a2 = ok({ ...a, coins: 1000 }, { type: 'BUY', itemId: 'pet-pig' }, t('09:00:00')).state; // gastou 500
    const b2 = ok({ ...b, coins: 1000 }, { type: 'OPEN_CHEST' }, t('09:10:00')).state; // ganhou
    const m = mergeStates(a2, b2);
    expect(m.coins).toBe(b2.coins);
    expect(m.xp).toBe(b2.xp);
    expect(m.ownedItems).toEqual(b2.ownedItems); // sem item grátis
    expect(m.updatedAt).toBe(b2.updatedAt);
    expect(mergeStates(b2, a2).coins).toBe(b2.coins);
  });

  it('meta resgatada acompanha o progresso vencedor; conquistas são unidas', () => {
    const { a, b } = twoDevices();
    const a2 = {
      ...a,
      achievements: [...a.achievements, 'tips-7'],
      goals: a.goals.map((g) => (g.id === 'g-1k' ? { ...g, claimed: true } : g)),
      updatedAt: '2026-11-17T12:00:00.000Z',
    };
    const b2 = { ...b, updatedAt: '2026-11-17T13:00:00.000Z' };
    const m = mergeStates(a2, b2);
    expect(m.goals.find((g) => g.id === 'g-1k')!.claimed).toBe(false);
    expect(m.achievements).toContain('tips-7');
  });

  it('lápides são unidas mantendo a mais recente', () => {
    const { a, b } = twoDevices();
    const a2: GameState = {
      ...a,
      tombstones: [{ kind: 'entry', id: 'x', at: '2026-11-17T10:00:00.000Z' }],
    };
    const b2: GameState = {
      ...b,
      tombstones: [
        { kind: 'entry', id: 'x', at: '2026-11-17T11:00:00.000Z' },
        { kind: 'goal', id: 'y', at: '2026-11-17T09:00:00.000Z' },
      ],
    };
    expect(mergeStates(a2, b2).tombstones).toEqual([
      { kind: 'goal', id: 'y', at: '2026-11-17T09:00:00.000Z' },
      { kind: 'entry', id: 'x', at: '2026-11-17T11:00:00.000Z' },
    ]);
  });

  it('mesclar um estado com ele mesmo não muda nada', () => {
    const { a } = twoDevices();
    expect(mergeStates(a, a)).toEqual(a);
  });
});

describe('isPristine', () => {
  it('aparelho novo é intocado; qualquer uso não é', () => {
    expect(isPristine(fresh())).toBe(true);
    expect(isPristine(ok(fresh(), { type: 'READ_TIP' }, t('09:00:00')).state)).toBe(false);
    expect(isPristine(twoDevices().a)).toBe(false);
  });
});
