/// <reference types="node" />
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { CHEST_XP } from '@/domain/chest';
import { CUSTOM_GOAL_REWARD, defaultGoals } from '@/domain/goals';
import { MAX_WEEKLY_XP } from '@/domain/league';
import { DAILY_MISSIONS } from '@/domain/missions';
import { DAILY_CONTRIBUTION_XP_CAP } from '@/domain/rewards';

describe('teto semanal de XP da liga', () => {
  it('é exatamente o máximo que as regras do jogo permitem', () => {
    const perDay =
      DAILY_CONTRIBUTION_XP_CAP + DAILY_MISSIONS.reduce((s, m) => s + m.xp, 0) + CHEST_XP;
    const goals = defaultGoals('x').reduce((s, g) => s + g.rewardXp, 0) + CUSTOM_GOAL_REWARD.xp;
    expect(MAX_WEEKLY_XP).toBe(7 * perDay + goals);
  });

  it('o SQL do servidor usa o mesmo teto', () => {
    const dir = join(__dirname, '../../supabase/migrations');
    const sql = readdirSync(dir)
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n');
    expect(sql).toContain(`max_weekly_xp constant int := ${MAX_WEEKLY_XP}`);
  });
});
