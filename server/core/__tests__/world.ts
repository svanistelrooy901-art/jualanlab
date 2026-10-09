/** A complete server for tests: real SQL on SQLite, a fake mailer and a fake Google, a clock that can move. */
import { createHandler, type Config } from '../api';
import type { GoogleIdentity } from '../ports';
import { SqlStore } from '../store';
import { migrate, sqliteD1 } from './sqlite';

export const ORIGIN = 'https://jualan.untunglab.space';

export async function makeWorld(over: Partial<Config> = {}) {
  const d1 = sqliteD1();
  await migrate(d1);
  const store = new SqlStore(d1);
  const sent: { to: string; code: string; lang: string }[] = [];
  const googleTokens = new Map<string, GoogleIdentity>();
  let mailFails = false;
  let clock = Date.parse('2026-10-10T01:00:00.000Z');
  let ids = 0;
  let seed = 7;
  const handle = createHandler({
    store,
    mailer: {
      async sendLoginCode(to, code, lang) {
        if (mailFails) throw new Error('down');
        sent.push({ to, code, lang });
      },
    },
    google: { verify: async (t) => googleTokens.get(t) ?? null },
    config: { appOrigins: [ORIGIN], codePepper: 'test-pepper', secureCookies: true, devMode: false, googleClientId: 'test-client', ...over },
    now: () => new Date(clock),
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) & 0xff),
    newId: () => `id${String(++ids).padStart(6, '0')}`,
  });

  let cookie = '';
  async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await handle(new Request(`${ORIGIN}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(method !== 'GET' ? { origin: ORIGIN } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0]!.endsWith('=') ? '' : set.split(';')[0]!;
    return { status: res.status, body: (await res.json()) as any, setCookie: set };
  }

  async function signIn(email = 'mak.long@example.com') {
    await call('POST', '/api/auth/email/start', { email });
    const code = sent[sent.length - 1]!.code;
    return call('POST', '/api/auth/email/verify', { email, code });
  }

  return {
    store, d1, sent, googleTokens, call, signIn, handle,
    setMailFails: (v: boolean) => (mailFails = v),
    advance: (ms: number) => (clock += ms),
    get cookie() { return cookie; },
    set cookie(v: string) { cookie = v; },
  };
}
