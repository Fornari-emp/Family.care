/**
 * Backup em JSON: o mesmo envelope versionado da persistência, então um backup antigo
 * passa pelas mesmas migrações e validação Zod ao ser importado.
 */
import type { GameState } from '@/domain/types';

import { parseSaved, serialize } from './storage';

export interface BackupSummary {
  entries: number;
  xp: number;
  coins: number;
  nickname: string;
  savedAt: string | null;
}

export function exportBackup(state: GameState, now: Date): string {
  return serialize(state, now);
}

export type ImportResult =
  | { ok: true; state: GameState; summary: BackupSummary; migrated: boolean }
  | { ok: false; message: string };

const MAX_BACKUP_CHARS = 5_000_000;

export function importBackup(raw: string, now: Date): ImportResult {
  const text = raw.trim();
  if (text.length === 0) return { ok: false, message: 'Cole o conteúdo do backup.' };
  if (text.length > MAX_BACKUP_CHARS) return { ok: false, message: 'Backup grande demais.' };
  const parsed = parseSaved(text, now);
  if (!parsed.ok) {
    const message =
      parsed.reason === 'invalid-json'
        ? 'O texto não é um JSON válido. Copie o backup inteiro.'
        : parsed.reason === 'future-version'
          ? 'Esse backup é de uma versão mais nova do app. Atualize o app e tente de novo.'
          : 'Esse arquivo não é um backup válido do Invest Level.';
    return { ok: false, message };
  }
  let savedAt: string | null = null;
  try {
    const env = JSON.parse(text) as { savedAt?: unknown };
    savedAt = typeof env.savedAt === 'string' ? env.savedAt : null;
  } catch {
    /* já validado acima */
  }
  const s = parsed.state;
  return {
    ok: true,
    state: s,
    migrated: parsed.migrated,
    summary: {
      entries: s.entries.length,
      xp: s.xp,
      coins: s.coins,
      nickname: s.profile.nickname,
      savedAt,
    },
  };
}
