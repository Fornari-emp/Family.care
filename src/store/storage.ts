/**
 * Persistência local versionada (item 25) com fallback seguro: carregar NUNCA lança erro.
 * Se os dados estiverem corrompidos, guardamos uma cópia para diagnóstico e recomeçamos.
 */
import { defaultState } from '@/domain/state';
import type { GameState } from '@/domain/types';

import { migrate } from './migrations';
import { CURRENT_SCHEMA_VERSION, gameStateSchema, type Envelope } from './schema';

export const STORAGE_KEY = 'invest-level:state';
export const CORRUPT_PREFIX = 'invest-level:corrupt:';

/** Subconjunto da API do AsyncStorage (facilita testes e troca por SQLite). */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface Logger {
  warn(message: string, detail?: unknown): void;
}

export const consoleLogger: Logger = {
  warn: (message, detail) => console.warn(`[invest-level] ${message}`, detail ?? ''),
};

export type LoadStatus = 'empty' | 'ok' | 'migrated' | 'recovered';

export interface LoadResult {
  state: GameState;
  status: LoadStatus;
  /** Mensagem amigável para mostrar ao usuário quando algo deu errado (item 26). */
  userMessage?: string;
  backupKey?: string;
}

export type ParseResult =
  { ok: true; state: GameState; migrated: boolean } | { ok: false; reason: string };

/** Serializa o estado no envelope versionado (também usado no backup em JSON). */
export function serialize(state: GameState, now: Date): string {
  const envelope: Envelope = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAt: now.toISOString(),
    data: state,
  };
  return JSON.stringify(envelope);
}

/** JSON bruto → estado válido (migrando se preciso), ou o motivo da falha. */
export function parseSaved(raw: string, now: Date): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
  const migrated = migrate(json, now);
  if ('error' in migrated) return { ok: false, reason: migrated.error };
  const parsed = gameStateSchema.safeParse(migrated.data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      reason: `invalid-schema: ${first?.path.join('.') ?? ''} ${first?.message ?? ''}`,
    };
  }
  return {
    ok: true,
    state: parsed.data,
    migrated: migrated.fromVersion < CURRENT_SCHEMA_VERSION,
  };
}

const RECOVERED_MESSAGE =
  'Não foi possível ler seus dados salvos. O app recomeçou do zero e guardou uma cópia dos dados antigos.';

export async function loadState(
  storage: KeyValueStorage,
  now: Date,
  logger: Logger = consoleLogger,
): Promise<LoadResult> {
  let raw: string | null;
  try {
    raw = await storage.getItem(STORAGE_KEY);
  } catch (e) {
    logger.warn('falha ao ler o armazenamento', e);
    return {
      state: defaultState(now),
      status: 'recovered',
      userMessage:
        'Não foi possível acessar o armazenamento do aparelho. Seus dados não foram apagados.',
    };
  }
  if (raw === null) return { state: defaultState(now), status: 'empty' };

  const parsed = parseSaved(raw, now);
  if (parsed.ok) return { state: parsed.state, status: parsed.migrated ? 'migrated' : 'ok' };

  logger.warn(`dados salvos inválidos (${parsed.reason})`);
  const backupKey = `${CORRUPT_PREFIX}${now.getTime()}`;
  try {
    await storage.setItem(backupKey, raw);
  } catch (e) {
    logger.warn('falha ao guardar cópia dos dados inválidos', e);
    return { state: defaultState(now), status: 'recovered', userMessage: RECOVERED_MESSAGE };
  }
  return {
    state: defaultState(now),
    status: 'recovered',
    userMessage: RECOVERED_MESSAGE,
    backupKey,
  };
}

export async function saveState(
  storage: KeyValueStorage,
  state: GameState,
  now: Date,
  logger: Logger = consoleLogger,
): Promise<boolean> {
  try {
    await storage.setItem(STORAGE_KEY, serialize(state, now));
    return true;
  } catch (e) {
    logger.warn('falha ao salvar', e);
    return false;
  }
}
