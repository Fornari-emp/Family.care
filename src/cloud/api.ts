/**
 * Interface mínima com a nuvem. O app depende só disto; o Supabase é um adaptador
 * (`supabaseApi.ts`) e os testes usam uma versão em memória.
 */
export interface CloudUser {
  id: string;
  email: string | null;
}

export interface RemoteState {
  revision: number;
  schemaVersion: number;
  state: unknown;
}

export interface LeagueStanding {
  position: number;
  displayName: string;
  xp: number;
  isMe: boolean;
}

export type CloudErrorKind =
  | 'network'
  | 'conflict'
  | 'not-authenticated'
  | 'invalid-code'
  | 'rate-limit'
  | 'invalid-email'
  | 'unknown';

export class CloudError extends Error {
  constructor(
    public readonly kind: CloudErrorKind,
    message?: string,
  ) {
    super(message ?? kind);
    this.name = 'CloudError';
  }
}

export interface CloudApi {
  getUser(): Promise<CloudUser | null>;
  onUserChange(cb: (user: CloudUser | null) => void): () => void;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<CloudUser>;
  signOut(): Promise<void>;
  pullState(): Promise<RemoteState | null>;
  /** Grava se `expectedRevision` for a atual (0 = primeiro registro). Conflito → CloudError('conflict'). */
  pushState(expectedRevision: number, schemaVersion: number, state: unknown): Promise<number>;
  joinLeague(week: string, displayName: string): Promise<void>;
  submitLeagueXp(week: string, xp: number, displayName: string): Promise<number>;
  leagueStandings(week: string): Promise<LeagueStanding[]>;
  leaveLeague(week: string): Promise<void>;
  deleteAccount(): Promise<void>;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const CLOUD_MESSAGES: Record<CloudErrorKind, string> = {
  network: 'Sem conexão com a nuvem. Seus dados continuam salvos no aparelho.',
  conflict: 'Outro aparelho salvou ao mesmo tempo. Tente sincronizar de novo.',
  'not-authenticated': 'Sua sessão expirou. Entre de novo.',
  'invalid-code': 'Código inválido ou expirado. Confira o e-mail ou peça outro código.',
  'rate-limit': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  'invalid-email': 'Digite um e-mail válido.',
  unknown: 'Algo deu errado na sincronização. Tente de novo mais tarde.',
};

export function cloudMessage(e: unknown): string {
  return e instanceof CloudError ? CLOUD_MESSAGES[e.kind] : CLOUD_MESSAGES.unknown;
}
