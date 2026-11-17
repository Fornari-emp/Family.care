/**
 * Guarda a sessão de login no armazenamento seguro do aparelho (Keychain/Keystore).
 * O SecureStore recomenda valores de até ~2 KB; sessões do Supabase podem passar disso,
 * então dividimos em partes.
 */
export interface SecureBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export const CHUNK_SIZE = 1800;

/** SecureStore só aceita chaves com letras, números, ".", "-" e "_". */
export function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

export function splitChunks(value: string, size = CHUNK_SIZE): string[] {
  const out: string[] = [];
  for (let i = 0; i < value.length; i += size) out.push(value.slice(i, i + size));
  return out.length > 0 ? out : [''];
}

export function createChunkedStorage(backend: SecureBackend) {
  const countKey = (k: string) => `${safeKey(k)}.n`;
  const partKey = (k: string, i: number) => `${safeKey(k)}.${i}`;

  async function removeItem(key: string): Promise<void> {
    const n = Number((await backend.getItemAsync(countKey(key))) ?? 0);
    await Promise.all(
      Array.from({ length: n }, (_, i) => backend.deleteItemAsync(partKey(key, i))),
    );
    await backend.deleteItemAsync(countKey(key));
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const n = Number((await backend.getItemAsync(countKey(key))) ?? 0);
      if (!n) return null;
      const parts = await Promise.all(
        Array.from({ length: n }, (_, i) => backend.getItemAsync(partKey(key, i))),
      );
      if (parts.some((p) => p === null)) return null; // gravação incompleta
      return parts.join('');
    },
    async setItem(key: string, value: string): Promise<void> {
      await removeItem(key);
      const parts = splitChunks(value);
      await Promise.all(parts.map((p, i) => backend.setItemAsync(partKey(key, i), p)));
      await backend.setItemAsync(countKey(key), String(parts.length));
    },
    removeItem,
  };
}
