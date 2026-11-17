/** Sons curtos e vibração, respeitando as preferências do perfil. Falhas nunca travam o app. */
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import type { HapticKind, SoundName } from './mapEvents';

const SOURCES: Record<SoundName, number> = {
  coin: require('../../assets/sounds/coin.wav'),
  up: require('../../assets/sounds/up.wav'),
  tap: require('../../assets/sounds/tap.wav'),
};

const players: Partial<Record<SoundName, AudioPlayer>> = {};

export function playSound(name: SoundName): void {
  try {
    const player = (players[name] ??= createAudioPlayer(SOURCES[name]));
    player.seekTo(0);
    player.play();
  } catch (e) {
    console.warn('[invest-level] som indisponível', e);
  }
}

export function vibrate(kind: HapticKind): void {
  const run =
    kind === 'success'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : kind === 'warning'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  run.catch((e: unknown) => console.warn('[invest-level] vibração indisponível', e));
}
