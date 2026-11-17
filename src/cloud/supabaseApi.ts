/**
 * Adaptador da `CloudApi` para o Supabase (login por código de e-mail, estado e liga).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

import { CloudError, type CloudApi, type CloudUser, type LeagueStanding } from './api';
import { createChunkedStorage } from './chunkedSecureStorage';
import type { CloudConfig } from './config';

interface ErrLike {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
}

/** Converte erros do Supabase/rede em `CloudError` com tipo conhecido. */
export function toCloudError(err: unknown): CloudError {
  if (err instanceof CloudError) return err;
  const e = (err ?? {}) as ErrLike;
  const msg = (e.message ?? '').toLowerCase();
  if (msg.includes('revision_conflict') || e.code === '40001') return new CloudError('conflict');
  if (e.status === 429 || msg.includes('rate limit')) return new CloudError('rate-limit');
  if (msg.includes('token has expired') || (msg.includes('invalid') && msg.includes('otp')))
    return new CloudError('invalid-code');
  if (e.status === 401 || msg.includes('not_authenticated') || msg.includes('jwt'))
    return new CloudError('not-authenticated');
  if (msg.includes('network') || msg.includes('fetch') || e.name === 'TypeError')
    return new CloudError('network');
  return new CloudError('unknown', e.message);
}

function toUser(u: { id: string; email?: string | null } | null | undefined): CloudUser | null {
  return u ? { id: u.id, email: u.email ?? null } : null;
}

export function createSupabaseClient(config: CloudConfig): SupabaseClient {
  const client = createClient(config.url, config.anonKey, {
    auth: {
      storage: createChunkedStorage(SecureStore),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  // Renova o token só com o app em primeiro plano (recomendação do Supabase para RN).
  AppState.addEventListener('change', (s) => {
    if (s === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
  return client;
}

export function createSupabaseApi(client: SupabaseClient): CloudApi {
  const call = async <T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> => {
    let res: { data: T; error: unknown };
    try {
      res = await p;
    } catch (e) {
      throw toCloudError(e);
    }
    if (res.error) throw toCloudError(res.error);
    return res.data;
  };

  return {
    async getUser() {
      const { data } = await client.auth.getSession();
      return toUser(data.session?.user);
    },

    onUserChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) =>
        cb(toUser(session?.user)),
      );
      return () => data.subscription.unsubscribe();
    },

    async sendCode(email) {
      await call(client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }));
    },

    async verifyCode(email, code) {
      const data = await call(client.auth.verifyOtp({ email, token: code, type: 'email' }));
      const user = toUser(data.user);
      if (!user) throw new CloudError('invalid-code');
      return user;
    },

    async signOut() {
      let error: unknown;
      try {
        ({ error } = await client.auth.signOut());
      } catch (e) {
        error = e;
      }
      if (error) throw toCloudError(error);
    },

    async pullState() {
      const row = await call(
        client.from('game_states').select('revision, schema_version, state').maybeSingle<{
          revision: number;
          schema_version: number;
          state: unknown;
        }>(),
      );
      return row
        ? { revision: Number(row.revision), schemaVersion: row.schema_version, state: row.state }
        : null;
    },

    async pushState(expectedRevision, schemaVersion, state) {
      const revision = await call(
        client.rpc('save_state', {
          p_expected: expectedRevision,
          p_schema_version: schemaVersion,
          p_state: state,
        }),
      );
      return Number(revision);
    },

    async joinLeague(week, displayName) {
      await call(client.rpc('join_league', { p_week: week, p_display_name: displayName }));
    },

    async submitLeagueXp(week, xp, displayName) {
      const v = await call(
        client.rpc('submit_league_xp', { p_week: week, p_xp: xp, p_display_name: displayName }),
      );
      return Number(v);
    },

    async leagueStandings(week) {
      const rows = await call(client.rpc('league_standings', { p_week: week }));
      return (
        (rows as { pos: number; display_name: string; xp: number; is_me: boolean }[] | null) ?? []
      ).map((r): LeagueStanding => ({
        position: r.pos,
        displayName: r.display_name,
        xp: r.xp,
        isMe: r.is_me,
      }));
    },

    async leaveLeague(week) {
      await call(client.rpc('leave_league', { p_week: week }));
    },

    async deleteAccount() {
      await call(client.functions.invoke('delete-account', { method: 'POST' }));
    },
  };
}
