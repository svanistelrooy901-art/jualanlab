/** A complete server for tests: real SQL on SQLite, a fake mailer and a fake Google, a clock that can move. */
import { createHandler, type Config } from '../api';
import type { GoogleIdentity, PhotoBucket } from '../ports';
import type { SmeLabLink } from '../api';
import { SqlStore } from '../store';
import { createKedaiHandler } from '../kedai';
import type { PushResult } from '../webpush';
import { migrate, sqliteD1 } from './sqlite';

export const ORIGIN = 'https://jualan.untunglab.space';
export const KEDAI = 'https://kedai.untunglab.space';


/** An R2 stand-in kept in memory. */
export function memoryBucket() {
  const objects = new Map<string, { bytes: Uint8Array; type?: string }>();
  const bucket: PhotoBucket = {
    async get(key) {
      const o = objects.get(key);
      return o ? { arrayBuffer: async () => o.bytes.slice().buffer, httpMetadata: { contentType: o.type } } : null;
    },
    async put(key, value, options) {
      objects.set(key, { bytes: value.slice(), type: options?.httpMetadata?.contentType });
    },
    async delete(key) {
      objects.delete(key);
    },
  };
  return { bucket, objects };
}

export async function makeWorld(over: Partial<Config> = {}, opts: { smelab?: SmeLabLink; photos?: PhotoBucket; push?: (endpoint: string) => Promise<PushResult>; human?: { siteKey: string; verify(token: string, ip: string): Promise<boolean> } } = {}) {
  const d1 = sqliteD1();
  await migrate(d1);
  const store = new SqlStore(d1, opts.photos ?? null);
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
    smelab: opts.smelab ?? null,
    push: opts.push ?? null,
    google: { verify: async (t) => googleTokens.get(t) ?? null },
    config: { appOrigins: [ORIGIN], codePepper: 'test-pepper', secureCookies: true, devMode: false, googleClientId: 'test-client', ...over },
    now: () => new Date(clock),
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) & 0xff),
    newId: () => `id${String(++ids).padStart(6, '0')}`,
  });

  const kedai = createKedaiHandler({
    store, config: { origin: KEDAI }, now: () => new Date(clock),
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) & 0xff),
    push: opts.push ?? null,
    human: opts.human ?? null,
  });
  /** A customer's browser on the store's address: no seller cookie. */
  async function kcall(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await kedai(new Request(`${KEDAI}${path}`, {
      method, redirect: 'manual',
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(method !== 'GET' ? { origin: KEDAI } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
    const type = res.headers.get('content-type') ?? '';
    return { status: res.status, headers: res.headers, body: (type.includes('json') ? await res.json() : await res.text()) as any };
  }

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
    // Only the session cookie is kept between calls; tests read other cookies from setCookies.
    const setCookies = res.headers.getSetCookie();
    for (const c of setCookies) {
      const kv = c.split(';')[0]!;
      if (kv.startsWith('jl_session=')) cookie = kv.endsWith('=') ? '' : kv;
    }
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('json')) return { status: res.status, body: (type.startsWith('text/csv') ? await res.text() : {}) as any, setCookie: setCookies.join(', '), setCookies, location: res.headers.get('location') };
    return { status: res.status, body: (await res.json()) as any, setCookie: setCookies.join(', '), setCookies, location: res.headers.get('location') };
  }

  async function signIn(email = 'mak.long@example.com') {
    await call('POST', '/api/auth/email/start', { email });
    const code = sent[sent.length - 1]!.code;
    return call('POST', '/api/auth/email/verify', { email, code });
  }

  return {
    store, d1, sent, googleTokens, call, signIn, handle, kcall,
    setMailFails: (v: boolean) => (mailFails = v),
    advance: (ms: number) => (clock += ms),
    setNow: (isoTime: string) => (clock = Date.parse(isoTime)),
    get cookie() { return cookie; },
    set cookie(v: string) { cookie = v; },
  };
}
