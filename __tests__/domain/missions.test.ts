import {
  claimWeekly,
  completeDailyByEvent,
  DAILY_MISSIONS,
  emptyDaily,
  emptyWeekly,
  WEEKLY_MISSIONS,
  weeklyProgress,
  weeklyStatus,
} from '@/domain/missions';
import type { WeeklyMissionId } from '@/domain/types';

describe('missões diárias', () => {
  it('cada evento conclui só a sua missão, uma vez', () => {
    const d = emptyDaily('2026-11-17');
    const a = completeDailyByEvent(d, 'tip-read');
    expect(a.completed.map((m) => m.id)).toEqual(['m-tip']);
    expect(a.daily.missionsDone).toEqual(['m-tip']);
    const b = completeDailyByEvent(a.daily, 'tip-read');
    expect(b.completed).toEqual([]);
    expect(b.daily).toBe(a.daily);
  });
  it('todas as missões têm rota para a tela certa', () => {
    expect(DAILY_MISSIONS.map((m) => m.route)).toEqual(['investir', 'investir', 'dica', 'metas']);
  });
});

describe('missões semanais', () => {
  it('progresso por métrica e limitado à meta', () => {
    const w = { ...emptyWeekly('2026-W47'), xp: 900, bestStreak: 3, contributionDays: ['a', 'b'] };
    expect(weeklyProgress(w, 'w-xp')).toBe(500);
    expect(weeklyProgress(w, 'w-streak')).toBe(3);
    expect(weeklyProgress(w, 'w-contribution-days')).toBe(2);
    expect(weeklyProgress(w, 'nope' as WeeklyMissionId)).toBe(0);
  });

  it('bug 4: resgate só quando concluída e uma única vez', () => {
    const w = emptyWeekly('2026-W47');
    expect(claimWeekly(w, 'w-xp')).toEqual({ error: 'not-complete' });
    const done = { ...w, xp: 500 };
    expect(weeklyStatus(done, 'w-xp')).toBe('claimable');
    const r = claimWeekly(done, 'w-xp');
    if ('error' in r) throw new Error(r.error);
    expect(r.coins).toBe(300);
    expect(weeklyStatus(r.weekly, 'w-xp')).toBe('claimed');
    expect(claimWeekly(r.weekly, 'w-xp')).toEqual({ error: 'already-claimed' });
    expect(claimWeekly(w, 'nope' as WeeklyMissionId)).toEqual({ error: 'not-found' });
    expect(weeklyStatus(w, 'nope' as WeeklyMissionId)).toBe('in-progress');
  });

  it('recompensas exibidas = recompensas pagas', () => {
    expect(WEEKLY_MISSIONS.map((m) => m.rewardCoins)).toEqual([250, 400, 300]);
  });
});
