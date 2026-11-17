/**
 * Ponto único por onde as telas disparam ações: aplica a regra (domínio), mostra toasts/
 * overlays, toca som e vibra conforme o perfil, e traduz erros em mensagens amigáveis.
 */
import { useCallback } from 'react';

import type { Action, Result } from '@/domain/engine';
import { gameStore } from '@/store';
import { errorMessage } from '@/ui/messages';

import { playSound, vibrate } from './effects';
import { feedbackStore } from './feedbackStore';
import { mapEvents } from './mapEvents';

export interface ActOptions {
  /** Não mostrar toast de erro (a tela trata o erro sozinha). */
  silentError?: boolean;
}

export function act(action: Action, opts: ActOptions = {}): Result {
  const result = gameStore.getState().dispatch(action);
  const { profile } = result.state;
  const fb = mapEvents(result.events);
  feedbackStore.getState().push(fb);
  if (result.error && !opts.silentError) {
    feedbackStore.getState().toast(errorMessage(result.error), 'danger');
    if (profile.haptics) vibrate('warning');
    return result;
  }
  if (fb.sound && profile.sound) playSound(fb.sound);
  if (fb.haptic && profile.haptics) vibrate(fb.haptic);
  return result;
}

export function useAct() {
  return useCallback((action: Action, opts?: ActOptions) => act(action, opts), []);
}
