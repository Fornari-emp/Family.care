/** Loja: 18 itens cosméticos em 5 grupos + consumível "Congelar sequência". */
import { addFreeze } from './streak';
import type { Equipped, GameState, ShopSlot } from './types';

export interface CosmeticItem {
  id: string;
  name: string;
  slot: ShopSlot;
  price: number;
  /** Nome do ícone (o desenho fica na camada de UI). */
  icon: string;
  tint: string;
}

export const ITEMS: readonly CosmeticItem[] = [
  {
    id: 'suit-basic',
    name: 'Terno Básico',
    slot: 'suit',
    price: 0,
    icon: 'shirt',
    tint: '#8C8172',
  },
  {
    id: 'suit-exec',
    name: 'Terno Executivo',
    slot: 'suit',
    price: 250,
    icon: 'shirt',
    tint: '#C9B48F',
  },
  {
    id: 'suit-gold',
    name: 'Terno Dourado',
    slot: 'suit',
    price: 900,
    icon: 'shirt',
    tint: '#FFC53D',
  },
  {
    id: 'suit-platinum',
    name: 'Terno Platina',
    slot: 'suit',
    price: 2200,
    icon: 'shirt',
    tint: '#D5DCE6',
  },
  {
    id: 'suit-diamond',
    name: 'Terno Diamante',
    slot: 'suit',
    price: 5000,
    icon: 'shirt',
    tint: '#8FE3DB',
  },
  {
    id: 'acc-glasses',
    name: 'Óculos',
    slot: 'accessory',
    price: 120,
    icon: 'glasses',
    tint: '#9FC7FF',
  },
  {
    id: 'acc-watch',
    name: 'Relógio',
    slot: 'accessory',
    price: 200,
    icon: 'watch',
    tint: '#FFD466',
  },
  {
    id: 'acc-chain',
    name: 'Corrente',
    slot: 'accessory',
    price: 380,
    icon: 'chain',
    tint: '#FFC53D',
  },
  { id: 'acc-hat', name: 'Cartola', slot: 'accessory', price: 600, icon: 'hat', tint: '#B9A88E' },
  {
    id: 'acc-crown',
    name: 'Coroa',
    slot: 'accessory',
    price: 1800,
    icon: 'crown',
    tint: '#FFD766',
  },
  {
    id: 'aura-gold',
    name: 'Aura Dourada',
    slot: 'aura',
    price: 700,
    icon: 'sparkle',
    tint: '#FFC53D',
  },
  {
    id: 'aura-violet',
    name: 'Aura Violeta',
    slot: 'aura',
    price: 1600,
    icon: 'sparkle',
    tint: '#B78BFF',
  },
  {
    id: 'aura-diamond',
    name: 'Aura Diamante',
    slot: 'aura',
    price: 3800,
    icon: 'sparkle',
    tint: '#8FE3DB',
  },
  { id: 'pet-pig', name: 'Porquinho', slot: 'pet', price: 500, icon: 'pig', tint: '#F09BB0' },
  { id: 'pet-bull', name: 'Touro', slot: 'pet', price: 1400, icon: 'bull', tint: '#FF7A45' },
  { id: 'pet-eagle', name: 'Águia', slot: 'pet', price: 2800, icon: 'eagle', tint: '#FFC53D' },
  {
    id: 'frame-gold',
    name: 'Moldura Ouro',
    slot: 'frame',
    price: 650,
    icon: 'ring',
    tint: '#FFC53D',
  },
  {
    id: 'frame-diamond',
    name: 'Moldura Diamante',
    slot: 'frame',
    price: 2400,
    icon: 'gem',
    tint: '#8FE3DB',
  },
];

export const SHOP_GROUPS: readonly { slot: ShopSlot; title: string }[] = [
  { slot: 'suit', title: 'Ternos' },
  { slot: 'accessory', title: 'Acessórios' },
  { slot: 'aura', title: 'Auras' },
  { slot: 'pet', title: 'Pets' },
  { slot: 'frame', title: 'Molduras' },
];

export const STREAK_FREEZE = {
  id: 'streak-freeze',
  name: 'Congelar sequência',
  description: 'Salva 1 dia sem ação. Você pode guardar até 2.',
  price: 300,
} as const;

export const DEFAULT_SUIT = 'suit-basic';

export function defaultEquipped(): Equipped {
  return { suit: DEFAULT_SUIT, accessory: null, aura: null, pet: null, frame: null };
}

export function getItem(id: string): CosmeticItem | undefined {
  return ITEMS.find((i) => i.id === id);
}

export type ShopError =
  | 'not-found'
  | 'already-owned'
  | 'not-owned'
  | 'insufficient-coins'
  | 'freeze-limit'
  | 'cannot-unequip-suit';

type ShopResult = { state: GameState; spent: number } | { error: ShopError };

export function buyItem(state: GameState, itemId: string): ShopResult {
  if (itemId === STREAK_FREEZE.id) {
    if (state.coins < STREAK_FREEZE.price) return { error: 'insufficient-coins' };
    const streak = addFreeze(state.streak);
    if (!streak) return { error: 'freeze-limit' };
    return {
      state: { ...state, coins: state.coins - STREAK_FREEZE.price, streak },
      spent: STREAK_FREEZE.price,
    };
  }
  const item = getItem(itemId);
  if (!item) return { error: 'not-found' };
  if (state.ownedItems.includes(itemId)) return { error: 'already-owned' };
  if (state.coins < item.price) return { error: 'insufficient-coins' };
  return {
    state: {
      ...state,
      coins: state.coins - item.price,
      ownedItems: [...state.ownedItems, itemId],
      equipped: { ...state.equipped, [item.slot]: itemId },
    },
    spent: item.price,
  };
}

export function equipItem(
  state: GameState,
  itemId: string,
): { state: GameState } | { error: ShopError } {
  const item = getItem(itemId);
  if (!item) return { error: 'not-found' };
  if (!state.ownedItems.includes(itemId)) return { error: 'not-owned' };
  return { state: { ...state, equipped: { ...state.equipped, [item.slot]: itemId } } };
}

export function unequipSlot(
  state: GameState,
  slot: ShopSlot,
): { state: GameState } | { error: ShopError } {
  if (slot === 'suit') return { error: 'cannot-unequip-suit' };
  return { state: { ...state, equipped: { ...state.equipped, [slot]: null } } };
}

/** Visual do personagem com o item aplicado — para prévia ANTES de comprar. */
export function previewLoadout(equipped: Equipped, itemId: string): Equipped {
  const item = getItem(itemId);
  return item ? { ...equipped, [item.slot]: itemId } : equipped;
}
