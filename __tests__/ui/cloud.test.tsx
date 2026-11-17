/**
 * Telas da Fase 4 com a nuvem ligada (serviço real + Supabase falso em memória).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { defaultState } from '@/domain/state';
import type { GameState } from '@/domain/types';
import { feedbackStore } from '@/feedback/feedbackStore';
import { gameStore } from '@/store';
import { serialize, STORAGE_KEY } from '@/store/storage';
import type { FakeCloudApi, FakeServer } from '../helpers/fakeCloud';

jest.mock('@/cloud', () => {
  const { createCloudService } = jest.requireActual('@/cloud/cloudService');
  const { gameStore: game } = jest.requireActual('@/store');
  const { FakeCloudApi: Api, FakeServer: Server } = jest.requireActual('../helpers/fakeCloud');
  const { useStore } = jest.requireActual('zustand');
  const storage = jest.requireMock('@react-native-async-storage/async-storage');
  const server = new Server();
  const api = new Api(server);
  const cloud = createCloudService({ api, game, storage, autoSyncDelayMs: 50 });
  return {
    cloud,
    useCloud: (sel: (s: unknown) => unknown) => useStore(cloud.store, sel),
    __server: server,
    __api: api,
  };
});

const mocked = jest.requireMock('@/cloud') as {
  cloud: import('@/cloud/cloudService').CloudService;
  __server: FakeServer;
  __api: FakeCloudApi;
};

jest.setTimeout(30_000);
const state = () => gameStore.getState().state;

async function seed(patch: Partial<GameState> = {}) {
  const s = defaultState(new Date());
  await AsyncStorage.setItem(
    STORAGE_KEY,
    serialize(
      { ...s, ...patch, profile: { ...s.profile, onboarded: true, nickname: 'Ana' } },
      new Date(),
    ),
  );
}

// Deixa terminar sincronizações automáticas antes de desmontar a tela.
afterEach(async () => {
  await act(async () => {
    await mocked.cloud.syncNow();
  });
});

beforeEach(async () => {
  await AsyncStorage.clear();
  gameStore.setState({ hydrated: false });
  feedbackStore.setState({ toasts: [], levelUp: null, chest: null, burstKey: 0 });
  mocked.__server.states.clear();
  mocked.__server.league.clear();
  mocked.__api.user = null;
  await mocked.cloud.signOut().catch(() => undefined);
});

it('login por código no Perfil, sincroniza e mostra o status', async () => {
  await seed();
  await renderRouter('./app', { initialUrl: '/perfil' });
  expect(await screen.findByText(/ficam guardados na nuvem do Invest Level/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Seu e-mail'), 'ana@example.com');
  await fireEvent.press(screen.getByLabelText('Enviar código'));
  await fireEvent.changeText(await screen.findByLabelText('Código recebido'), '000000');
  await fireEvent.press(screen.getByLabelText('Entrar'));
  expect(await screen.findByText(CLOUD_INVALID)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Código recebido'), '123456');
  await fireEvent.press(screen.getByLabelText('Entrar'));
  expect(await screen.findByText('ana@example.com')).toBeTruthy();
  await waitFor(() => expect(mocked.__server.states.get('user-1')).toBeDefined());
  expect(await screen.findByText(/^Sincronizado em/)).toBeTruthy();
});

const CLOUD_INVALID = 'Código inválido ou expirado. Confira o e-mail ou peça outro código.';

it('liga com outras pessoas: opt-in mostra a liga real em Metas', async () => {
  await seed();
  await mocked.cloud.verifyCode('ana@example.com', '123456');
  await renderRouter('./app', { initialUrl: '/perfil' });
  await fireEvent(await screen.findByLabelText('Liga com outras pessoas'), 'valueChange', true);
  await waitFor(() => expect(state().profile.publicLeague).toBe(true));
  await fireEvent.press(screen.getByLabelText(/^Metas\./));
  expect(await screen.findByText('Liga semanal')).toBeTruthy();
  expect(screen.getByLabelText(/^1º lugar: você, Ana/)).toBeTruthy();
  expect(screen.queryByText('rival fictício')).toBeNull();
});

it('primeiro login com dados nos dois lados pergunta o que fazer', async () => {
  // nuvem já tem dados de outro aparelho
  const other = { ...defaultState(new Date()), xp: 999, updatedAt: new Date().toISOString() };
  mocked.__server.states.set('user-1', { revision: 4, schemaVersion: 3, state: other });
  await seed({ xp: 10, updatedAt: new Date().toISOString() });
  await renderRouter('./app', { initialUrl: '/perfil' });
  await screen.findByTestId('screen-perfil');
  await act(async () => {
    await mocked.cloud.verifyCode('ana@example.com', '123456');
  });
  expect(await screen.findByText('Você já tem dados nos dois lugares')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Usar os dados da nuvem'));
  await waitFor(() => expect(state().xp).toBe(999));
});

it('excluir conta exige digitar EXCLUIR e mantém os dados do aparelho', async () => {
  await seed({ coins: 777 });
  await mocked.cloud.verifyCode('ana@example.com', '123456');
  await renderRouter('./app', { initialUrl: '/perfil' });
  await fireEvent.press(await screen.findByLabelText('Excluir conta e dados da nuvem'));
  expect(screen.getByLabelText('Excluir conta').props.accessibilityState.disabled).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Digite EXCLUIR para confirmar'), 'EXCLUIR');
  await fireEvent.press(screen.getByLabelText('Excluir conta'));
  await waitFor(() => expect(mocked.__server.states.size).toBe(0));
  expect(state().coins).toBe(777);
  expect(await screen.findByLabelText('Seu e-mail')).toBeTruthy();
});
