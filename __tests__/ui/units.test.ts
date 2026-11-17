import { sparkPath } from '@/components/Sparkline';
import type { GameEvent } from '@/domain/engine';
import { mapEvents } from '@/feedback/mapEvents';
import {
  formatDay,
  greeting,
  plural,
  relativeDay,
  spokenDuration,
  weekdayLetter,
  weekdayName,
} from '@/ui/format';
import { errorMessage } from '@/ui/messages';

const entry = {
  id: 'e',
  kind: 'contribution' as const,
  amountCents: 100,
  category: 'cdb' as const,
  day: '2026-11-17',
  createdAt: 'x',
};

describe('mapEvents', () => {
  it('vários level-ups numa ação viram um overlay com o nível final (bug 10)', () => {
    const fb = mapEvents([
      { type: 'reward', source: 'Meta', xp: 600, coins: 1200 },
      { type: 'levelUp', from: 1, to: 3, levels: 2, bonusCoins: 200 },
      { type: 'reward', source: 'Missão', xp: 60, coins: 25 },
      { type: 'levelUp', from: 3, to: 4, levels: 1, bonusCoins: 100 },
    ]);
    expect(fb.levelUp).toEqual({ level: 4, levels: 3, bonusCoins: 300 });
    expect(fb.burst).toBe(true);
    expect(fb.sound).toBe('up');
    expect(fb.haptic).toBe('success');
    expect(fb.toasts[0]).toEqual({ message: 'Meta  +600 XP · +1200 moedas', tone: 'xp' });
  });

  it('cobre todos os eventos relevantes com mensagens', () => {
    const events: GameEvent[] = [
      { type: 'reward', source: 'Semanal', xp: 0, coins: 250 },
      { type: 'reward', source: 'nada', xp: 0, coins: 0 },
      { type: 'achievement', id: 'a', title: 'Pódio' },
      { type: 'chestOpened', coins: 60, xp: 50 },
      { type: 'streakExtended', count: 1 },
      { type: 'streakExtended', count: 3 },
      { type: 'streakFrozen', days: ['2026-11-16'] },
      { type: 'streakBroken' },
      { type: 'entryAdded', entry: { ...entry, kind: 'withdrawal' }, reward: null },
      {
        type: 'entryAdded',
        entry,
        reward: {
          xp: 0,
          coins: 0,
          note: 'retroactive',
          breakdown: { base: 40, volume: 0, firstOfWeek: 0, multiplier: 1, slot: 0 },
        },
      },
      {
        type: 'entryAdded',
        entry,
        reward: {
          xp: 0,
          coins: 0,
          note: 'daily-limit',
          breakdown: { base: 40, volume: 0, firstOfWeek: 0, multiplier: 1, slot: 0 },
        },
      },
      { type: 'entryUpdated', entry },
      { type: 'entryDeleted', id: 'e' },
      { type: 'purchase', itemId: 'x', spent: 1 },
      { type: 'leagueWeekClosed', week: '2026-W47', position: 2 },
      { type: 'reset' },
      { type: 'tipRead' },
    ];
    const msgs = mapEvents(events).toasts.map((t) => t.message);
    expect(msgs).toEqual([
      'Semanal  +250 moedas',
      'Conquista: Pódio',
      'Sequência: 1 dia',
      'Sequência: 3 dias',
      'Congelamento usado em 16/11',
      'Sua sequência recomeçou. Bora de novo!',
      'Resgate registrado',
      'Aporte registrado (data passada não rende XP)',
      'Aporte registrado (limite diário de XP atingido)',
      'Registro atualizado',
      'Registro excluído',
      'Item adquirido!',
      'Semana encerrada: você ficou em 2º na liga de treino',
      'Progresso reiniciado',
    ]);
    expect(mapEvents([{ type: 'purchase', itemId: 'x', spent: 1 }])).toMatchObject({
      sound: 'coin',
      haptic: 'light',
    });
    expect(mapEvents([])).toMatchObject({ sound: null, haptic: null, levelUp: null, chest: null });
  });
});

describe('formatação', () => {
  it('datas e dias', () => {
    expect(formatDay('2026-11-07')).toBe('07/11');
    expect(formatDay('2025-11-07', '2026-01-02')).toBe('07/11/2025');
    expect(relativeDay('2026-11-17', '2026-11-17')).toBe('Hoje');
    expect(relativeDay('2026-11-16', '2026-11-17')).toBe('Ontem');
    expect(relativeDay('2026-11-10', '2026-11-17')).toBe('10/11');
    expect(weekdayLetter('2026-11-16')).toBe('S');
    expect(weekdayName('2026-11-22')).toBe('domingo');
  });
  it('saudação pela hora local', () => {
    expect(greeting(new Date('2026-11-17T12:00:00Z'), 'America/Sao_Paulo', 'Ana')).toBe(
      'Bom dia, Ana!',
    );
    expect(greeting(new Date('2026-11-17T18:00:00Z'), 'America/Sao_Paulo', 'Ana')).toBe(
      'Boa tarde, Ana!',
    );
    expect(greeting(new Date('2026-11-18T00:30:00Z'), 'America/Sao_Paulo', 'Ana')).toBe(
      'Boa noite, Ana!',
    );
  });
  it('plural e duração falada', () => {
    expect(plural(1, 'dia', 'dias')).toBe('1 dia');
    expect(plural(1200, 'moeda', 'moedas')).toBe('1.200 moedas');
    expect(spokenDuration(5 * 60_000)).toBe('5 minutos');
    expect(spokenDuration(3 * 3600_000 + 60_000)).toBe('3 horas e 1 minuto');
  });
  it('toda mensagem de erro existe e é em português', () => {
    expect(errorMessage('below-min')).toBe('O valor mínimo é R$ 1,00.');
    expect(errorMessage('too-old')).toMatch(/30 dias/);
  });
});

describe('gráfico do total (item 16)', () => {
  it('usa só pontos reais', () => {
    expect(sparkPath([], 300, 66)).toBeNull();
    const one = sparkPath([1000], 300, 66)!;
    expect(one.line.match(/[ML]/g)).toHaveLength(2);
    const three = sparkPath([100, 300, 200], 300, 66)!;
    expect(three.line.match(/[ML]/g)).toHaveLength(3);
    expect(three.area.endsWith('Z')).toBe(true);
  });
});
