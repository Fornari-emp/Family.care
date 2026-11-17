/**
 * Converte eventos do domínio em feedback para a interface (puro e testável).
 * Vários level-ups numa ação viram UM overlay com o nível final (bug 10).
 */
import type { GameEvent } from '@/domain/engine';
import { formatDay } from '@/ui/format';

export type Tone = 'gold' | 'xp' | 'money' | 'flame' | 'danger' | 'neutral';
export type SoundName = 'coin' | 'up' | 'tap';
export type HapticKind = 'light' | 'success' | 'warning';

export interface Feedback {
  toasts: { message: string; tone: Tone }[];
  levelUp: { level: number; levels: number; bonusCoins: number } | null;
  chest: { coins: number; xp: number } | null;
  burst: boolean;
  sound: SoundName | null;
  haptic: HapticKind | null;
}

export function mapEvents(events: readonly GameEvent[]): Feedback {
  const fb: Feedback = {
    toasts: [],
    levelUp: null,
    chest: null,
    burst: false,
    sound: null,
    haptic: null,
  };
  let levelFrom = 0;
  for (const e of events) {
    switch (e.type) {
      case 'reward':
        if (e.coins > 0) fb.burst = true;
        if (e.xp > 0 || e.coins > 0) {
          const parts = [e.xp > 0 ? `+${e.xp} XP` : '', e.coins > 0 ? `+${e.coins} moedas` : '']
            .filter(Boolean)
            .join(' · ');
          fb.toasts.push({ message: `${e.source}  ${parts}`, tone: e.xp > 0 ? 'xp' : 'gold' });
        }
        break;
      case 'levelUp':
        if (!fb.levelUp) levelFrom = e.from;
        fb.levelUp = {
          level: e.to,
          levels: e.to - levelFrom,
          bonusCoins: (fb.levelUp?.bonusCoins ?? 0) + e.bonusCoins,
        };
        break;
      case 'achievement':
        fb.toasts.push({ message: `Conquista: ${e.title}`, tone: 'gold' });
        break;
      case 'chestOpened':
        fb.chest = { coins: e.coins, xp: e.xp };
        break;
      case 'streakExtended':
        fb.toasts.push({
          message: `Sequência: ${e.count} ${e.count === 1 ? 'dia' : 'dias'}`,
          tone: 'flame',
        });
        break;
      case 'streakFrozen':
        fb.toasts.push({
          message: `Congelamento usado em ${e.days.map((d) => formatDay(d)).join(', ')}`,
          tone: 'xp',
        });
        break;
      case 'streakBroken':
        fb.toasts.push({ message: 'Sua sequência recomeçou. Bora de novo!', tone: 'flame' });
        break;
      case 'entryAdded':
        if (e.entry.kind === 'withdrawal')
          fb.toasts.push({ message: 'Resgate registrado', tone: 'neutral' });
        else if (e.reward?.note === 'retroactive')
          fb.toasts.push({
            message: 'Aporte registrado (data passada não rende XP)',
            tone: 'neutral',
          });
        else if (e.reward && e.reward.xp === 0)
          fb.toasts.push({
            message: 'Aporte registrado (limite diário de XP atingido)',
            tone: 'neutral',
          });
        break;
      case 'entryUpdated':
        fb.toasts.push({ message: 'Registro atualizado', tone: 'neutral' });
        break;
      case 'entryDeleted':
        fb.toasts.push({ message: 'Registro excluído', tone: 'neutral' });
        break;
      case 'purchase':
        fb.toasts.push({ message: 'Item adquirido!', tone: 'gold' });
        break;
      case 'leagueWeekClosed':
        fb.toasts.push({
          message: `Semana encerrada: você ficou em ${e.position}º na liga de treino`,
          tone: 'xp',
        });
        break;
      case 'reset':
        fb.toasts.push({ message: 'Progresso reiniciado', tone: 'neutral' });
        break;
      default:
        break;
    }
  }
  const purchased = events.some((e) => e.type === 'purchase' || e.type === 'equipped');
  fb.sound = fb.levelUp || fb.chest ? 'up' : fb.burst || purchased ? 'coin' : null;
  fb.haptic = fb.levelUp || fb.chest ? 'success' : fb.burst || purchased ? 'light' : null;
  return fb;
}
