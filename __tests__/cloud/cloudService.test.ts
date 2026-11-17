import { createCloudService, META_KEY } from '@/cloud/cloudService';
import type { Action } from '@/domain/engine';
import type { GameState } from '@/domain/types';
import { createGameStore } from '@/store/gameStore';
import type { KeyValueStorage } from '@/store/storage';
import { FakeCloudApi, FakeServer } from '../helpers/fakeCloud';
import { contribution, sp } from '../helpers/game';

const silent = { warn: jest.fn() };
const T = '2026-11-17';

class Mem implements KeyValueStorage {
  data = new Map<string, string>();
  async getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

/** Um aparelho: armazenamento local, store do jogo, API e serviço de nuvem próprios. */
async function device(server: FakeServer, iso = `${T}T10:00:00`) {
  let now = sp(iso);
  const storage = new Mem();
  let n = 0;
  const game = createGameStore({
    storage,
    clock: () => now,
    logger: silent,
    newId: () => `${Math.random().toString(36).slice(2)}-${++n}`,
  });
  await game.getState().hydrate();
  const api = new FakeCloudApi(server);
  const svc = createCloudService({ api, game, storage, clock: () => now, autoSyncDelayMs: 10 });
  const stop = await svc.init();
  return {
    game,
    api,
    svc,
    storage,
    stop,
    setTime: (i: string) => (now = sp(i)),
    act: (a: Action) => game.getState().dispatch(a),
    state: (): GameState => game.getState().state,
    login: () => svc.verifyCode('ana@example.com', '123456'),
  };
}

const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
afterAll(() => warn.mockRestore());

describe('login por código', () => {
  it('valida e-mail e código', async () => {
    const d = await device(new FakeServer());
    await expect(d.svc.sendCode('nao-e-email')).rejects.toMatchObject({ kind: 'invalid-email' });
    await d.svc.sendCode('  Ana@Example.com ');
    expect(d.api.sentCodes).toEqual(['ana@example.com']);
    await expect(d.svc.verifyCode('ana@example.com', '12')).rejects.toMatchObject({
      kind: 'invalid-code',
    });
    await expect(d.svc.verifyCode('ana@example.com', '000000')).rejects.toMatchObject({
      kind: 'invalid-code',
    });
    expect(d.svc.store.getState().status).toBe('signed-out');
    await d.login();
    expect(d.svc.store.getState()).toMatchObject({ status: 'idle', user: { id: 'user-1' } });
    d.stop();
  });
});

describe('primeira sincronização', () => {
  it('sem dados na nuvem: envia o estado do aparelho', async () => {
    const server = new FakeServer();
    const d = await device(server);
    d.act(contribution(10_000, T));
    await d.login();
    expect(server.states.get('user-1')?.revision).toBe(1);
    expect(d.svc.store.getState().lastSyncedAt).not.toBeNull();
    expect(JSON.parse(d.storage.data.get(META_KEY)!)).toMatchObject({
      userId: 'user-1',
      revision: 1,
    });
    d.stop();
  });

  it('aparelho novo (intocado) recebe os dados da nuvem', async () => {
    const server = new FakeServer();
    const a = await device(server);
    a.act(contribution(10_000, T));
    await a.login();
    const b = await device(server);
    await b.login();
    expect(b.state().entries).toEqual(a.state().entries);
    expect(b.state().xp).toBe(a.state().xp);
    a.stop();
    b.stop();
  });

  it('dados nos dois lados: pede a escolha e aplica cada opção', async () => {
    for (const choice of ['use-cloud', 'use-device', 'merge'] as const) {
      const server = new FakeServer();
      const a = await device(server);
      a.act(contribution(10_000, T, 'cdb'));
      await a.login();
      const b = await device(server, `${T}T11:00:00`);
      b.act(contribution(20_000, T, 'fii'));
      await b.login();
      expect(b.svc.store.getState().status).toBe('needs-choice');
      expect(b.svc.store.getState().choice).toMatchObject({
        device: { entries: 1 },
        cloud: { entries: 1 },
      });
      await b.svc.resolveChoice(choice);
      expect(b.svc.store.getState().status).toBe('idle');
      const amounts = b
        .state()
        .entries.map((e) => e.amountCents)
        .sort();
      const expected = { 'use-cloud': [10_000], 'use-device': [20_000], merge: [10_000, 20_000] }[
        choice
      ];
      expect(amounts).toEqual(expected);
      const serverState = server.states.get('user-1')!.state as GameState;
      expect(serverState.entries.map((e) => e.amountCents).sort()).toEqual(expected);
      a.stop();
      b.stop();
    }
  });
});

describe('sincronização contínua entre dois aparelhos', () => {
  async function pair() {
    const server = new FakeServer();
    const a = await device(server);
    await a.login();
    const b = await device(server);
    await b.login();
    return { server, a, b };
  }

  it('aportes de cada aparelho chegam ao outro e exclusões não voltam', async () => {
    const { a, b } = await pair();
    a.act(contribution(11_000, T, 'cdb'));
    await a.svc.syncNow();
    b.act(contribution(22_000, T, 'fii'));
    await b.svc.syncNow();
    await a.svc.syncNow();
    expect(
      a
        .state()
        .entries.map((e) => e.amountCents)
        .sort(),
    ).toEqual([11_000, 22_000]);

    const id = a.state().entries.find((e) => e.amountCents === 11_000)!.id;
    a.act({ type: 'DELETE_ENTRY', id });
    await a.svc.syncNow();
    await b.svc.syncNow();
    expect(b.state().entries.map((e) => e.amountCents)).toEqual([22_000]);
    a.stop();
    b.stop();
  });

  it('conflito de revisão: tenta de novo e não perde dados', async () => {
    const { server, a } = await pair();
    a.act(contribution(5_000, T));
    server.raceOnPush = 1;
    await a.svc.syncNow();
    expect(a.svc.store.getState().status).toBe('idle');
    expect((server.states.get('user-1')!.state as GameState).entries).toHaveLength(1);
    a.stop();
  });

  it('conflito persistente vira erro amigável', async () => {
    const { server, a } = await pair();
    a.act(contribution(5_000, T));
    server.raceOnPush = 10;
    await a.svc.syncNow();
    expect(a.svc.store.getState()).toMatchObject({ status: 'error' });
    expect(a.svc.store.getState().error).toMatch(/Outro aparelho/);
    a.stop();
  });

  it('sem rede: erro amigável e dados locais intactos', async () => {
    const { server, a } = await pair();
    a.act(contribution(5_000, T));
    server.online = false;
    await a.svc.syncNow();
    expect(a.svc.store.getState().error).toMatch(/Sem conexão/);
    expect(a.state().entries).toHaveLength(1);
    server.online = true;
    await a.svc.syncNow();
    expect(a.svc.store.getState().status).toBe('idle');
    a.stop();
  });

  it('sincroniza sozinho pouco depois de uma ação', async () => {
    const { server, a } = await pair();
    a.act(contribution(7_000, T));
    await new Promise((r) => setTimeout(r, 60));
    await a.svc.syncNow();
    expect((server.states.get('user-1')!.state as GameState).entries[0]?.amountCents).toBe(7_000);
    a.stop();
  });

  it('dados inválidos ou de versão futura na nuvem não são aplicados', async () => {
    const { server, a } = await pair();
    server.states.set('user-1', { revision: 9, schemaVersion: 99, state: {} });
    await a.svc.syncNow();
    expect(a.svc.store.getState().error).toMatch(/versão mais nova/);
    server.states.set('user-1', { revision: 9, schemaVersion: 3, state: { lixo: true } });
    await a.svc.syncNow();
    expect(a.svc.store.getState().error).toMatch(/inválidos/);
    a.stop();
  });
});

describe('liga real', () => {
  it('só participa com opt-in; envia XP semanal e mostra o placar', async () => {
    const server = new FakeServer();
    const a = await device(server);
    await a.login();
    a.act({ type: 'READ_TIP' });
    await a.svc.syncNow();
    expect(server.league.size).toBe(0);
    expect(a.svc.store.getState().league).toBeNull();

    await a.svc.setPublicLeague(true);
    expect(a.state().profile.publicLeague).toBe(true);
    expect(a.svc.store.getState().league?.standings).toEqual([
      { position: 1, displayName: 'Investidor', xp: a.state().weekly.xp, isMe: true },
    ]);
    await a.svc.setPublicLeague(false);
    expect(server.league.size).toBe(0);
    expect(a.svc.store.getState().league).toBeNull();
    a.stop();
  });
});

describe('sair e excluir conta', () => {
  it('sair mantém os dados no aparelho', async () => {
    const server = new FakeServer();
    const a = await device(server);
    a.act(contribution(5_000, T));
    await a.login();
    await a.svc.signOut();
    expect(a.svc.store.getState()).toMatchObject({ status: 'signed-out', user: null });
    expect(a.state().entries).toHaveLength(1);
    expect(a.storage.data.get(META_KEY)).toBe('');
    a.stop();
  });

  it('excluir conta apaga a nuvem e mantém o aparelho', async () => {
    const server = new FakeServer();
    const a = await device(server);
    a.act(contribution(5_000, T));
    await a.login();
    await a.svc.setPublicLeague(true);
    await a.svc.deleteAccount();
    expect(server.states.size).toBe(0);
    expect(server.league.size).toBe(0);
    expect(a.state().entries).toHaveLength(1);
    expect(a.svc.store.getState().status).toBe('signed-out');
    a.stop();
  });

  it('sem login, sincronizar não faz nada', async () => {
    const server = new FakeServer();
    const a = await device(server);
    await a.svc.syncNow();
    expect(server.states.size).toBe(0);
    a.stop();
  });
});
