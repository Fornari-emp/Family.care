import {
  addFreeze,
  displayStreak,
  emptyStreak,
  MAX_FREEZES,
  reconcileStreak,
  registerValidAction,
  streakStatus,
  weekDots,
} from '@/domain/streak';
import type { StreakState } from '@/domain/types';

const at = (count: number, last: string, freezes = 0): StreakState => ({
  ...emptyStreak(),
  count,
  best: count,
  lastActiveDay: last,
  freezes,
});

describe('sequência diária (bug 6)', () => {
  it('primeira ação inicia em 1 e é idempotente no mesmo dia', () => {
    const a = registerValidAction(emptyStreak(), '2026-11-17');
    expect(a.extended).toBe(true);
    expect(a.streak).toMatchObject({ count: 1, best: 1, lastActiveDay: '2026-11-17' });
    const b = registerValidAction(a.streak, '2026-11-17');
    expect(b.extended).toBe(false);
    expect(b.streak.count).toBe(1);
  });

  it('dia seguinte soma 1', () => {
    expect(registerValidAction(at(4, '2026-11-16'), '2026-11-17').streak.count).toBe(5);
  });

  it('dia pulado sem congelamento zera e recomeça em 1', () => {
    const rec = reconcileStreak(at(4, '2026-11-15'), '2026-11-17');
    expect(rec.broken).toBe(true);
    expect(rec.streak.count).toBe(0);
    const r = registerValidAction(at(4, '2026-11-15'), '2026-11-17');
    expect(r.streak.count).toBe(1);
    expect(r.streak.best).toBe(4);
  });

  it('congelamento salva 1 dia perdido', () => {
    const rec = reconcileStreak(at(4, '2026-11-15', 1), '2026-11-17');
    expect(rec.broken).toBe(false);
    expect(rec.frozenUsed).toEqual(['2026-11-16']);
    expect(rec.streak).toMatchObject({ freezes: 0, count: 4, lastActiveDay: '2026-11-16' });
    expect(rec.streak.frozenDays).toEqual(['2026-11-16']);
    expect(registerValidAction(at(4, '2026-11-15', 1), '2026-11-17').streak.count).toBe(5);
  });

  it('dois congelamentos salvam dois dias; se faltar, não gasta à toa', () => {
    expect(reconcileStreak(at(4, '2026-11-14', 2), '2026-11-17').frozenUsed).toHaveLength(2);
    const rec = reconcileStreak(at(4, '2026-11-13', 2), '2026-11-17');
    expect(rec.broken).toBe(true);
    expect(rec.streak.freezes).toBe(2);
  });

  it('sem sequência ou sem atraso não muda nada', () => {
    const s = emptyStreak();
    expect(reconcileStreak(s, '2026-11-17').streak).toBe(s);
    const t = at(2, '2026-11-16');
    expect(reconcileStreak(t, '2026-11-17').streak).toBe(t);
  });

  it('abrir o app não conta: só o status muda', () => {
    expect(streakStatus(at(3, '2026-11-16'), '2026-11-17')).toBe('at-risk');
    expect(streakStatus(at(3, '2026-11-17'), '2026-11-17')).toBe('safe');
    expect(streakStatus(at(3, '2026-11-14'), '2026-11-17')).toBe('none');
    expect(displayStreak(at(3, '2026-11-14'), '2026-11-17')).toBe(0);
    expect(displayStreak(at(3, '2026-11-16'), '2026-11-17')).toBe(3);
  });

  it(`guarda no máximo ${MAX_FREEZES} congelamentos`, () => {
    const one = addFreeze(emptyStreak());
    const two = one && addFreeze(one);
    expect(two?.freezes).toBe(2);
    expect(two && addFreeze(two)).toBeNull();
  });

  it('pontinhos da semana mostram dias reais (segunda→domingo)', () => {
    const s: StreakState = {
      ...at(2, '2026-11-17'),
      activeDays: ['2026-11-16', '2026-11-17'],
      frozenDays: ['2026-11-18'],
    };
    const dots = weekDots(s, '2026-11-19').map((d) => d.state);
    expect(dots).toEqual(['done', 'done', 'frozen', 'today', 'future', 'future', 'future']);
    expect(weekDots(emptyStreak(), '2026-11-19')[0]?.state).toBe('missed');
  });

  it('histórico antigo é podado', () => {
    let s = emptyStreak();
    s = registerValidAction(s, '2026-01-01').streak;
    s = registerValidAction(s, '2026-11-17').streak;
    expect(s.activeDays).toEqual(['2026-11-17']);
  });
});
