import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Share } from 'react-native';

import { applyAction } from '@/domain/engine';
import { defaultState } from '@/domain/state';
import type { GameState } from '@/domain/types';
import { feedbackStore } from '@/feedback/feedbackStore';
import { gameStore } from '@/store';
import { exportBackup } from '@/store/backup';
import { serialize, STORAGE_KEY } from '@/store/storage';

jest.setTimeout(30_000);

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
const state = () => gameStore.getState().state;

beforeEach(async () => {
  await AsyncStorage.clear();
  gameStore.setState({ hydrated: false });
  feedbackStore.setState({ toasts: [], levelUp: null, chest: null, burstKey: 0 });
  jest.clearAllMocks();
});

describe('backup pela interface', () => {
  it('exportar abre o compartilhamento com o JSON versionado', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await seed();
    await renderRouter('./app', { initialUrl: '/perfil' });
    await fireEvent.press(await screen.findByLabelText('Exportar backup'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const msg = share.mock.calls[0]![0] as { message: string };
    expect(JSON.parse(msg.message)).toMatchObject({
      schemaVersion: 2,
      data: { profile: { nickname: 'Ana' } },
    });
  });

  it('importar substitui o estado após confirmação', async () => {
    await seed();
    const other = applyAction(
      {
        ...defaultState(new Date()),
        profile: { ...defaultState(new Date()).profile, nickname: 'Bia', onboarded: true },
      },
      {
        type: 'ADD_ENTRY',
        entry: {
          kind: 'contribution',
          amountCents: 12_345,
          category: 'etf',
          day: defaultState(new Date()).daily.day,
        },
      },
      { now: new Date(), newId: () => 'imp-1' },
    ).state;
    await renderRouter('./app', { initialUrl: '/perfil' });
    await fireEvent.press(await screen.findByLabelText('Importar backup'));
    await fireEvent.changeText(await screen.findByLabelText('Conteúdo do backup'), 'lixo');
    await fireEvent.press(screen.getByLabelText('Verificar e importar'));
    expect(
      await screen.findByText('O texto não é um JSON válido. Copie o backup inteiro.'),
    ).toBeTruthy();
    expect(state().profile.nickname).toBe('Ana');

    await fireEvent.changeText(
      screen.getByLabelText('Conteúdo do backup'),
      exportBackup(other, new Date()),
    );
    await fireEvent.press(screen.getByLabelText('Verificar e importar'));
    expect(await screen.findByText('Substituir dados atuais?')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Importar'));
    await waitFor(() => expect(state().profile.nickname).toBe('Bia'));
    expect(state().entries).toEqual(other.entries);
  });
});

describe('lembrete diário pela interface', () => {
  it('ligar pede permissão, agenda e permite ajustar o horário', async () => {
    await seed();
    await renderRouter('./app', { initialUrl: '/perfil' });
    await fireEvent(await screen.findByLabelText('Lembrete diário'), 'valueChange', true);
    await waitFor(() => expect(state().profile.reminder.enabled).toBe(true));
    await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled());
    await fireEvent.press(screen.getByLabelText('Aumentar hora'));
    await fireEvent.press(screen.getByLabelText('Diminuir minutos'));
    expect(state().profile.reminder).toMatchObject({ hour: 21, minute: 45 });
  });

  it('permissão negada mantém desligado e avisa', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
    });
    await seed();
    await renderRouter('./app', { initialUrl: '/perfil' });
    await fireEvent(await screen.findByLabelText('Lembrete diário'), 'valueChange', true);
    await waitFor(() =>
      expect(
        feedbackStore
          .getState()
          .toasts.map((t) => t.message)
          .join(),
      ).toMatch(/Permissão de notificação negada/),
    );
    expect(state().profile.reminder.enabled).toBe(false);
  });
});

describe('metas personalizadas', () => {
  it('criar, editar e excluir pela tela Metas', async () => {
    await seed();
    await renderRouter('./app', { initialUrl: '/metas' });
    await fireEvent.press(await screen.findByLabelText('Nova meta'));
    await fireEvent.changeText(await screen.findByLabelText('Nome da meta'), 'Viagem');
    await fireEvent.changeText(screen.getByLabelText('Valor da meta'), '500000');
    await fireEvent.press(screen.getByLabelText(/^1 ano, até/));
    await fireEvent.press(screen.getByLabelText('Criar meta'));
    await waitFor(() =>
      expect(state().goals.at(-1)).toMatchObject({
        name: 'Viagem',
        targetCents: 500000,
        kind: 'custom',
      }),
    );
    expect(state().goals.at(-1)!.deadline).toBeDefined();

    await fireEvent.press(await screen.findByLabelText('Editar meta Viagem'));
    await fireEvent.changeText(await screen.findByLabelText('Nome da meta'), 'Viagem 2027');
    await fireEvent.press(screen.getByLabelText('Sem prazo'));
    await fireEvent.press(screen.getByLabelText('Salvar meta'));
    await waitFor(() => expect(state().goals.at(-1)).toMatchObject({ name: 'Viagem 2027' }));
    expect(state().goals.at(-1)!.deadline).toBeUndefined();

    await fireEvent.press(await screen.findByLabelText('Editar meta Viagem 2027'));
    await fireEvent.press(await screen.findByLabelText('Excluir meta'));
    await fireEvent.press(await screen.findByLabelText('Excluir'));
    await waitFor(() => expect(state().goals.some((g) => g.kind === 'custom')).toBe(false));
  });
});

describe('anti-farm de metas na interface', () => {
  it('meta alcançada com aporte de hoje mostra quando libera, sem botão de resgate', async () => {
    const s = defaultState(new Date());
    const today = s.daily.day;
    const withEntry = applyAction(
      { ...s, profile: { ...s.profile, onboarded: true } },
      {
        type: 'ADD_ENTRY',
        entry: { kind: 'contribution', amountCents: 100_000, category: 'cdb', day: today },
      },
      { now: new Date(), newId: () => 'e1' },
    ).state;
    await AsyncStorage.setItem(STORAGE_KEY, serialize(withEntry, new Date()));
    await renderRouter('./app', { initialUrl: '/metas' });
    expect(
      await screen.findByLabelText(
        /^Meta alcançada! Resgate a partir de .*aportes precisam de 3 dias/,
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/^Resgatar 200 moedas/)).toBeNull();
  });
});

describe('congelar sequência na loja', () => {
  it('compra até 2 e bloqueia o terceiro', async () => {
    await seed({ coins: 1000 });
    await renderRouter('./app', { initialUrl: '/loja' });
    for (let i = 0; i < 2; i++) {
      await fireEvent.press(
        await screen.findByLabelText('Comprar Congelar sequência por 300 moedas'),
      );
      await fireEvent.press(await screen.findByLabelText('Comprar'));
      await waitFor(() => expect(state().streak.freezes).toBe(i + 1));
    }
    expect(state().coins).toBe(400);
    expect(
      screen.getByLabelText('Congelar sequência: você já guarda o máximo de 2').props
        .accessibilityState.disabled,
    ).toBe(true);
  });
});

describe('indicadores', () => {
  it('sem rede mostra indisponível', async () => {
    await seed();
    await renderRouter('./app', { initialUrl: '/' });
    expect(await screen.findByText('Indisponível no momento. Verifique sua conexão.')).toBeTruthy();
  });

  it('com rede mostra valores, fonte e data', async () => {
    (globalThis.fetch as jest.Mock).mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => [
        { data: '14/11/2026', valor: url.includes('sgs.1/') ? '5.4321' : '15.00' },
      ],
    }));
    await seed();
    await renderRouter('./app', { initialUrl: '/' });
    expect(await screen.findByLabelText(/^Selic \(meta\): 15,00%/)).toBeTruthy();
    expect(screen.getByLabelText(/^Dólar \(venda\): R\$ 5,4321/)).toBeTruthy();
    expect(screen.getByText(/Fonte: Banco Central \(SGS\)/)).toBeTruthy();
    (globalThis.fetch as jest.Mock).mockImplementation(() => Promise.reject(new Error('offline')));
  });
});
