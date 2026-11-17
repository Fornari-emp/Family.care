import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

import type { Feedback, Tone } from './mapEvents';

export interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

export interface FeedbackState {
  toasts: ToastItem[];
  levelUp: Feedback['levelUp'];
  chest: Feedback['chest'];
  burstKey: number;
  push: (fb: Pick<Feedback, 'toasts' | 'levelUp' | 'chest' | 'burst'>) => void;
  toast: (message: string, tone?: Tone) => void;
  dismissToast: (id: number) => void;
  closeLevelUp: () => void;
  closeChest: () => void;
}

export const TOAST_MS = 2700;
const MAX_TOASTS = 3;
let nextId = 0;

export const feedbackStore = createStore<FeedbackState>()((set, get) => ({
  toasts: [],
  levelUp: null,
  chest: null,
  burstKey: 0,
  push: (fb) => {
    const toasts = fb.toasts.map((t) => ({ ...t, id: ++nextId }));
    set((s) => ({
      toasts: [...s.toasts, ...toasts].slice(-MAX_TOASTS),
      // Overlays são independentes: o bônus de nível já foi pago no domínio.
      levelUp: fb.levelUp ?? s.levelUp,
      chest: fb.chest ?? s.chest,
      burstKey: fb.burst ? s.burstKey + 1 : s.burstKey,
    }));
    for (const t of toasts) setTimeout(() => get().dismissToast(t.id), TOAST_MS);
  },
  toast: (message, tone = 'neutral') =>
    get().push({ toasts: [{ message, tone }], levelUp: null, chest: null, burst: false }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  closeLevelUp: () => set({ levelUp: null }),
  closeChest: () => set({ chest: null }),
}));

export function useFeedback<T>(selector: (s: FeedbackState) => T): T {
  return useStore(feedbackStore, selector);
}
