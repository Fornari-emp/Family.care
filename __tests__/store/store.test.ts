import { CURRENT_SCHEMA_VERSION } from '@/store/schema';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { defaultState } from '@/domain/state';
import { createGameStore } from '@/store/gameStore';
import { migrate } from '@/store/migrations';
import {
  CORRUPT_PREFIX,
  loadState,
  parseSaved,
  saveState,
  serialize,
  STORAGE_KEY,
  type KeyValueStorage,
  type Logger,
} from '@/store/storage';
import { gameStore } from '@/store';
import { contribution, sp } from '../helpers/game';

const NOW = sp('2026-11-17T10:00:00');
const silent: Logger = { warn: jest.fn() };

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  failWrites = false;
  async getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    if (this.failWrites) throw new Error('disk full');
    this.data.set(k, v);
  }
}

const PROTOTYPE_SAVE = {
  nickname: 'Matt',
  xp: 640,
  coins: 410,
  streak: 9,
  lastAccess: '2026-11-16',
  lastChest: '2026-11-16',
  weekXp: 200,
  weekKey: '2026-W47',
  investments: [
    { id: '1', amount: 1000.5, date: '2026-11-10', category: 'Fundo Imobiliário' },
    { id: '2', amount: 250, date: '2026-11-12', category: 'Ações' },
    { id: '3', amount: 0, date: '2026-11-12', category: 'CDB' },
    { id: '4', amount: 10, date: 'ontem', category: 'CDB' },
    'lixo',
  ],
  missions: [],
  weekly: [],
  goals: [
    { id: 'g1', claimed: true },
    { id: 'g2', claimed: false },
  ],
  achievements: [
    { id: 'a1', unlocked: true },
    { id: 'a4', unlocked: true },
    { id: 'a9', unlocked: true },
  ],
  ownedItems: ['suit-basic', 'acc-glasses', 'pet-unicorn'],
  equipped: {
    suit: 'suit-basic',
    accessory: 'acc-glasses',
    aura: '',
    pet: 'pet-unicorn',
    frame: '',
  },
  sound: false,
  haptics: true,
};

describe('persistência (item 25)', () => {
  it('serialize → parse devolve o mesmo estado', () => {
    const s = defaultState(NOW);
    const parsed = parseSaved(serialize(s, NOW), NOW);
    expect(parsed).toEqual({ ok: true, state: s, migrated: false });
  });

  it('armazenamento vazio começa do zero', async () => {
    const r = await loadState(new MemoryStorage(), NOW, silent);
    expect(r.status).toBe('empty');
    expect(r.state).toEqual(defaultState(NOW));
  });

  it.each([
    ['JSON quebrado', '{"schemaVersion":1,'],
    ['formato desconhecido', '{"foo":1}'],
    ['não é objeto', '[1,2,3]'],
    ['versão do futuro', JSON.stringify({ schemaVersion: 99, data: {} })],
    [
      'schema inválido',
      JSON.stringify({ schemaVersion: 1, data: { ...defaultState(NOW), xp: -5 } }),
    ],
  ])('%s: não trava, recomeça e guarda cópia', async (_label, raw) => {
    const storage = new MemoryStorage();
    storage.data.set(STORAGE_KEY, raw);
    const r = await loadState(storage, NOW, silent);
    expect(r.status).toBe('recovered');
    expect(r.state).toEqual(defaultState(NOW));
    expect(r.userMessage).toMatch(/cópia/);
    expect(storage.data.get(`${CORRUPT_PREFIX}${NOW.getTime()}`)).toBe(raw);
  });

  it('falha ao ler o armazenamento não trava', async () => {
    const storage: KeyValueStorage = {
      getItem: () => Promise.reject(new Error('io')),
      setItem: () => Promise.resolve(),
    };
    const r = await loadState(storage, NOW, silent);
    expect(r.status).toBe('recovered');
    expect(r.userMessage).toMatch(/armazenamento/);
  });

  it('falha ao guardar a cópia ainda devolve estado padrão', async () => {
    const storage = new MemoryStorage();
    storage.data.set(STORAGE_KEY, 'nope');
    storage.failWrites = true;
    const r = await loadState(storage, NOW, silent);
    expect(r.status).toBe('recovered');
    expect(r.backupKey).toBeUndefined();
  });

  it('saveState informa falha em vez de engolir o erro (item 26)', async () => {
    const storage = new MemoryStorage();
    expect(await saveState(storage, defaultState(NOW), NOW, silent)).toBe(true);
    storage.failWrites = true;
    const logger = { warn: jest.fn() };
    expect(await saveState(storage, defaultState(NOW), NOW, logger)).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('migração do protótipo (v0 → v1)', () => {
  it('converte reais em centavos, categorias, metas, conquistas e itens', async () => {
    const storage = new MemoryStorage();
    storage.data.set(STORAGE_KEY, JSON.stringify(PROTOTYPE_SAVE));
    const r = await loadState(storage, NOW, silent);
    expect(r.status).toBe('migrated');
    const s = r.state;
    expect(s.profile).toMatchObject({ nickname: 'Matt', onboarded: true, sound: false });
    expect(s.entries.map((e) => [e.amountCents, e.category, e.day])).toEqual([
      [100050, 'fii', '2026-11-10'],
      [25000, 'acoes', '2026-11-12'],
    ]);
    expect(s.xp).toBe(640);
    expect(s.coins).toBe(410);
    expect(s.streak).toMatchObject({ count: 0, best: 9 });
    expect(s.goals.find((g) => g.id === 'g-1k')?.claimed).toBe(true);
    expect(s.goals.find((g) => g.id === 'g-5k')?.claimed).toBe(false);
    expect(s.achievements).toEqual(['first-contribution', 'total-1k']);
    expect(s.ownedItems).toEqual(['suit-basic', 'acc-glasses']);
    expect(s.equipped).toEqual({
      suit: 'suit-basic',
      accessory: 'acc-glasses',
      aura: null,
      pet: null,
      frame: null,
    });
  });

  it('protótipo mínimo/sujo ainda migra com valores padrão', () => {
    const r = migrate({ investments: [], xp: 'abc', nickname: 42 }, NOW);
    if ('error' in r) throw new Error(r.error);
    expect(r.fromVersion).toBe(0);
    const d = r.data as ReturnType<typeof defaultState>;
    expect(d.xp).toBe(0);
    expect(d.coins).toBe(150);
    expect(d.profile.nickname).toBe('Investidor');
  });

  it('v1 → v2: adiciona o limite semanal de meta pessoal', async () => {
    const current = defaultState(NOW);
    const { customGoalRewarded: _omit, ...weeklyV1 } = current.weekly;
    const storage = new MemoryStorage();
    storage.data.set(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, data: { ...current, weekly: weeklyV1 } }),
    );
    const r = await loadState(storage, NOW, silent);
    expect(r.status).toBe('migrated');
    // v2 → v3 marca o estado local existente como atualizado "agora"
    expect(r.state).toEqual({ ...current, updatedAt: NOW.toISOString() });
    expect(migrate({ schemaVersion: 1, data: 'x' }, NOW)).toEqual({ data: 'x', fromVersion: 1 });
  });

  it('v2 → v3: campos de sincronização', async () => {
    const current = defaultState(NOW);
    const { tombstones: _t, updatedAt: _u, ...rest } = current;
    const { publicLeague: _p, ...profileV2 } = current.profile;
    const storage = new MemoryStorage();
    storage.data.set(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 2, data: { ...rest, profile: profileV2 } }),
    );
    const r = await loadState(storage, NOW, silent);
    expect(r.status).toBe('migrated');
    expect(r.state).toEqual({ ...current, updatedAt: NOW.toISOString() });
    expect(migrate({ schemaVersion: 2, data: 'x' }, NOW)).toEqual({ data: 'x', fromVersion: 2 });
  });

  it('formatos desconhecidos são recusados', () => {
    expect(migrate(null, NOW)).toEqual({ error: 'unknown-format' });
    expect(migrate({ schemaVersion: CURRENT_SCHEMA_VERSION + 1, data: {} }, NOW)).toEqual({
      error: 'future-version',
    });
  });
});

describe('store Zustand', () => {
  it('hidrata, despacha ações e persiste', async () => {
    const storage = new MemoryStorage();
    const store = createGameStore({ storage, clock: () => NOW, logger: silent });
    expect(store.getState().hydrated).toBe(false);
    await store.getState().hydrate();
    expect(store.getState().hydrated).toBe(true);

    const r = store.getState().dispatch(contribution(10_000, '2026-11-17'));
    expect(r.error).toBeUndefined();
    expect(store.getState().lastEvents.some((e) => e.type === 'entryAdded')).toBe(true);
    await store.getState().whenSaved();

    const reloaded = createGameStore({ storage, clock: () => NOW, logger: silent });
    await reloaded.getState().hydrate();
    expect(reloaded.getState().state).toEqual(store.getState().state);
  });

  it('ação com erro não altera nem salva', async () => {
    const storage = new MemoryStorage();
    const store = createGameStore({ storage, clock: () => NOW, logger: silent });
    await store.getState().hydrate();
    await store.getState().whenSaved();
    const saved = storage.data.get(STORAGE_KEY);
    const before = store.getState().state;
    const r = store.getState().dispatch(contribution(1, '2026-11-17'));
    expect(r.error).toBe('below-min');
    expect(store.getState().state).toBe(before);
    await store.getState().whenSaved();
    expect(storage.data.get(STORAGE_KEY)).toBe(saved);
  });

  it('dados corrompidos mostram aviso amigável e podem ser dispensados', async () => {
    const storage = new MemoryStorage();
    storage.data.set(STORAGE_KEY, '{oops');
    const store = createGameStore({ storage, clock: () => NOW, logger: silent });
    await store.getState().hydrate();
    expect(store.getState().issue).toMatch(/recomeçou/);
    store.getState().dismissIssue();
    expect(store.getState().issue).toBeNull();
  });

  it('falha ao salvar vira aviso para o usuário', async () => {
    const storage = new MemoryStorage();
    const store = createGameStore({ storage, clock: () => NOW, logger: silent });
    await store.getState().hydrate();
    storage.failWrites = true;
    store.getState().dispatch({ type: 'READ_TIP' });
    await store.getState().whenSaved();
    expect(store.getState().issue).toMatch(/salvar/);
  });

  it('instância do app usa AsyncStorage e ids únicos', async () => {
    await gameStore.getState().hydrate();
    gameStore.getState().dispatch(contribution(500, gameStore.getState().state.daily.day));
    gameStore.getState().dispatch(contribution(500, gameStore.getState().state.daily.day));
    await gameStore.getState().whenSaved();
    const ids = gameStore.getState().state.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toContain(
      `"schemaVersion":${CURRENT_SCHEMA_VERSION}`,
    );
  });
});
