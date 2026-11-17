/**
 * Instância do app: store ligada ao AsyncStorage + hook React.
 *
 * AsyncStorage (em vez de SQLite): o estado é um documento pequeno salvo como um JSON
 * versionado. Trocar o backend afeta só o `KeyValueStorage` passado aqui.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from 'zustand';

import { createGameStore, type GameStore } from './gameStore';

export const gameStore = createGameStore({ storage: AsyncStorage });

export function useGame<T>(selector: (s: GameStore) => T): T {
  return useStore(gameStore, selector);
}

export type { GameStore } from './gameStore';
