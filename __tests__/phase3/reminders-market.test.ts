import {
  reminderInstant,
  reminderMessage,
  reminderSchedule,
  REMINDER_MESSAGES,
} from '@/domain/reminders';
import {
  CACHE_KEY,
  CACHE_TTL_MS,
  formatIndicator,
  INDICATORS,
  loadIndicators,
  parseSgs,
  readCache,
  sgsUrl,
} from '@/market/sgs';
import type { KeyValueStorage } from '@/store/storage';
import { sp } from '../helpers/game';

const SP = 'America/Sao_Paulo';
const cfg = { enabled: true, hour: 20, minute: 0 };

describe('lembrete diário', () => {
  it('desligado não agenda nada', () => {
    expect(
      reminderSchedule(sp('2026-11-17T10:00:00'), SP, { ...cfg, enabled: false }, false),
    ).toEqual([]);
  });

  it('agenda 7 dias no horário local, incluindo hoje se ainda não agiu', () => {
    const d = reminderSchedule(sp('2026-11-17T10:00:00'), SP, cfg, false);
    expect(d).toHaveLength(7);
    expect(d[0]!.toISOString()).toBe('2026-11-17T23:00:00.000Z'); // 20h em SP
    expect(d[6]!.toISOString()).toBe('2026-11-23T23:00:00.000Z');
  });

  it('pula hoje se a sequência já está garantida', () => {
    const d = reminderSchedule(sp('2026-11-17T10:00:00'), SP, cfg, true);
    expect(d).toHaveLength(6);
    expect(d[0]!.toISOString()).toBe('2026-11-18T23:00:00.000Z');
  });

  it('não agenda horário que já passou hoje', () => {
    const d = reminderSchedule(sp('2026-11-17T21:00:00'), SP, cfg, false);
    expect(d[0]!.toISOString()).toBe('2026-11-18T23:00:00.000Z');
  });

  it('respeita outro fuso', () => {
    expect(reminderInstant('2026-11-17', 8, 30, 'America/Manaus').toISOString()).toBe(
      '2026-11-17T12:30:00.000Z',
    );
  });

  it('mensagens não falam de ativos', () => {
    expect(REMINDER_MESSAGES).toContain(reminderMessage('2026-11-17'));
    for (const m of REMINDER_MESSAGES) expect(m).not.toMatch(/compre|invista em/i);
  });
});

class Mem implements KeyValueStorage {
  data = new Map<string, string>();
  failWrite = false;
  async getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    if (this.failWrite) throw new Error('x');
    this.data.set(k, v);
  }
}

const okFetch = (byCode: Record<number, unknown>) =>
  jest.fn(async (url: string) => {
    const code = Number(/sgs\.(\d+)\//.exec(url)?.[1]);
    return { ok: code in byCode, json: async () => byCode[code] };
  });

describe('indicadores do Banco Central (SGS)', () => {
  it('lê a resposta do SGS', () => {
    expect(parseSgs([{ data: '14/11/2026', valor: '15.00' }])).toEqual({
      value: 15,
      refDate: '2026-11-14',
    });
    expect(parseSgs([{ data: '14/11/2026', valor: '5,4321' }])?.value).toBe(5.4321);
    expect(parseSgs([])).toBeNull();
    expect(parseSgs({})).toBeNull();
    expect(parseSgs([{ data: '2026-11-14', valor: '1' }])).toBeNull();
    expect(parseSgs([{ data: '14/11/2026', valor: 'abc' }])).toBeNull();
    expect(parseSgs([{ data: 1, valor: '1' }])).toBeNull();
    expect(sgsUrl(432)).toBe(
      'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json',
    );
  });

  it('formata valores', () => {
    expect(formatIndicator(INDICATORS[0]!, 15)).toBe('15,00%');
    expect(formatIndicator(INDICATORS[3]!, 5.4321)).toBe('R$ 5,4321');
  });

  it('busca na rede, guarda cache com data e reaproveita por 12h', async () => {
    const storage = new Mem();
    const fetchFn = okFetch({
      432: [{ data: '14/11/2026', valor: '15.00' }],
      4389: [{ data: '14/11/2026', valor: '14.90' }],
      13522: [{ data: '01/10/2026', valor: '4.50' }],
      1: [{ data: '14/11/2026', valor: '5.40' }],
    });
    const now = new Date('2026-11-17T12:00:00Z');
    const a = await loadIndicators(storage, fetchFn, now);
    expect(a.source).toBe('network');
    expect(a.snapshot?.values).toHaveLength(4);
    expect(a.snapshot?.fetchedAt).toBe(now.toISOString());
    expect(fetchFn).toHaveBeenCalledTimes(4);

    const b = await loadIndicators(storage, fetchFn, new Date(now.getTime() + 3600_000));
    expect(b.source).toBe('cache');
    expect(fetchFn).toHaveBeenCalledTimes(4);

    const c = await loadIndicators(storage, fetchFn, new Date(now.getTime() + CACHE_TTL_MS + 1));
    expect(c.source).toBe('network');
    const forced = await loadIndicators(storage, fetchFn, now, true);
    expect(forced.source).toBe('network');
  });

  it('sem rede usa o cache antigo; sem cache, informa indisponível', async () => {
    const storage = new Mem();
    const offline = jest.fn(async () => {
      throw new Error('offline');
    });
    expect(await loadIndicators(storage, offline, new Date())).toEqual({
      snapshot: null,
      source: 'none',
    });
    storage.data.set(CACHE_KEY, JSON.stringify({ values: [], fetchedAt: '2026-01-01T00:00:00Z' }));
    expect((await loadIndicators(storage, offline, new Date())).source).toBe('stale-cache');
    const notOk = jest.fn(async () => ({ ok: false, json: async () => null }));
    expect((await loadIndicators(storage, notOk, new Date())).source).toBe('stale-cache');
  });

  it('cache corrompido é ignorado e falha ao gravar não quebra', async () => {
    const storage = new Mem();
    storage.data.set(CACHE_KEY, '{oops');
    expect(await readCache(storage)).toBeNull();
    storage.failWrite = true;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const r = await loadIndicators(
      storage,
      okFetch({ 432: [{ data: '14/11/2026', valor: '15' }] }),
      new Date(),
    );
    expect(r.source).toBe('network');
    expect(r.snapshot?.values).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
