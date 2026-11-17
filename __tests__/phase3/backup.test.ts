import { applyAction } from '@/domain/engine';
import { createGameStore } from '@/store/gameStore';
import { exportBackup, importBackup } from '@/store/backup';
import { STORAGE_KEY, type KeyValueStorage } from '@/store/storage';
import { contribution, ok, fresh, sp } from '../helpers/game';

const NOW = sp('2026-11-17T10:00:00');
const silent = { warn: jest.fn() };

class Mem implements KeyValueStorage {
  data = new Map<string, string>();
  async getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

/** Estado "rico": aportes, resgate, metas, compras, sequência, conquistas. */
function richState() {
  let s = { ...fresh('2026-11-16T10:00:00'), coins: 5000 };
  s = ok(
    s,
    contribution(150_000, '2026-11-16', 'fii', { note: 'primeiro' }),
    '2026-11-16T10:00:00',
  ).state;
  s = ok(s, { type: 'READ_TIP' }, '2026-11-16T11:00:00').state;
  s = ok(s, contribution(30_000, '2026-11-17', 'acoes'), '2026-11-17T09:00:00').state;
  s = ok(s, contribution(20_000, '2026-11-10', 'cdb'), '2026-11-17T09:05:00').state;
  s = ok(
    s,
    {
      type: 'ADD_ENTRY',
      entry: { kind: 'withdrawal', amountCents: 10_000, category: 'fii', day: '2026-11-17' },
    },
    '2026-11-17T09:10:00',
  ).state;
  s = ok(
    s,
    {
      type: 'ADD_GOAL',
      goal: { name: 'Viagem', targetCents: 500_000, deadline: '2027-06-01', category: 'fii' },
    },
    '2026-11-17T09:20:00',
  ).state;
  s = ok(s, { type: 'CLAIM_GOAL', id: 'g-1k' }, '2026-11-17T09:30:00').state;
  s = ok(s, { type: 'BUY', itemId: 'pet-pig' }, '2026-11-17T09:40:00').state;
  s = ok(s, { type: 'BUY', itemId: 'streak-freeze' }, '2026-11-17T09:41:00').state;
  s = ok(s, { type: 'OPEN_CHEST' }, '2026-11-17T09:50:00').state;
  s = ok(
    s,
    {
      type: 'UPDATE_PROFILE',
      patch: { nickname: 'Ana', reminder: { enabled: true, hour: 21, minute: 30 } },
    },
    '2026-11-17T09:55:00',
  ).state;
  return s;
}

describe('aceite da Fase 3: importar o próprio backup restaura o estado idêntico', () => {
  it('export → import devolve exatamente o mesmo estado', () => {
    const s = richState();
    const raw = exportBackup(s, NOW);
    const r = importBackup(raw, NOW);
    if (!r.ok) throw new Error(r.message);
    expect(r.state).toEqual(s);
    expect(r.migrated).toBe(false);
    expect(r.summary).toMatchObject({ entries: 4, nickname: 'Ana', savedAt: NOW.toISOString() });
  });

  it('pela store: exportar, reiniciar, importar e recarregar do armazenamento', async () => {
    const storage = new Mem();
    const store = createGameStore({ storage, clock: () => NOW, logger: silent });
    await store.getState().hydrate();
    await store.getState().importState(richState());
    const original = store.getState().state;
    const raw = exportBackup(original, NOW);

    store.getState().dispatch({ type: 'RESET', confirmation: 'REINICIAR' });
    expect(store.getState().state.entries).toEqual([]);

    const r = importBackup(raw, NOW);
    if (!r.ok) throw new Error(r.message);
    await store.getState().importState(r.state);
    expect(store.getState().state).toEqual(original);

    const reloaded = createGameStore({ storage, clock: () => NOW, logger: silent });
    await reloaded.getState().hydrate();
    expect(reloaded.getState().state).toEqual(original);
    expect(storage.data.get(STORAGE_KEY)).toContain('"schemaVersion":1');
  });

  it('o estado importado continua jogável', () => {
    const r = importBackup(exportBackup(richState(), NOW), NOW);
    if (!r.ok) throw new Error(r.message);
    expect(
      applyAction(r.state, { type: 'READ_TIP' }, { now: NOW, newId: () => 'x' }).error,
    ).toBeUndefined();
  });
});

describe('importação recusa conteúdo inválido sem tocar no estado', () => {
  it.each([
    ['', 'Cole o conteúdo do backup.'],
    ['   ', 'Cole o conteúdo do backup.'],
    ['{nope', 'O texto não é um JSON válido. Copie o backup inteiro.'],
    ['{"foo":1}', 'Esse arquivo não é um backup válido do Invest Level.'],
    [
      JSON.stringify({ schemaVersion: 9, data: {} }),
      'Esse backup é de uma versão mais nova do app. Atualize o app e tente de novo.',
    ],
    [
      JSON.stringify({ schemaVersion: 1, data: { xp: 1 } }),
      'Esse arquivo não é um backup válido do Invest Level.',
    ],
    ['x'.repeat(5_000_001), 'Backup grande demais.'],
  ])('%#', (raw, message) => {
    expect(importBackup(raw, NOW)).toEqual({ ok: false, message });
  });

  it('backup do protótipo (v0) é migrado', () => {
    const r = importBackup(
      JSON.stringify({
        investments: [{ id: '1', amount: 10, date: '2026-11-01', category: 'CDB' }],
        xp: 5,
      }),
      NOW,
    );
    expect(r.ok && r.migrated).toBe(true);
    expect(r.ok && r.summary.savedAt).toBeNull();
  });
});
