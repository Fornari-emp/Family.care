import { previewContribution, RESET_CONFIRMATION, rewardContext, sync } from '@/domain/engine';
import { getLevel } from '@/domain/levels';
import { totalInvested } from '@/domain/portfolio';
import { STREAK_FREEZE } from '@/domain/shop';
import type { GameState } from '@/domain/types';
import { act, contribution, fresh, ok, sp, withdrawal } from '../helpers/game';

const TUE = '2026-11-17';
const AM = `${TUE}T10:00:00`;

describe('bug 2: dia no fuso do usuário', () => {
  it('baú aberto às 21h30 continua fechado às 23h59 e reabre à meia-noite local', () => {
    const s0 = fresh(AM);
    const a = ok(s0, { type: 'OPEN_CHEST' }, `${TUE}T21:30:00`);
    expect(a.events.find((e) => e.type === 'chestOpened')).toBeDefined();
    expect(act(a.state, { type: 'OPEN_CHEST' }, `${TUE}T23:59:00`).error).toBe(
      'chest-already-opened',
    );
    const next = ok(a.state, { type: 'OPEN_CHEST' }, '2026-11-18T00:01:00');
    expect(next.state.daily.day).toBe('2026-11-18');
  });

  it('missões concluídas às 21h não resetam antes da meia-noite local', () => {
    const a = ok(fresh(AM), { type: 'READ_TIP' }, `${TUE}T21:10:00`);
    const b = ok(a.state, { type: 'SYNC' }, `${TUE}T23:30:00`);
    expect(b.state.daily.missionsDone).toContain('m-tip');
    const c = ok(b.state, { type: 'SYNC' }, '2026-11-18T00:00:00');
    expect(c.state.daily.missionsDone).toEqual([]);
  });

  it('relógio voltando não reabre baú', () => {
    const a = ok(fresh(AM), { type: 'OPEN_CHEST' }, '2026-11-18T09:00:00');
    expect(act(a.state, { type: 'OPEN_CHEST' }, `${TUE}T09:00:00`).error).toBe(
      'chest-already-opened',
    );
  });
});

describe('bug 3: "Manter 7 dias de sequência" progride', () => {
  it('7 dias lendo a dica completam a missão semanal', () => {
    let s = fresh('2026-11-23T08:00:00'); // segunda, W48
    for (let d = 23; d <= 29; d++) s = ok(s, { type: 'READ_TIP' }, `2026-11-${d}T20:00:00`).state;
    expect(s.weekly.week).toBe('2026-W48');
    expect(s.weekly.bestStreak).toBe(7);
    const r = ok(s, { type: 'CLAIM_WEEKLY', id: 'w-streak' }, '2026-11-29T21:00:00');
    expect(r.state.coins).toBe(s.coins + 400);
  });
});

describe('bug 4: resgate de semanais pago uma vez', () => {
  it('só resgata concluída, e uma vez', () => {
    let s = fresh(AM);
    expect(act(s, { type: 'CLAIM_WEEKLY', id: 'w-xp' }, AM).error).toBe('not-complete');
    s = { ...s, weekly: { ...s.weekly, xp: 600 } };
    const r = ok(s, { type: 'CLAIM_WEEKLY', id: 'w-xp' }, AM);
    expect(r.state.coins).toBe(s.coins + 300);
    expect(r.events).toContainEqual({ type: 'weeklyClaimed', id: 'w-xp', coins: 300 });
    const again = act(r.state, { type: 'CLAIM_WEEKLY', id: 'w-xp' }, AM);
    expect(again.error).toBe('already-claimed');
    expect(again.state.coins).toBe(r.state.coins);
  });
});

describe('bug 6: sequência por ação válida', () => {
  it('abrir o app (SYNC) em dias seguidos não aumenta a sequência', () => {
    let s = fresh(AM);
    for (let d = 17; d <= 20; d++) s = ok(s, { type: 'SYNC' }, `2026-11-${d}T09:00:00`).state;
    expect(s.streak.count).toBe(0);
  });

  it('aporte de hoje ou dica contam; aporte retroativo não', () => {
    let s = fresh(AM);
    s = ok(s, contribution(5_000, '2026-11-10'), AM).state;
    expect(s.streak.count).toBe(0);
    s = ok(s, contribution(5_000, TUE), AM).state;
    expect(s.streak.count).toBe(1);
    s = ok(s, { type: 'READ_TIP' }, '2026-11-18T08:00:00').state;
    expect(s.streak.count).toBe(2);
  });

  it('dia perdido usa congelamento automaticamente', () => {
    let s = { ...fresh(AM), coins: 1000 };
    s = ok(s, { type: 'BUY', itemId: STREAK_FREEZE.id }, AM).state;
    s = ok(s, { type: 'READ_TIP' }, AM).state;
    const r = ok(s, { type: 'READ_TIP' }, '2026-11-19T08:00:00');
    expect(r.events).toContainEqual({ type: 'streakFrozen', days: ['2026-11-18'] });
    expect(r.state.streak).toMatchObject({ count: 2, freezes: 0 });
  });

  it('dia perdido sem congelamento avisa que a sequência quebrou', () => {
    let s = ok(fresh(AM), { type: 'READ_TIP' }, AM).state;
    const r = ok(s, { type: 'SYNC' }, '2026-11-20T08:00:00');
    expect(r.events).toContainEqual({ type: 'streakBroken' });
    s = ok(r.state, { type: 'READ_TIP' }, '2026-11-20T08:00:00').state;
    expect(s.streak.count).toBe(1);
  });
});

describe('bugs 7 e 8: missões só pelo evento real', () => {
  it('ler a dica conclui a missão, uma vez por dia', () => {
    const s = fresh(AM);
    const r = ok(s, { type: 'READ_TIP' }, AM);
    expect(r.state.daily.missionsDone).toEqual(['m-tip']);
    expect(r.state.stats.tipsRead).toBe(1);
    expect(r.state.xp).toBe(35);
    const again = ok(r.state, { type: 'READ_TIP' }, AM);
    expect(again.state).toBe(r.state);
  });

  it('visitar a carteira não conclui "Registrar um aporte"', () => {
    const r = ok(fresh(AM), { type: 'VISIT', screen: 'portfolio' }, AM);
    expect(r.state.daily.missionsDone).toEqual(['m-portfolio']);
    const l = ok(r.state, { type: 'VISIT', screen: 'league' }, AM);
    expect(l.state.daily.missionsDone).toEqual(['m-portfolio', 'm-league']);
  });

  it('aporte retroativo não conclui a missão; aporte de hoje conclui', () => {
    let s = ok(fresh(AM), contribution(5_000, '2026-11-16'), AM).state;
    expect(s.daily.missionsDone).not.toContain('m-contribution');
    s = ok(s, contribution(5_000, TUE), AM).state;
    expect(s.daily.missionsDone).toContain('m-contribution');
  });
});

describe('bug 9: prévia reativa e pura', () => {
  it('muda com o valor e não altera o estado', () => {
    const s = fresh(AM);
    const snapshot = JSON.stringify(s);
    const a = previewContribution(s, 100, TUE, sp(AM));
    const b = previewContribution(s, 1_000_000, TUE, sp(AM));
    expect(b.reward.xp).toBeGreaterThan(a.reward.xp);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('prévia bate com a recompensa real e mostra erros', () => {
    const s = fresh(AM);
    const p = previewContribution(s, 25_000, TUE, sp(AM));
    const r = ok(s, contribution(25_000, TUE), AM);
    const added = r.events.find((e) => e.type === 'entryAdded');
    expect(added && added.type === 'entryAdded' && added.reward).toEqual(p.reward);
    expect(previewContribution(s, 50, TUE, sp(AM)).error).toBe('below-min');
    expect(previewContribution(s, 5_000, '2026-11-20', sp(AM)).error).toBe('future-date');
    expect(previewContribution(s, 5_000, '2026-11-10', sp(AM)).reward.note).toBe('retroactive');
  });
});

describe('bug 10: vários níveis de uma vez', () => {
  it('paga +100 por nível na hora e informa nível final e quantos subiu', () => {
    let s = ok(fresh(AM), contribution(1_000_000, TUE), AM).state;
    const coinsBefore = s.coins;
    const xpBefore = s.xp;
    const r = ok(s, { type: 'CLAIM_GOAL', id: 'g-10k' }, AM);
    const lvl = r.events.find((e) => e.type === 'levelUp');
    expect(lvl).toEqual({
      type: 'levelUp',
      from: getLevel(xpBefore),
      to: getLevel(xpBefore + 600),
      levels: getLevel(xpBefore + 600) - getLevel(xpBefore),
      bonusCoins: 100 * (getLevel(xpBefore + 600) - getLevel(xpBefore)),
    });
    expect(lvl && lvl.type === 'levelUp' && lvl.levels).toBeGreaterThan(1);
    // bônus já está no estado salvo, sem depender de fechar overlay
    expect(r.state.coins).toBe(coinsBefore + 1200 + (lvl?.type === 'levelUp' ? lvl.bonusCoins : 0));
    s = r.state;
    expect(getLevel(s.xp)).toBe(lvl?.type === 'levelUp' ? lvl.to : 0);
  });
});

describe('bug 12: reiniciar exige confirmação', () => {
  it('texto errado não faz nada; "REINICIAR" zera progresso e mantém preferências', () => {
    let s = ok(fresh(AM), contribution(5_000, TUE), AM).state;
    s = ok(s, { type: 'UPDATE_PROFILE', patch: { nickname: 'Ana', sound: false } }, AM).state;
    const bad = act(s, { type: 'RESET', confirmation: 'reiniciar?' }, AM);
    expect(bad.error).toBe('invalid-confirmation');
    expect(bad.state.entries).toHaveLength(1);
    const r = ok(s, { type: 'RESET', confirmation: RESET_CONFIRMATION }, AM);
    expect(r.state.entries).toEqual([]);
    expect(r.state.xp).toBe(0);
    expect(r.state.achievements).toEqual([]);
    expect(r.state.profile).toMatchObject({ nickname: 'Ana', sound: false });
  });
});

describe('bug 13: anti-abuso de aportes', () => {
  it('spam de aportes no mesmo dia tem retorno decrescente e teto', () => {
    let s = fresh(AM);
    const xps: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = ok(s, contribution(100, TUE), AM);
      const e = r.events.find((x) => x.type === 'entryAdded');
      xps.push(e?.type === 'entryAdded' ? (e.reward?.xp ?? -1) : -1);
      s = r.state;
    }
    expect(xps.slice(5)).toEqual([0, 0, 0, 0, 0]);
    expect(xps[3]).toBeLessThan(xps[1]!);
    expect(s.daily.xpFromContributions).toBeLessThanOrEqual(400);
  });

  it('R$ 0,01 é recusado', () => {
    expect(act(fresh(AM), contribution(1, TUE), AM).error).toBe('below-min');
  });

  it('R$ 1.000.000 exige confirmação e acima do máximo é recusado', () => {
    const s = fresh(AM);
    expect(act(s, contribution(100_000_000, TUE), AM).error).toBe('needs-confirmation');
    expect(
      act(s, { ...contribution(100_000_001, TUE), confirmedLarge: true } as never, AM).error,
    ).toBe('above-max');
    const r = ok(s, { ...contribution(100_000_000, TUE), confirmedLarge: true } as never, AM);
    expect(totalInvested(r.state.entries)).toBe(100_000_000);
  });

  it('datas futuras ou com mais de 30 dias são recusadas', () => {
    expect(act(fresh(AM), contribution(5_000, '2026-11-18'), AM).error).toBe('future-date');
    expect(act(fresh(AM), contribution(5_000, '2026-10-01'), AM).error).toBe('too-old');
  });

  it('constância: semanas seguidas aumentam a recompensa', () => {
    let s = fresh('2026-11-09T10:00:00');
    s = ok(s, contribution(5_000, '2026-11-09'), '2026-11-09T10:00:00').state;
    s = ok(s, contribution(5_000, '2026-11-16'), '2026-11-16T10:00:00').state;
    expect(s.weekRun).toMatchObject({ count: 2, lastWeek: '2026-W47' });
    expect(rewardContext(s, '2026-11-17').previousWeeksRun).toBe(1);
    expect(rewardContext(s, '2026-11-17').isFirstOfWeek).toBe(false);
    s = ok(s, { type: 'SYNC' }, '2026-12-07T10:00:00').state; // pulou semanas
    expect(rewardContext(s, '2026-12-07').previousWeeksRun).toBe(0);
    s = ok(s, contribution(5_000, '2026-12-07'), '2026-12-07T10:00:00').state;
    expect(s.weekRun).toMatchObject({ count: 1, best: 2 });
  });
});

describe('bug 14: editar e excluir aportes', () => {
  function withEntry(): { s: GameState; id: string } {
    const r = ok(fresh(AM), contribution(150_000, TUE), AM);
    const e = r.events.find((x) => x.type === 'entryAdded');
    return { s: r.state, id: e?.type === 'entryAdded' ? e.entry.id : '' };
  }

  it('editar recalcula totais sem mexer no XP', () => {
    const { s, id } = withEntry();
    const r = ok(
      s,
      { type: 'EDIT_ENTRY', id, patch: { amountCents: 15_000, note: ' corrigido ' } },
      AM,
    );
    expect(totalInvested(r.state.entries)).toBe(15_000);
    expect(r.state.xp).toBe(s.xp);
    expect(r.state.entries[0]).toMatchObject({
      note: 'corrigido',
      updatedAt: sp(AM).toISOString(),
    });
    const cleared = ok(r.state, { type: 'EDIT_ENTRY', id, patch: { note: '' } }, AM);
    expect(cleared.state.entries[0]?.note).toBeUndefined();
    const moved = ok(
      s,
      { type: 'EDIT_ENTRY', id, patch: { day: '2026-11-10', category: 'fii' } },
      AM,
    );
    expect(moved.state.entries[0]).toMatchObject({ day: '2026-11-10', category: 'fii' });
  });

  it('edição valida valor, data e nota', () => {
    const { s, id } = withEntry();
    expect(act(s, { type: 'EDIT_ENTRY', id, patch: { amountCents: 10 } }, AM).error).toBe(
      'below-min',
    );
    expect(act(s, { type: 'EDIT_ENTRY', id, patch: { day: '2027-01-01' } }, AM).error).toBe(
      'future-date',
    );
    expect(act(s, { type: 'EDIT_ENTRY', id, patch: { note: 'x'.repeat(81) } }, AM).error).toBe(
      'invalid-note',
    );
    expect(act(s, { type: 'EDIT_ENTRY', id: 'nope', patch: {} }, AM).error).toBe('entry-not-found');
    // manter a data original antiga é permitido mesmo depois de 30 dias
    const later = ok(
      s,
      { type: 'EDIT_ENTRY', id, patch: { day: TUE, amountCents: 150_000 } },
      '2027-01-30T10:00:00',
    );
    expect(later.error).toBeUndefined();
  });

  it('excluir reavalia metas e meta resgatada não paga de novo', () => {
    const { s, id } = withEntry();
    const claimed = ok(s, { type: 'CLAIM_GOAL', id: 'g-1k' }, AM).state;
    const del = ok(claimed, { type: 'DELETE_ENTRY', id }, AM);
    expect(totalInvested(del.state.entries)).toBe(0);
    expect(del.state.xp).toBe(claimed.xp);
    expect(act(del.state, { type: 'CLAIM_GOAL', id: 'g-1k' }, AM).error).toBe('already-claimed');
    const back = ok(del.state, contribution(200_000, TUE), AM).state;
    expect(act(back, { type: 'CLAIM_GOAL', id: 'g-1k' }, AM).error).toBe('already-claimed');
    expect(act(back, { type: 'CLAIM_GOAL', id: 'g-10k' }, AM).error).toBe('not-reached');
    expect(act(back, { type: 'CLAIM_GOAL', id: 'nope' }, AM).error).toBe('not-found');
    expect(act(back, { type: 'DELETE_ENTRY', id: 'nope' }, AM).error).toBe('entry-not-found');
  });
});

describe('bug 15: resgates', () => {
  it('resgate reduz o patrimônio e não rende XP', () => {
    let s = ok(fresh(AM), contribution(100_000, TUE), AM).state;
    const xp = s.xp;
    s = ok(s, withdrawal(30_000, TUE), AM).state;
    expect(totalInvested(s.entries)).toBe(70_000);
    expect(s.xp).toBe(xp);
  });

  it('não permite saldo negativo (resgatar, editar ou excluir)', () => {
    let s = ok(fresh(AM), contribution(10_000, TUE), AM).state;
    expect(act(s, withdrawal(20_000, TUE), AM).error).toBe('negative-balance');
    expect(act(s, withdrawal(5_000, TUE, 'acoes'), AM).error).toBe('negative-balance');
    const r = ok(s, withdrawal(5_000, TUE), AM);
    s = r.state;
    const cId = s.entries.find((e) => e.kind === 'contribution')!.id;
    expect(act(s, { type: 'DELETE_ENTRY', id: cId }, AM).error).toBe('negative-balance');
    expect(act(s, { type: 'EDIT_ENTRY', id: cId, patch: { amountCents: 1_000 } }, AM).error).toBe(
      'negative-balance',
    );
  });
});

describe('metas personalizadas, perfil e onboarding', () => {
  it('criar, editar, excluir e resgatar meta personalizada', () => {
    let s = fresh(AM);
    const add = ok(s, { type: 'ADD_GOAL', goal: { name: 'Viagem', targetCents: 10_000 } }, AM);
    const id = add.state.goals.at(-1)!.id;
    s = ok(
      add.state,
      { type: 'EDIT_GOAL', id, goal: { name: 'Viagem 2', targetCents: 5_000 } },
      AM,
    ).state;
    expect(s.goals.at(-1)).toMatchObject({ name: 'Viagem 2', targetCents: 5_000 });
    s = ok(s, contribution(5_000, TUE), AM).state;
    const claim = ok(s, { type: 'CLAIM_GOAL', id }, AM);
    expect(claim.events).toContainEqual({
      type: 'achievement',
      id: 'custom-goal',
      title: 'Meta Pessoal',
    });
    expect(
      act(claim.state, { type: 'EDIT_GOAL', id, goal: { name: 'x', targetCents: 100 } }, AM).error,
    ).toBe('already-claimed');
    const del = ok(claim.state, { type: 'DELETE_GOAL', id }, AM);
    expect(del.state.goals.some((g) => g.id === id)).toBe(false);
  });

  it('erros de metas', () => {
    const s = fresh(AM);
    expect(act(s, { type: 'ADD_GOAL', goal: { name: '', targetCents: 100 } }, AM).error).toBe(
      'invalid-name',
    );
    expect(
      act(s, { type: 'EDIT_GOAL', id: 'g-1k', goal: { name: 'a', targetCents: 100 } }, AM).error,
    ).toBe('not-custom');
    expect(
      act(s, { type: 'EDIT_GOAL', id: 'nope', goal: { name: 'a', targetCents: 100 } }, AM).error,
    ).toBe('not-found');
    expect(act(s, { type: 'DELETE_GOAL', id: 'g-1k' }, AM).error).toBe('not-custom');
    expect(act(s, { type: 'DELETE_GOAL', id: 'nope' }, AM).error).toBe('not-found');
    let many = s;
    for (let i = 0; i < 20; i++) {
      many = ok(many, { type: 'ADD_GOAL', goal: { name: `m${i}`, targetCents: 100 } }, AM).state;
    }
    expect(act(many, { type: 'ADD_GOAL', goal: { name: 'x', targetCents: 100 } }, AM).error).toBe(
      'too-many-goals',
    );
    const custom = ok(s, { type: 'ADD_GOAL', goal: { name: 'a', targetCents: 100 } }, AM).state;
    const cid = custom.goals.at(-1)!.id;
    expect(
      act(custom, { type: 'EDIT_GOAL', id: cid, goal: { name: '', targetCents: 100 } }, AM).error,
    ).toBe('invalid-name');
  });

  it('perfil valida apelido, fuso, lembrete e valor máximo', () => {
    const s = fresh(AM);
    const p = (patch: object) => act(s, { type: 'UPDATE_PROFILE', patch } as never, AM);
    expect(p({ nickname: '   ' }).error).toBe('invalid-nickname');
    expect(p({ timeZone: 'Mars/Base' }).error).toBe('invalid-timezone');
    expect(p({ reminder: { enabled: true, hour: 24, minute: 0 } }).error).toBe('invalid-profile');
    expect(p({ maxAmountCents: 10 }).error).toBe('invalid-profile');
    const r = p({
      nickname: '  Ana   Lu ',
      timeZone: 'America/Manaus',
      haptics: false,
      reminder: { enabled: true, hour: 8, minute: 30 },
      maxAmountCents: 500_000,
    });
    expect(r.state.profile).toMatchObject({
      nickname: 'Ana Lu',
      timeZone: 'America/Manaus',
      haptics: false,
      reminder: { enabled: true, hour: 8, minute: 30 },
      maxAmountCents: 500_000,
    });
    expect(act(r.state, contribution(600_000, TUE), AM).error).toBe('above-max');
  });

  it('onboarding com primeira meta', () => {
    const s = fresh(AM);
    expect(act(s, { type: 'COMPLETE_ONBOARDING', nickname: '' }, AM).error).toBe(
      'invalid-nickname',
    );
    expect(
      act(
        s,
        { type: 'COMPLETE_ONBOARDING', nickname: 'Ana', firstGoal: { name: '', targetCents: 1 } },
        AM,
      ).error,
    ).toBe('invalid-name');
    const r = ok(
      s,
      {
        type: 'COMPLETE_ONBOARDING',
        nickname: 'Ana',
        firstGoal: { name: 'Reserva', targetCents: 300_000 },
      },
      AM,
    );
    expect(r.state.profile).toMatchObject({ nickname: 'Ana', onboarded: true });
    expect(r.state.goals.at(-1)).toMatchObject({ name: 'Reserva', kind: 'custom' });
    expect(ok(s, { type: 'COMPLETE_ONBOARDING', nickname: 'Bia' }, AM).state.goals).toHaveLength(3);
  });
});

describe('loja via engine e conquistas', () => {
  it('comprar, equipar, desequipar e erros', () => {
    let s = fresh(AM);
    const r = ok(s, { type: 'BUY', itemId: 'acc-glasses' }, AM);
    expect(r.events).toContainEqual({
      type: 'achievement',
      id: 'first-purchase',
      title: 'Estilo Próprio',
    });
    s = r.state;
    expect(ok(s, { type: 'UNEQUIP', slot: 'accessory' }, AM).state.equipped.accessory).toBeNull();
    expect(ok(s, { type: 'EQUIP', itemId: 'suit-basic' }, AM).events).toContainEqual({
      type: 'equipped',
      itemId: 'suit-basic',
      slot: 'suit',
    });
    expect(act(s, { type: 'BUY', itemId: 'suit-diamond' }, AM).error).toBe('insufficient-coins');
    expect(act(s, { type: 'EQUIP', itemId: 'pet-pig' }, AM).error).toBe('not-owned');
    expect(act(s, { type: 'UNEQUIP', slot: 'suit' }, AM).error).toBe('cannot-unequip-suit');
  });

  it('conquistas desbloqueiam uma vez', () => {
    const r = ok(fresh(AM), contribution(5_000, TUE), AM);
    expect(r.state.achievements).toContain('first-contribution');
    const again = ok(r.state, contribution(5_000, TUE), AM);
    expect(again.events.filter((e) => e.type === 'achievement')).toEqual([]);
  });

  it('diversificar em 3 categorias', () => {
    let s = fresh(AM);
    for (const c of ['cdb', 'acoes', 'fii'] as const)
      s = ok(s, contribution(5_000, TUE, c), AM).state;
    expect(s.achievements).toContain('diversify-3');
  });
});

describe('virada de semana e liga de treino', () => {
  it('fecha a semana, registra pódio e zera XP semanal', () => {
    let s = fresh(AM);
    s = { ...s, weekly: { ...s.weekly, xp: 5_000 } };
    const r = ok(s, { type: 'SYNC' }, '2026-11-23T08:00:00');
    expect(r.events).toContainEqual({ type: 'leagueWeekClosed', week: '2026-W47', position: 1 });
    expect(r.state.stats.leaguePodiums).toBe(1);
    expect(r.state.weekly).toMatchObject({ week: '2026-W48', xp: 0 });
    expect(r.state.achievements).toContain('league-podium');
  });

  it('semana sem XP não conta pódio', () => {
    const r = ok(fresh(AM), { type: 'SYNC' }, '2026-11-23T08:00:00');
    expect(r.state.stats.leaguePodiums).toBe(0);
  });

  it('domingo 23h ainda é a mesma semana no fuso do usuário', () => {
    const r = ok(fresh(AM), { type: 'SYNC' }, '2026-11-22T23:00:00');
    expect(r.state.weekly.week).toBe('2026-W47');
  });

  it('erro numa ação mantém a virada de dia e descarta o resto', () => {
    const s = ok(fresh(AM), { type: 'OPEN_CHEST' }, AM).state;
    const r = act(s, contribution(1, '2026-11-18'), '2026-11-18T10:00:00');
    expect(r.error).toBe('below-min');
    expect(r.state.daily.day).toBe('2026-11-18');
    expect(r.state.entries).toEqual([]);
  });

  it('sync sem lista de eventos', () => {
    expect(sync(fresh(AM), sp(AM)).daily.day).toBe(TUE);
  });
});
