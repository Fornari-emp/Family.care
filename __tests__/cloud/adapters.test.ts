import { CloudError, cloudMessage, CLOUD_MESSAGES } from '@/cloud/api';
import {
  createChunkedStorage,
  safeKey,
  splitChunks,
  type SecureBackend,
} from '@/cloud/chunkedSecureStorage';
import { readCloudConfig } from '@/cloud/config';
import { createSupabaseApi, toCloudError } from '@/cloud/supabaseApi';

jest.mock('expo-secure-store', () => ({}));

describe('configuração', () => {
  it('exige URL https e chave; ignora o exemplo', () => {
    expect(readCloudConfig({})).toBeNull();
    expect(readCloudConfig({ EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
    expect(
      readCloudConfig({
        EXPO_PUBLIC_SUPABASE_URL: 'http://x.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k',
      }),
    ).toBeNull();
    expect(
      readCloudConfig({
        EXPO_PUBLIC_SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k',
      }),
    ).toBeNull();
    expect(
      readCloudConfig({
        EXPO_PUBLIC_SUPABASE_URL: ' https://abc.supabase.co/ ',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: ' key ',
      }),
    ).toEqual({ url: 'https://abc.supabase.co', anonKey: 'key' });
  });
});

describe('sessão no armazenamento seguro em partes', () => {
  function backend(): SecureBackend & { map: Map<string, string> } {
    const map = new Map<string, string>();
    return {
      map,
      getItemAsync: async (k) => map.get(k) ?? null,
      setItemAsync: async (k, v) => {
        if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error(`chave inválida ${k}`);
        if (v.length > 2048) throw new Error('valor grande demais');
        map.set(k, v);
      },
      deleteItemAsync: async (k) => {
        map.delete(k);
      },
    };
  }

  it('divide valores grandes e remonta', async () => {
    const b = backend();
    const s = createChunkedStorage(b);
    const big = 'x'.repeat(5000) + 'fim';
    await s.setItem('sb-abc-auth-token', big);
    expect(await s.getItem('sb-abc-auth-token')).toBe(big);
    expect(b.map.get('sb-abc-auth-token.n')).toBe('3');
    await s.setItem('sb-abc-auth-token', 'curto');
    expect(await s.getItem('sb-abc-auth-token')).toBe('curto');
    expect(b.map.has('sb-abc-auth-token.2')).toBe(false); // partes antigas removidas
    await s.removeItem('sb-abc-auth-token');
    expect(await s.getItem('sb-abc-auth-token')).toBeNull();
    expect(b.map.size).toBe(0);
  });

  it('parte faltando = sem sessão (nunca devolve valor corrompido)', async () => {
    const b = backend();
    const s = createChunkedStorage(b);
    await s.setItem('k', 'y'.repeat(4000));
    b.map.delete('k.1');
    expect(await s.getItem('k')).toBeNull();
  });

  it('chaves e partes', () => {
    expect(safeKey('sb:abc/auth token')).toBe('sb_abc_auth_token');
    expect(splitChunks('', 10)).toEqual(['']);
    expect(splitChunks('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });
});

describe('erros da nuvem', () => {
  it.each([
    [{ message: 'revision_conflict' }, 'conflict'],
    [{ code: '40001', message: 'x' }, 'conflict'],
    [{ status: 429, message: 'x' }, 'rate-limit'],
    [{ message: 'Email rate limit exceeded' }, 'rate-limit'],
    [{ message: 'Token has expired or is invalid' }, 'invalid-code'],
    [{ message: 'Invalid OTP' }, 'invalid-code'],
    [{ status: 401, message: 'x' }, 'not-authenticated'],
    [{ message: 'JWT expired' }, 'not-authenticated'],
    [new TypeError('Network request failed'), 'network'],
    [{ message: 'algo estranho' }, 'unknown'],
    [null, 'unknown'],
  ])('%p → %s', (err, kind) => {
    expect(toCloudError(err).kind).toBe(kind);
  });
  it('mensagens em português', () => {
    expect(toCloudError(new CloudError('network')).kind).toBe('network');
    expect(cloudMessage(new CloudError('rate-limit'))).toBe(CLOUD_MESSAGES['rate-limit']);
    expect(cloudMessage(new Error('x'))).toBe(CLOUD_MESSAGES.unknown);
  });
});

describe('adaptador Supabase', () => {
  function fakeClient() {
    const rpc = jest.fn(async (name: string) => {
      if (name === 'save_state') return { data: 7, error: null };
      if (name === 'submit_league_xp') return { data: 5250, error: null };
      if (name === 'league_standings')
        return { data: [{ pos: 1, display_name: 'Ana', xp: 300, is_me: true }], error: null };
      return { data: null, error: null };
    });
    const unsubscribe = jest.fn();
    let authCb: (e: string, s: unknown) => void = () => undefined;
    const client = {
      rpc,
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { user: { id: 'u1', email: 'a@b.co' } } },
        })),
        onAuthStateChange: jest.fn((cb) => {
          authCb = cb;
          return { data: { subscription: { unsubscribe } } };
        }),
        signInWithOtp: jest.fn(async () => ({ data: {}, error: null })),
        verifyOtp: jest.fn(async ({ token }: { token: string }) =>
          token === '123456'
            ? { data: { user: { id: 'u1', email: 'a@b.co' } }, error: null }
            : {
                data: { user: null },
                error: { message: 'Token has expired or is invalid', status: 403 },
              },
        ),
        signOut: jest.fn(async () => ({ error: null })),
      },
      from: jest.fn(() => ({
        select: () => ({
          maybeSingle: async () => ({
            data: { revision: '3', schema_version: 3, state: { a: 1 } },
            error: null,
          }),
        }),
      })),
      functions: { invoke: jest.fn(async () => ({ data: { ok: true }, error: null })) },
    };
    return { client, rpc, unsubscribe, emit: (s: unknown) => authCb('SIGNED_IN', s) };
  }

  it('mapeia chamadas e respostas', async () => {
    const { client, rpc, unsubscribe, emit } = fakeClient();
    const api = createSupabaseApi(client as never);
    expect(await api.getUser()).toEqual({ id: 'u1', email: 'a@b.co' });
    const seen: unknown[] = [];
    const off = api.onUserChange((u) => seen.push(u));
    emit({ user: { id: 'u2' } });
    emit(null);
    expect(seen).toEqual([{ id: 'u2', email: null }, null]);
    off();
    expect(unsubscribe).toHaveBeenCalled();

    await api.sendCode('a@b.co');
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@b.co',
      options: { shouldCreateUser: true },
    });
    expect(await api.verifyCode('a@b.co', '123456')).toEqual({ id: 'u1', email: 'a@b.co' });
    await expect(api.verifyCode('a@b.co', '000000')).rejects.toMatchObject({
      kind: 'invalid-code',
    });

    expect(await api.pullState()).toEqual({ revision: 3, schemaVersion: 3, state: { a: 1 } });
    expect(await api.pushState(2, 3, { a: 2 })).toBe(7);
    expect(rpc).toHaveBeenCalledWith('save_state', {
      p_expected: 2,
      p_schema_version: 3,
      p_state: { a: 2 },
    });
    await api.joinLeague('2026-W47', 'Ana');
    expect(await api.submitLeagueXp('2026-W47', 9999, 'Ana')).toBe(5250);
    expect(await api.leagueStandings('2026-W47')).toEqual([
      { position: 1, displayName: 'Ana', xp: 300, isMe: true },
    ]);
    await api.leaveLeague('2026-W47');
    await api.deleteAccount();
    expect(rpc).toHaveBeenCalledWith('delete_my_account');
    await api.signOut();
  });

  it('erros viram CloudError', async () => {
    const { client } = fakeClient();
    client.rpc.mockImplementationOnce(
      async () => ({ data: null, error: { message: 'revision_conflict' } }) as never,
    );
    const api = createSupabaseApi(client as never);
    await expect(api.pushState(1, 3, {})).rejects.toMatchObject({ kind: 'conflict' });
    client.rpc.mockImplementationOnce(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(api.leaveLeague('w')).rejects.toMatchObject({ kind: 'network' });
    client.auth.signOut.mockImplementationOnce(
      async () => ({ error: { status: 401, message: 'x' } }) as never,
    );
    await expect(api.signOut()).rejects.toMatchObject({ kind: 'not-authenticated' });
    client.auth.signOut.mockImplementationOnce(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(api.signOut()).rejects.toMatchObject({ kind: 'network' });
    client.from.mockImplementationOnce(
      () =>
        ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) as never,
    );
    expect(await api.pullState()).toBeNull();
    client.rpc.mockImplementationOnce(async () => ({ data: null, error: null }) as never);
    expect(await api.leagueStandings('w')).toEqual([]);
  });
});
