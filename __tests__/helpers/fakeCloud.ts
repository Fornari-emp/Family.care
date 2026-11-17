import { CloudError, type CloudApi, type CloudUser, type LeagueStanding } from '@/cloud/api';

/** "Servidor" em memória compartilhado entre vários aparelhos falsos. */
export class FakeServer {
  states = new Map<string, { revision: number; schemaVersion: number; state: unknown }>();
  league = new Map<string, { week: string; name: string; xp: number }>();
  online = true;
  /** Simula outro aparelho salvando entre o pull e o push (n vezes). */
  raceOnPush = 0;
}

export class FakeCloudApi implements CloudApi {
  user: CloudUser | null = null;
  listeners: ((u: CloudUser | null) => void)[] = [];
  sentCodes: string[] = [];
  constructor(
    public server: FakeServer,
    private readonly identity: CloudUser = { id: 'user-1', email: 'ana@example.com' },
  ) {}

  private needOnline() {
    if (!this.server.online) throw new CloudError('network');
  }
  private needUser(): CloudUser {
    this.needOnline();
    if (!this.user) throw new CloudError('not-authenticated');
    return this.user;
  }

  async getUser() {
    return this.user;
  }
  onUserChange(cb: (u: CloudUser | null) => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }
  async sendCode(email: string) {
    this.needOnline();
    this.sentCodes.push(email);
  }
  async verifyCode(_email: string, code: string) {
    this.needOnline();
    if (code !== '123456') throw new CloudError('invalid-code');
    this.user = this.identity;
    return this.identity;
  }
  async signOut() {
    this.user = null;
  }
  async pullState() {
    const u = this.needUser();
    const row = this.server.states.get(u.id);
    return row ? structuredClone(row) : null;
  }
  async pushState(expected: number, schemaVersion: number, state: unknown) {
    const u = this.needUser();
    const row = this.server.states.get(u.id);
    if (this.server.raceOnPush > 0 && row) {
      this.server.raceOnPush--;
      row.revision++;
    }
    const current = row?.revision ?? 0;
    if (expected !== current) throw new CloudError('conflict');
    const revision = current + 1;
    this.server.states.set(u.id, { revision, schemaVersion, state: structuredClone(state) });
    return revision;
  }
  async joinLeague(week: string, name: string) {
    const u = this.needUser();
    if (!this.server.league.has(u.id)) this.server.league.set(u.id, { week, name, xp: 0 });
  }
  async submitLeagueXp(week: string, xp: number, name: string) {
    const u = this.needUser();
    const capped = Math.min(Math.max(0, xp), 5250);
    this.server.league.set(u.id, { week, name, xp: capped });
    return capped;
  }
  async leagueStandings(week: string): Promise<LeagueStanding[]> {
    const u = this.needUser();
    return [...this.server.league.entries()]
      .filter(([, v]) => v.week === week)
      .sort((a, b) => b[1].xp - a[1].xp)
      .map(([id, v], i) => ({ position: i + 1, displayName: v.name, xp: v.xp, isMe: id === u.id }));
  }
  async leaveLeague() {
    const u = this.needUser();
    this.server.league.delete(u.id);
  }
  async deleteAccount() {
    const u = this.needUser();
    this.server.states.delete(u.id);
    this.server.league.delete(u.id);
  }
}
