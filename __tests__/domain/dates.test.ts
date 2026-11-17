import {
  addDays,
  dayKey,
  daysBetween,
  daysLeftInWeek,
  formatCountdown,
  hourIn,
  isValidDayKey,
  isValidTimeZone,
  isoWeekKey,
  mondayOf,
  msUntilNextDay,
  startOfDayInstant,
  weekDays,
  weekElapsedFraction,
  weekKeyOfDay,
  weekdayIndex,
} from '@/domain/dates';

const SP = 'America/Sao_Paulo';
/** Cria um instante a partir do horário de São Paulo (UTC-3, sem horário de verão). */
const sp = (iso: string) => new Date(`${iso}-03:00`);

describe('dayKey no fuso do usuário (bug 2)', () => {
  it.each(['2026-11-17T21:00:00', '2026-11-17T22:30:00', '2026-11-17T23:59:59'])(
    '%s em São Paulo ainda é 17/11 (UTC já seria 18/11)',
    (local) => {
      const now = sp(local);
      expect(now.toISOString().slice(0, 10)).toBe('2026-11-18'); // comportamento antigo
      expect(dayKey(now, SP)).toBe('2026-11-17');
    },
  );
  it('vira o dia exatamente à meia-noite local', () => {
    expect(dayKey(sp('2026-11-18T00:00:00'), SP)).toBe('2026-11-18');
  });
  it('respeita outros fusos', () => {
    const now = new Date('2026-11-18T01:30:00Z');
    expect(dayKey(now, 'UTC')).toBe('2026-11-18');
    expect(dayKey(now, 'America/Manaus')).toBe('2026-11-17');
    expect(hourIn(now, SP)).toBe(22);
  });
  it('usa São Paulo como padrão', () => {
    expect(dayKey(sp('2026-11-17T23:00:00'))).toBe('2026-11-17');
  });
});

describe('aritmética de dias', () => {
  it('addDays e daysBetween atravessam mês e ano', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(daysBetween('2027-01-02', '2026-12-30')).toBe(-3);
  });
  it('valida DayKey', () => {
    expect(isValidDayKey('2026-02-28')).toBe(true);
    expect(isValidDayKey('2026-02-29')).toBe(false);
    expect(isValidDayKey('2026-13-01')).toBe(false);
    expect(isValidDayKey('17/11/2026')).toBe(false);
    expect(() => addDays('nope', 1)).toThrow();
  });
  it('valida fuso', () => {
    expect(isValidTimeZone(SP)).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('semana ISO única (bug 5)', () => {
  it.each([
    ['2026-11-17', '2026-W47'],
    ['2026-11-22', '2026-W47'], // domingo pertence à mesma semana
    ['2026-11-23', '2026-W48'], // segunda abre nova semana
    ['2026-12-29', '2026-W53'],
    ['2027-01-01', '2026-W53'], // 1º/jan pode ser da semana do ano anterior
    ['2027-01-04', '2027-W01'],
    ['2024-12-30', '2025-W01'], // 30/dez pode ser da semana 1 do ano seguinte
    ['2021-01-03', '2020-W53'],
  ])('%s → %s', (day, week) => {
    expect(weekKeyOfDay(day)).toBe(week);
  });

  it('o cálculo antigo divergia da ISO', () => {
    const legacy = (d: Date) => {
      const onejan = new Date(d.getFullYear(), 0, 1);
      return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
    };
    // 1º/jan/2027 (sexta): antigo dizia semana 1 de 2027; ISO diz 2026-W53.
    expect(legacy(new Date(2027, 0, 1, 12))).toBe(1);
    expect(weekKeyOfDay('2027-01-01')).toBe('2026-W53');
  });

  it('isoWeekKey usa o fuso: domingo 22h em SP ainda é a semana que termina', () => {
    expect(isoWeekKey(sp('2026-11-22T22:00:00'), SP)).toBe('2026-W47');
  });

  it('weekdayIndex, mondayOf e weekDays (segunda→domingo)', () => {
    expect(weekdayIndex('2026-11-16')).toBe(0);
    expect(weekdayIndex('2026-11-22')).toBe(6);
    expect(mondayOf('2026-11-22')).toBe('2026-11-16');
    expect(weekDays('2026-11-19')).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
  });

  it('daysLeftInWeek usa a mesma semana (domingo = 0, segunda = 6)', () => {
    expect(daysLeftInWeek(sp('2026-11-22T23:00:00'), SP)).toBe(0);
    expect(daysLeftInWeek(sp('2026-11-16T08:00:00'), SP)).toBe(6);
    // antigo: 7 - getDay() no domingo dava 7
    expect(7 - new Date(2026, 10, 22).getDay()).toBe(7);
  });

  it('weekElapsedFraction vai de 0 a 1', () => {
    expect(weekElapsedFraction(sp('2026-11-16T00:00:00'), SP)).toBe(0);
    expect(weekElapsedFraction(sp('2026-11-19T12:00:00'), SP)).toBeCloseTo(3.5 / 7, 5);
    expect(weekElapsedFraction(sp('2026-11-22T23:59:59'), SP)).toBeGreaterThan(0.99);
  });
});

describe('contagem regressiva até meia-noite local', () => {
  it('às 21h faltam 3h (não 0h como no UTC)', () => {
    expect(msUntilNextDay(sp('2026-11-17T21:00:00'), SP)).toBe(3 * 3600_000);
  });
  it('startOfDayInstant converte meia-noite local para UTC', () => {
    expect(startOfDayInstant('2026-11-18', SP).toISOString()).toBe('2026-11-18T03:00:00.000Z');
  });
  it('formatCountdown', () => {
    expect(formatCountdown(3 * 3600_000 + 61_000)).toBe('03:01:01');
    expect(formatCountdown(-5)).toBe('00:00:00');
  });
});
