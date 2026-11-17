import {
  CONFIRM_ABOVE_CENTS,
  constancyMultiplier,
  contributionReward,
  DAILY_CONTRIBUTION_COINS_CAP,
  DAILY_CONTRIBUTION_XP_CAP,
  DEFAULT_MAX_AMOUNT_CENTS,
  slotFactor,
  validateAmount,
  validateEntryDay,
  volumeXp,
  type RewardInput,
} from '@/domain/rewards';

const base: RewardInput = {
  amountCents: 10_000,
  day: '2026-11-17',
  today: '2026-11-17',
  rewardedToday: 0,
  xpToday: 0,
  coinsToday: 0,
  isFirstOfWeek: false,
  previousWeeksRun: 0,
  streakDays: 0,
};

describe('validação de valor (bug 13)', () => {
  it('mínimo de R$ 1,00', () => {
    expect(validateAmount(1, DEFAULT_MAX_AMOUNT_CENTS)).toBe('below-min');
    expect(validateAmount(99, DEFAULT_MAX_AMOUNT_CENTS)).toBe('below-min');
    expect(validateAmount(100, DEFAULT_MAX_AMOUNT_CENTS)).toBeNull();
    expect(validateAmount(1.5, DEFAULT_MAX_AMOUNT_CENTS)).toBe('below-min');
  });
  it('máximo configurável', () => {
    expect(validateAmount(DEFAULT_MAX_AMOUNT_CENTS + 1, DEFAULT_MAX_AMOUNT_CENTS, true)).toBe(
      'above-max',
    );
    expect(validateAmount(20_000, 10_000)).toBe('above-max');
  });
  it('confirmação extra acima de R$ 50.000', () => {
    expect(validateAmount(CONFIRM_ABOVE_CENTS, DEFAULT_MAX_AMOUNT_CENTS)).toBeNull();
    expect(validateAmount(CONFIRM_ABOVE_CENTS + 1, DEFAULT_MAX_AMOUNT_CENTS)).toBe(
      'needs-confirmation',
    );
    expect(validateAmount(CONFIRM_ABOVE_CENTS + 1, DEFAULT_MAX_AMOUNT_CENTS, true)).toBeNull();
  });
});

describe('validação de data', () => {
  it('permite até 30 dias para trás, nunca futuro', () => {
    expect(validateEntryDay('2026-11-17', '2026-11-17')).toBeNull();
    expect(validateEntryDay('2026-10-18', '2026-11-17')).toBeNull();
    expect(validateEntryDay('2026-10-17', '2026-11-17')).toBe('too-old');
    expect(validateEntryDay('2026-11-18', '2026-11-17')).toBe('future-date');
    expect(validateEntryDay('2026-02-30', '2026-11-17')).toBe('invalid-date');
  });
});

describe('recompensa de aporte', () => {
  it('base: 40 XP e 15 moedas para R$ 1', () => {
    expect(contributionReward({ ...base, amountCents: 100 })).toMatchObject({
      xp: 40,
      coins: 15,
      note: null,
    });
  });

  it('bug 13: R$ 0,01 não existe mais e volume quase não pesa', () => {
    const small = contributionReward({ ...base, amountCents: 100 });
    const huge = contributionReward({ ...base, amountCents: 100_000_000 });
    expect(huge.xp - small.xp).toBeLessThanOrEqual(20);
    expect(huge.coins).toBe(small.coins);
    // protótipo: 40 + min(120, v/25) → R$ 3.000 dava 160 XP
    expect(contributionReward({ ...base, amountCents: 300_000 }).xp).toBeLessThan(60);
  });

  it('volumeXp é logarítmico e limitado', () => {
    expect(volumeXp(50)).toBe(0);
    expect(volumeXp(100)).toBe(0);
    expect(volumeXp(1_000)).toBe(5);
    expect(volumeXp(10_000)).toBe(10);
    expect(volumeXp(1_000_000)).toBe(20);
    expect(volumeXp(100_000_000)).toBe(20);
  });

  it('retorno decrescente: 3 integrais, depois 25%, depois 0', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(slotFactor)).toEqual([1, 1, 1, 0.25, 0.25, 0, 0]);
    expect(contributionReward({ ...base, rewardedToday: 3 })).toMatchObject({
      xp: 13,
      coins: 4,
      note: 'diminishing',
    });
    expect(contributionReward({ ...base, rewardedToday: 5 })).toMatchObject({
      xp: 0,
      coins: 0,
      note: 'daily-limit',
    });
  });

  it('teto diário de XP e moedas', () => {
    const r = contributionReward({
      ...base,
      xpToday: DAILY_CONTRIBUTION_XP_CAP - 10,
      coinsToday: DAILY_CONTRIBUTION_COINS_CAP - 2,
    });
    expect(r).toMatchObject({ xp: 10, coins: 2, note: 'daily-limit' });
    const capped = contributionReward({
      ...base,
      xpToday: DAILY_CONTRIBUTION_XP_CAP,
      coinsToday: DAILY_CONTRIBUTION_COINS_CAP,
    });
    expect(capped).toMatchObject({ xp: 0, coins: 0 });
  });

  it('aporte retroativo não rende XP nem moedas', () => {
    expect(contributionReward({ ...base, day: '2026-11-10' })).toMatchObject({
      xp: 0,
      coins: 0,
      note: 'retroactive',
    });
  });

  it('constância vale mais que volume', () => {
    expect(constancyMultiplier(0, 0)).toBe(1);
    expect(constancyMultiplier(3, 5)).toBeCloseTo(1.4);
    expect(constancyMultiplier(99, 99)).toBeCloseTo(1.8);
    expect(constancyMultiplier(-1, -1)).toBe(1);
    const constant = contributionReward({
      ...base,
      amountCents: 5_000,
      isFirstOfWeek: true,
      previousWeeksRun: 4,
      streakDays: 10,
    });
    const bigOnce = contributionReward({ ...base, amountCents: 1_000_000 });
    expect(constant.xp).toBeGreaterThan(bigOnce.xp * 1.5);
    expect(constant.breakdown.firstOfWeek).toBe(30);
  });
});
