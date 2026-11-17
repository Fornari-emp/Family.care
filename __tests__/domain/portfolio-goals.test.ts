import { categoryFromLegacyName, CATEGORIES, getCategory } from '@/domain/categories';
import { createCustomGoal, defaultGoals, evaluateGoal, validateGoalInput } from '@/domain/goals';
import {
  cumulativeSeries,
  filterEntries,
  hasNegativeBalance,
  holdingsByCategory,
  sortEntries,
  totalContributed,
  totalInvested,
} from '@/domain/portfolio';
import type { Entry } from '@/domain/types';

const e = (id: string, cents: number, day: string, extra: Partial<Entry> = {}): Entry => ({
  id,
  kind: 'contribution',
  amountCents: cents,
  category: 'cdb',
  day,
  createdAt: `${day}T12:00:00.000Z`,
  ...extra,
});

const entries: Entry[] = [
  e('a', 100_000, '2026-11-01'),
  e('b', 50_000, '2026-11-03', { category: 'acoes' }),
  e('c', 20_000, '2026-11-03', { kind: 'withdrawal', createdAt: '2026-11-03T13:00:00.000Z' }),
  e('d', 30_000, '2026-11-05', { category: 'fii' }),
];

describe('carteira (itens 15 e 16)', () => {
  it('total = aportes − resgates', () => {
    expect(totalInvested(entries)).toBe(160_000);
    expect(totalInvested(entries, 'cdb')).toBe(80_000);
    expect(totalContributed(entries)).toBe(180_000);
  });

  it('série acumulada por data real, sem pontos inventados', () => {
    expect(cumulativeSeries(entries)).toEqual([
      { day: '2026-11-01', cents: 100_000 },
      { day: '2026-11-03', cents: 130_000 },
      { day: '2026-11-05', cents: 160_000 },
    ]);
    expect(cumulativeSeries([])).toEqual([]);
  });

  it('carteira por categoria', () => {
    const h = holdingsByCategory(entries);
    expect(h.map((x) => x.category)).toEqual(['cdb', 'acoes', 'fii']);
    expect(h[0]?.share).toBeCloseTo(0.5);
    expect(holdingsByCategory([e('x', 100, '2026-11-01', { kind: 'withdrawal' })])).toEqual([]);
  });

  it('ordenação e filtro do histórico', () => {
    expect(sortEntries(entries).map((x) => x.id)).toEqual(['d', 'c', 'b', 'a']);
    const sameDay = [
      e('p', 100, '2026-11-03', { createdAt: '2026-11-03T10:00:00.000Z' }),
      e('q', 100, '2026-11-03', { createdAt: '2026-11-03T11:00:00.000Z' }),
    ];
    expect(sortEntries(sameDay).map((x) => x.id)).toEqual(['q', 'p']);
    expect(filterEntries(entries, { kind: 'withdrawal' }).map((x) => x.id)).toEqual(['c']);
    expect(filterEntries(entries, { category: 'acoes' }).map((x) => x.id)).toEqual(['b']);
    expect(
      filterEntries(entries, { from: '2026-11-02', to: '2026-11-04' }).map((x) => x.id),
    ).toEqual(['c', 'b']);
  });

  it('detecta saldo negativo por categoria', () => {
    expect(hasNegativeBalance(entries)).toBe(false);
    expect(
      hasNegativeBalance([
        ...entries,
        e('z', 1, '2026-11-06', { kind: 'withdrawal', category: 'etf' }),
      ]),
    ).toBe(true);
  });
});

describe('categorias', () => {
  it('10 categorias, incluindo as novas', () => {
    expect(CATEGORIES).toHaveLength(10);
    expect(CATEGORIES.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Tesouro IPCA+', 'LCI/LCA', 'Previdência', 'Outros']),
    );
    expect(getCategory('cdb').name).toBe('CDB');
    expect(getCategory('nope' as never).id).toBe('outros');
  });
  it('mapeia nomes do protótipo', () => {
    expect(categoryFromLegacyName('Fundo Imobiliário')).toBe('fii');
    expect(categoryFromLegacyName('???')).toBe('outros');
  });
});

describe('metas', () => {
  const today = '2026-11-17';
  it('3 metas padrão do protótipo', () => {
    const g = defaultGoals('t');
    expect(g.map((x) => [x.targetCents, x.rewardCoins, x.rewardXp])).toEqual([
      [100_000, 200, 100],
      [500_000, 600, 300],
      [1_000_000, 1200, 600],
    ]);
  });

  it('avaliação: progresso, alcançada, resgatável', () => {
    const [g1k, g5k] = defaultGoals('t');
    const v = evaluateGoal(g1k!, entries, today);
    expect(v).toMatchObject({ reached: true, claimable: true, currentCents: 160_000, ratio: 1 });
    expect(evaluateGoal({ ...g1k!, claimed: true }, entries, today).claimable).toBe(false);
    expect(evaluateGoal(g5k!, entries, today).ratio).toBeCloseTo(0.32);
  });

  it('metas personalizadas: prazo, categoria e atraso', () => {
    const g = createCustomGoal(
      'x',
      { name: '  Viagem ', targetCents: 500_000, deadline: '2026-11-10', category: 'acoes' },
      't',
    );
    expect(g).toMatchObject({ name: 'Viagem', kind: 'custom', rewardCoins: 100, rewardXp: 50 });
    const v = evaluateGoal(g, entries, today);
    expect(v).toMatchObject({ currentCents: 50_000, overdue: true, daysLeft: -7 });
    const plain = createCustomGoal('y', { name: 'Carro', targetCents: 100 }, 't');
    expect(plain.deadline).toBeUndefined();
    expect(evaluateGoal(plain, [], today)).toMatchObject({ daysLeft: null, overdue: false });
  });

  it('validação de entrada', () => {
    expect(validateGoalInput({ name: '', targetCents: 100 }, today)).toBe('invalid-name');
    expect(validateGoalInput({ name: 'x'.repeat(41), targetCents: 100 }, today)).toBe(
      'invalid-name',
    );
    expect(validateGoalInput({ name: 'ok', targetCents: 50 }, today)).toBe('invalid-target');
    expect(validateGoalInput({ name: 'ok', targetCents: 100, deadline: '2026-11-16' }, today)).toBe(
      'invalid-deadline',
    );
    expect(validateGoalInput({ name: 'ok', targetCents: 100, deadline: 'x' }, today)).toBe(
      'invalid-deadline',
    );
    expect(validateGoalInput({ name: 'ok', targetCents: 100, deadline: today }, today)).toBeNull();
  });
});
