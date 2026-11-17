/**
 * Testes de interface com o app inteiro (Expo Router + store real + AsyncStorage mock).
 * Inclui auditoria de acessibilidade: todo elemento tocável precisa de rótulo (item 21).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { defaultState } from '@/domain/state';
import type { GameState } from '@/domain/types';
import { feedbackStore } from '@/feedback/feedbackStore';
import { gameStore } from '@/store';
import { serialize, STORAGE_KEY } from '@/store/storage';

jest.setTimeout(30_000);

async function seed(patch: Partial<GameState> = {}, onboarded = true) {
  const s = defaultState(new Date());
  const state: GameState = {
    ...s,
    ...patch,
    profile: { ...s.profile, onboarded, nickname: 'Ana' },
  };
  await AsyncStorage.setItem(STORAGE_KEY, serialize(state, new Date()));
}

async function open(url: string) {
  await renderRouter('./app', { initialUrl: url });
}

/** Todo botão, opção e campo precisa ser anunciado com um rótulo (leitor de tela). */
function auditA11y() {
  const interactive = [
    ...screen.queryAllByRole('button'),
    ...screen.queryAllByRole('radio'),
    ...screen.queryAllByRole('switch'),
  ];
  expect(interactive.length).toBeGreaterThan(0);
  for (const el of interactive) {
    const label = el.props.accessibilityLabel as unknown;
    expect({ label, ok: typeof label === 'string' && label.trim().length > 0 }).toEqual({
      label,
      ok: true,
    });
  }
}

const state = () => gameStore.getState().state;

beforeEach(async () => {
  await AsyncStorage.clear();
  gameStore.setState({ hydrated: false });
  feedbackStore.setState({ toasts: [], levelUp: null, chest: null, burstKey: 0 });
});

describe('navegação e leitor de tela', () => {
  it.each([
    ['/', 'screen-home'],
    ['/investir', 'screen-investir'],
    ['/metas', 'screen-metas'],
    ['/loja', 'screen-loja'],
    ['/perfil', 'screen-perfil'],
  ])('%s: todos os elementos interativos têm rótulo', async (url, testID) => {
    await seed();
    await open(url);
    expect(await screen.findByTestId(testID)).toBeTruthy();
    auditA11y();
    // aviso legal visível em todas as abas (item 19)
    expect(screen.getAllByLabelText(/não é corretora/).length).toBeGreaterThan(0);
  });

  it('barra de abas fixa navega pelas 5 abas por rótulo', async () => {
    await seed();
    await open('/');
    await screen.findByTestId('screen-home');
    for (const [label, id] of [
      ['Investir', 'screen-investir'],
      ['Metas', 'screen-metas'],
      ['Loja', 'screen-loja'],
      ['Perfil', 'screen-perfil'],
      ['Início', 'screen-home'],
    ]) {
      await fireEvent.press(screen.getByLabelText(new RegExp(`^${label}\\.`)));
      expect(await screen.findByTestId(id as string)).toBeTruthy();
    }
  });

  it('tela da dica e onboarding também passam na auditoria', async () => {
    await seed();
    await open('/dica');
    await screen.findByText('Dica do dia');
    auditA11y();
  });
});

describe('onboarding', () => {
  it('redireciona quem não fez onboarding e conclui os 3 passos', async () => {
    await seed({}, false);
    await open('/');
    expect(await screen.findByText('Bem-vindo ao Invest Level')).toBeTruthy();
    expect(screen.getByText('Não é corretora e não movimenta dinheiro')).toBeTruthy();
    auditA11y();
    await fireEvent.press(screen.getByLabelText('Entendi, continuar'));
    await fireEvent.changeText(await screen.findByLabelText('Apelido'), 'Bia');
    await fireEvent.press(screen.getByLabelText('Continuar'));
    await fireEvent.changeText(await screen.findByLabelText('Valor da meta'), '300000');
    await fireEvent.press(screen.getByLabelText('Criar meta e começar'));
    expect(await screen.findByTestId('screen-home')).toBeTruthy();
    expect(state().profile).toMatchObject({ nickname: 'Bia', onboarded: true });
    expect(state().goals.at(-1)).toMatchObject({
      name: 'Reserva de emergência',
      targetCents: 300000,
    });
  });
});

describe('Início', () => {
  it('abre o baú: overlay em camada fixa e recompensa já creditada', async () => {
    await seed();
    await open('/');
    const coins = (await waitFor(() => state())).coins;
    await fireEvent.press(await screen.findByLabelText('Abrir baú diário'));
    expect(await screen.findByText('Baú aberto!')).toBeTruthy();
    expect(state().coins).toBeGreaterThan(coins);
    await fireEvent.press(screen.getByLabelText('Coletar'));
    expect(await screen.findByText('Baú resgatado hoje')).toBeTruthy();
  });

  it('missão leva para a tela certa em vez de concluir no toque (bug 8)', async () => {
    await seed();
    await open('/');
    await fireEvent.press(await screen.findByLabelText(/^Registrar um aporte\./));
    expect(await screen.findByTestId('screen-investir')).toBeTruthy();
    expect(state().daily.missionsDone).not.toContain('m-contribution');
    // abrir a carteira é o evento real da missão "Conferir sua carteira"
    expect(state().daily.missionsDone).toContain('m-portfolio');
  });

  it('dica do dia: ler conclui a missão e conta para a sequência (bugs 6 e 7)', async () => {
    await seed();
    await open('/');
    await fireEvent.press(await screen.findByLabelText(/^Ler a dica do dia:/));
    await fireEvent.press(await screen.findByLabelText('Li a dica'));
    await waitFor(() => expect(state().daily.tipRead).toBe(true));
    expect(state().streak.count).toBe(1);
    expect(state().daily.missionsDone).toContain('m-tip');
  });
});

describe('Investir', () => {
  it('valor não some ao trocar categoria e a prévia acompanha a digitação (bug 9)', async () => {
    await seed();
    await open('/investir');
    const input = await screen.findByLabelText('Valor do aporte');
    const previewXp = () => {
      const label = screen.getByLabelText(/^Prévia: Você ganha/).props.accessibilityLabel as string;
      return Number(/\+(\d+) XP/.exec(label)?.[1]);
    };
    await fireEvent.changeText(input, '100');
    const small = previewXp();
    await fireEvent.changeText(input, '1000000');
    expect(previewXp()).toBeGreaterThan(small);
    // o primeiro chip "Ações" é o do formulário; o segundo é o filtro do histórico
    await fireEvent.press(screen.getAllByLabelText('Ações')[0]!);
    expect(screen.getByLabelText('Valor do aporte').props.value).toBe('10.000,00');
  });

  it('registra aporte, aparece no histórico e pode ser excluído com confirmação', async () => {
    await seed();
    await open('/investir');
    await fireEvent.press(await screen.findByLabelText('Preencher R$ 250'));
    await fireEvent.press(screen.getAllByLabelText('CDB')[0]!);
    await fireEvent.press(screen.getByTestId('submit-entry'));
    await waitFor(() => expect(state().entries).toHaveLength(1));
    expect(state().entries[0]).toMatchObject({ amountCents: 25000, category: 'cdb' });
    expect(screen.getByLabelText('Valor do aporte').props.value).toBe('');
    await fireEvent.press(screen.getByLabelText(/^Excluir aporte de R\$ 250,00/));
    await fireEvent.press(await screen.findByLabelText('Excluir'));
    await waitFor(() => expect(state().entries).toHaveLength(0));
  });

  it('valor acima de R$ 50.000 pede confirmação extra (bug 13)', async () => {
    await seed();
    await open('/investir');
    await fireEvent.changeText(await screen.findByLabelText('Valor do aporte'), '6000000');
    await fireEvent.press(screen.getByTestId('submit-entry'));
    expect(await screen.findByText('Confirmar valor alto')).toBeTruthy();
    expect(state().entries).toHaveLength(0);
    await fireEvent.press(screen.getByLabelText('Confirmar'));
    await waitFor(() => expect(state().entries).toHaveLength(1));
  });

  it('data retroativa: limite de 30 dias e aviso de que não rende XP', async () => {
    await seed();
    await open('/investir');
    await fireEvent.changeText(await screen.findByLabelText('Valor do aporte'), '5000');
    expect(screen.getByLabelText('Próximo dia').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('Dia anterior'));
    expect(screen.getByLabelText('Data: Ontem')).toBeTruthy();
    expect(screen.getByLabelText(/^Prévia: Data passada/)).toBeTruthy();
  });

  it('erro mostra mensagem amigável (item 26)', async () => {
    await seed();
    await open('/investir');
    await fireEvent.press(await screen.findByLabelText('Resgate'));
    await fireEvent.changeText(screen.getByLabelText('Valor do resgate'), '5000');
    await fireEvent.press(screen.getByTestId('submit-entry'));
    await waitFor(() =>
      expect(feedbackStore.getState().toasts.map((t) => t.message)).toContain(
        'Isso deixaria o saldo da categoria negativo. Confira os resgates.',
      ),
    );
  });
});

describe('Metas, Loja e Perfil', () => {
  it('Metas mostra liga de treino com rivais fictícios e conclui a missão de visita', async () => {
    await seed();
    await open('/metas');
    expect(await screen.findByText('Liga de treino')).toBeTruthy();
    expect(screen.getAllByText('rival fictício')).toHaveLength(5);
    expect(state().daily.missionsDone).toContain('m-league');
  });

  it('Loja: prévia antes de comprar e compra com confirmação', async () => {
    await seed({ coins: 1000 });
    await open('/loja');
    await fireEvent.press(await screen.findByLabelText('Porquinho, 500 moedas. Ver prévia'));
    expect(screen.getByText('Prévia: Porquinho')).toBeTruthy();
    expect(state().ownedItems).not.toContain('pet-pig');
    await fireEvent.press(screen.getByLabelText('Comprar Porquinho por 500 moedas'));
    const dialog = await screen.findByText('Comprar Porquinho?');
    expect(dialog).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Comprar'));
    await waitFor(() => expect(state().equipped.pet).toBe('pet-pig'));
    expect(state().coins).toBe(500);
  });

  it('Perfil: reiniciar só libera digitando REINICIAR (bug 12)', async () => {
    await seed({ coins: 999 });
    await open('/perfil');
    await fireEvent.press(await screen.findByLabelText('Reiniciar progresso'));
    const confirm = await screen.findByLabelText('Reiniciar');
    expect(confirm.props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(
      screen.getByLabelText('Digite REINICIAR para confirmar'),
      'reiniciar',
    );
    expect(screen.getByLabelText('Reiniciar').props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(
      screen.getByLabelText('Digite REINICIAR para confirmar'),
      'REINICIAR',
    );
    await fireEvent.press(screen.getByLabelText('Reiniciar'));
    await waitFor(() => expect(state().coins).toBe(150));
    expect(state().profile.nickname).toBe('Ana');
  });

  it('Perfil: conquistas anunciam estado e preferências salvam', async () => {
    await seed();
    await open('/perfil');
    expect(await screen.findByLabelText(/^Conquista Primeiro Aporte: bloqueada/)).toBeTruthy();
    await fireEvent(screen.getByLabelText('Sons'), 'valueChange', false);
    await waitFor(() => expect(state().profile.sound).toBe(false));
    await fireEvent.press(screen.getByLabelText('Amazonas (UTC−4)'));
    await waitFor(() => expect(state().profile.timeZone).toBe('America/Manaus'));
  });
});

it('level-up mostra o nível final e quantos níveis subiu (bug 10)', async () => {
  await seed({ xp: 90 });
  await open('/');
  await screen.findByTestId('screen-home');
  await act(async () => {
    feedbackStore.getState().push({
      toasts: [],
      chest: null,
      burst: false,
      levelUp: { level: 4, levels: 3, bonusCoins: 300 },
    });
  });
  expect(await screen.findByText('Você subiu 3 níveis!')).toBeTruthy();
  expect(screen.getByLabelText('Nível 4, Poupador')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Continuar'));
  await waitFor(() => expect(feedbackStore.getState().levelUp).toBeNull());
});
