/**
 * Instância do serviço de nuvem do app. `null` quando o Supabase não está configurado
 * (o app segue 100% local).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { gameStore } from '@/store';

import { createCloudService, type CloudService, type CloudState } from './cloudService';
import { cloudConfig } from './config';
import { createSupabaseApi, createSupabaseClient } from './supabaseApi';

export const cloud: CloudService | null = cloudConfig
  ? createCloudService({
      api: createSupabaseApi(createSupabaseClient(cloudConfig)),
      game: gameStore,
      storage: AsyncStorage,
    })
  : null;

/** Store vazio usado quando a nuvem não está configurada. */
const offStore = createStore<CloudState>()(() => ({
  status: 'signed-out',
  user: null,
  lastSyncedAt: null,
  error: null,
  choice: null,
  league: null,
}));

export function useCloud<T>(selector: (s: CloudState) => T): T {
  return useStore(cloud?.store ?? offStore, selector);
}
