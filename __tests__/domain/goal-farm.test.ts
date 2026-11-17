/**
 * Anti-farm de metas. Cada teste reproduz um abuso que funcionava antes desta mudança.
 */
import { evaluateGoal, GOAL_SETTLE_DAYS, settledTotal } from '@/domain/goals';
import type { GameState } from '@/domain/types';
import { act, contribution, fresh, ok, withdrawal } from '../helpers/game';

const D0 = '2026-11-17'; // terça
const at = (day: string, h = '10:00:00') => `${day}T${h}`;
const coinsOf = (s: GameState) => s.coins;

describe('metas padrão: "registrar, resgatar e excluir" não rende mais', () => {
  it('resgatar no mesmo dia do aporte é recusado (antes pagava 2.000 moedas na hora)', () => {
    let s = ok(fresh(at(D0)), contribution(1_000_000, D0), at(D0)).state;
    for (const id of ['g-1k', 'g-5k', 'g-10k']) {
      expect(act(s, { type: 'CLAIM_GOAL', id }, at(D0)).error).toBe('not-settled');
    }
    // excluir em seguida: nenhuma recompensa de meta foi paga
    const entryId = s.entries[0]!.id;
    const before = coinsOf(s);
    s = ok(s, { type: 'DELETE_ENTRY', id: entryId }, at(D0)).state;
    expect(coinsOf(s)).toBe(before);
    expect(s.goals.every((g) => !g.claimed)).toBe(true);
  });

  it(`libera após ${GOAL_SETTLE_DAYS} dias de registro`, () => {
    const s = ok(fresh(at(D0)), contribution(100_000, D0), at(D0)).state;
    expect(act(s, { type: 'CLAIM_GOAL', id: 'g-1k' }, at('2026-11-19', '23:59:00')).error).toBe(
      'not-settled',
    );
    expect(
      act(s, { type: 'CLAIM_GOAL', id: 'g-1k' }, at('2026-11-20', '00:01:00')).error,
    ).toBeUndefined();
  });

  it('aporte retroativo conta pela data de REGISTRO, não pela data informada', () => {
    // data de 30 dias atrás, registrado hoje: não pode ser resgatado hoje
    const s = ok(fresh(at(D0)), contribution(100_000, '2026-10-18'), at(D0)).state;
    expect(act(s, { type: 'CLAIM_GOAL', id: 'g-1k' }, at(D0)).error).toBe('not-settled');
  });

  it('editar um aporte reinicia a carência', () => {
    let s = ok(fresh(at(D0)), contribution(50_000, D0), at(D0)).state;
    const id = s.entries[0]!.id;
    s = ok(s, { type: 'EDIT_ENTRY', id, patch: { amountCents: 100_000 } }, at('2026-11-20')).state;
    expect(act(s, { type: 'CLAIM_GOAL', id: 'g-1k' }, at('2026-11-20')).error).toBe('not-settled');
    expect(act(s, { type: 'CLAIM_GOAL', id: 'g-1k' }, at('2026-11-23')).error).toBeUndefined();
  });

  it('resgates contam na hora (não dá para inflar com saldo já retirado)', () => {
    let s = ok(
      fresh(at('2026-11-01')),
      contribution(150_000, '2026-11-01'),
      at('2026-11-01'),
    ).state;
    s = ok(s, contribution(50_000, D0), at(D0)).state;
    s = ok(s, withdrawal(60_000, D0), at(D0)).state;
    // saldo atual 140k (meta "alcançada"), mas o maduro é 150k − 60k = 90k
    const v = evaluateGoal(s.goals[0]!, s.entries, D0);
    expect(v).toMatchObject({ reached: true, settledCents: 90_000, claimable: false });
    expect(v.waiting).toEqual({ reasons: ['settling'], availableOn: '2026-11-20' });
    expect(act(s, { type: 'CLAIM_GOAL', id: 'g-1k' }, at(D0)).error).toBe('not-settled');
  });

  it('settledTotal filtra por categoria', () => {
    const s = ok(
      fresh(at('2026-11-01')),
      contribution(10_000, '2026-11-01', 'fii'),
      at('2026-11-01'),
    ).state;
    expect(settledTotal(s.entries, D0, 'America/Sao_Paulo', 'fii')).toBe(10_000);
    expect(settledTotal(s.entries, D0, 'America/Sao_Paulo', 'cdb')).toBe(0);
  });
});

describe('metas pessoais: ciclo "criar R$ 1, resgatar, excluir" travado', () => {
  function cycle(s: GameState, iso: string, n: number) {
    let state = s;
    const r = ok(state, { type: 'ADD_GOAL', goal: { name: `Farm ${n}`, targetCents: 100 } }, iso);
    state = r.state;
    const id = state.goals.at(-1)!.id;
    state = ok(state, contribution(100, iso.slice(0, 10)), iso).state;
    const claim = act(state, { type: 'CLAIM_GOAL', id }, iso);
    if (!claim.error) state = claim.state;
    state = ok(state, { type: 'DELETE_GOAL', id }, iso).state;
    return { state, error: claim.error };
  }

  it('10 ciclos no mesmo dia: nenhuma recompensa de meta (antes: 10 × 100 moedas)', () => {
    let s = { ...fresh(at('2026-11-01')), coins: 0 };
    s = ok(s, contribution(10_000, '2026-11-01'), at('2026-11-01')).state; // saldo maduro
    const errors: (string | undefined)[] = [];
    let state = s;
    for (let i = 0; i < 10; i++) {
      const r = cycle(state, at(D0), i);
      state = r.state;
      errors.push(r.error);
    }
    expect(errors.every((e) => e === 'goal-too-recent')).toBe(true);
    expect(state.goals.filter((g) => g.kind === 'custom' && g.claimed)).toHaveLength(0);
    expect(state.weekly.customGoalRewarded).toBe(false);
  });

  it('meta pessoal libera 7 dias após criada e no máximo 1 por semana', () => {
    let s = ok(fresh(at('2026-11-01')), contribution(10_000, '2026-11-01'), at('2026-11-01')).state;
    s = ok(s, { type: 'ADD_GOAL', goal: { name: 'A', targetCents: 100 } }, at('2026-11-09')).state;
    s = ok(s, { type: 'ADD_GOAL', goal: { name: 'B', targetCents: 100 } }, at('2026-11-09')).state;
    const [a, b] = s.goals.filter((g) => g.kind === 'custom');
    expect(act(s, { type: 'CLAIM_GOAL', id: a!.id }, at('2026-11-15')).error).toBe(
      'goal-too-recent',
    );

    const coins = s.coins;
    s = ok(s, { type: 'CLAIM_GOAL', id: a!.id }, at('2026-11-16')).state; // segunda, W47
    expect(s.coins).toBeGreaterThan(coins);
    expect(act(s, { type: 'CLAIM_GOAL', id: b!.id }, at('2026-11-18')).error).toBe(
      'weekly-goal-limit',
    );

    // excluir a meta resgatada não libera o limite da semana
    s = ok(s, { type: 'DELETE_GOAL', id: a!.id }, at('2026-11-18')).state;
    expect(act(s, { type: 'CLAIM_GOAL', id: b!.id }, at('2026-11-22', '23:00:00')).error).toBe(
      'weekly-goal-limit',
    );
    // semana seguinte libera
    expect(
      act(s, { type: 'CLAIM_GOAL', id: b!.id }, at('2026-11-23', '00:30:00')).error,
    ).toBeUndefined();
  });

  it('editar a meta (ex.: baixar o alvo) reinicia os 7 dias', () => {
    let s = ok(fresh(at('2026-11-01')), contribution(10_000, '2026-11-01'), at('2026-11-01')).state;
    s = ok(
      s,
      { type: 'ADD_GOAL', goal: { name: 'Alta', targetCents: 99_999_900 } },
      at('2026-11-01'),
    ).state;
    const id = s.goals.at(-1)!.id;
    s = ok(s, { type: 'EDIT_GOAL', id, goal: { name: 'Baixa', targetCents: 100 } }, at(D0)).state;
    expect(s.goals.at(-1)!.editedAt).toBeDefined();
    expect(act(s, { type: 'CLAIM_GOAL', id }, at(D0)).error).toBe('goal-too-recent');
    const v = evaluateGoal(s.goals.at(-1)!, s.entries, D0);
    expect(v.waiting).toEqual({ reasons: ['too-recent'], availableOn: '2026-11-24' });
    expect(act(s, { type: 'CLAIM_GOAL', id }, at('2026-11-24')).error).toBeUndefined();
  });

  it('em 3 semanas de farm, no máximo 3 recompensas de meta pessoal', () => {
    let s = ok(fresh(at('2026-10-01')), contribution(10_000, '2026-10-01'), at('2026-10-01')).state;
    // cria 20 metas de uma vez e tenta resgatar todas depois dos 7 dias
    for (let i = 0; i < 20; i++) {
      s = ok(
        s,
        { type: 'ADD_GOAL', goal: { name: `M${i}`, targetCents: 100 } },
        at('2026-10-20'),
      ).state;
    }
    let rewarded = 0;
    for (const day of [
      '2026-10-27',
      '2026-10-28',
      '2026-11-03',
      '2026-11-04',
      '2026-11-10',
      '2026-11-12',
    ]) {
      for (const g of s.goals.filter((x) => x.kind === 'custom' && !x.claimed)) {
        const r = act(s, { type: 'CLAIM_GOAL', id: g.id }, at(day));
        if (!r.error) {
          s = r.state;
          rewarded++;
        }
      }
    }
    expect(rewarded).toBe(3);
  });
});

describe('waiting combina os dois motivos', () => {
  it('mostra a data mais distante', () => {
    let s = ok(
      fresh(at(D0)),
      { type: 'ADD_GOAL', goal: { name: 'X', targetCents: 100 } },
      at(D0),
    ).state;
    s = ok(s, contribution(100, D0), at(D0)).state;
    const v = evaluateGoal(s.goals.at(-1)!, s.entries, D0);
    expect(v.waiting).toEqual({ reasons: ['settling', 'too-recent'], availableOn: '2026-11-24' });
    expect(evaluateGoal({ ...s.goals.at(-1)!, claimed: true }, s.entries, D0).waiting).toBeNull();
  });
});
