/** A complete server for tests: real SQL on SQLite, a fake mailer and a fake Google, a clock that can move. */
import { createHandler, type Config } from '../api';
import type { GoogleIdentity, ToyyibClient, UntungLabLicences } from '../ports';
import { SqlStore } from '../store';
import { migrate, sqliteD1 } from './sqlite';

export const ORIGIN = 'https://jualan.untunglab.space';

export const BILLING = { priceSen: 4900, earlyBirdPriceSen: 3900, earlyBirdSlots: 2, untungLabUserPriceSen: 2900, bundlePriceSen: 7500, publicBaseUrl: ORIGIN, toyyibSecret: 'toyyib-secret' };

export async function makeWorld(over: Partial<Config> = {}, opts: { toyyib?: boolean; untungLab?: boolean } = {}) {
  const d1 = sqliteD1();
  await migrate(d1);
  const store = new SqlStore(d1);
  const sent: { to: string; code: string; lang: string }[] = [];
  const receipts: { to: string; amountSen: number; bundle: boolean }[] = [];
  // Fake ToyyibPay: bills are paid by the test with payBill().
  const bills = new Map<string, { orderId: string; amountSen: number; paid: boolean; paidAmountSen?: number }>();
  const toyyib: ToyyibClient = {
    async createBill(i) {
      const billCode = `bill${bills.size + 1}`;
      bills.set(billCode, { orderId: i.orderId, amountSen: i.amountSen, paid: false });
      return { billCode, payUrl: `https://toyyibpay.test/${billCode}` };
    },
    async getTransactions(billCode) {
      const b = bills.get(billCode);
      return b?.paid ? [{ orderId: b.orderId, status: '1', amountSen: b.paidAmountSen ?? b.amountSen }] : [];
    },
  };
  // Fake UntungLab licence server.
  const ulCodes = new Map<string, 'active' | 'revoked'>([['UL-ABCD-EFGH-JKMN', 'active'], ['UL-REVK-REVK-REVK', 'revoked']]);
  const ulIssued: { name: string; email: string; code: string }[] = [];
  let ulDown = false;
  const untungLab: UntungLabLicences = {
    async check(code) {
      if (ulDown) throw new Error('down');
      return ulCodes.get(code) ?? 'unknown';
    },
    async issue(name, email) {
      if (ulDown) throw new Error('down');
      const code = `UL-NEW${ulIssued.length}-AAAA-BBBB`;
      ulIssued.push({ name, email, code });
      return code;
    },
  };
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
      async sendPurchaseReceipt(to, info) {
        receipts.push({ to, amountSen: info.amountSen, bundle: info.bundle });
      },
    },
    toyyib: opts.toyyib === false ? null : toyyib,
    untungLab: opts.untungLab === false ? null : untungLab,
    google: { verify: async (t) => googleTokens.get(t) ?? null },
    config: { appOrigins: [ORIGIN], codePepper: 'test-pepper', secureCookies: true, devMode: false, googleClientId: 'test-client', billing: BILLING, ...over },
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
    receipts, bills, ulIssued, ulCodes,
    setUlDown: (v: boolean) => (ulDown = v),
    payBill(orderId: string, amountSen?: number) {
      for (const b of bills.values()) if (b.orderId === orderId) Object.assign(b, { paid: true, paidAmountSen: amountSen });
    },
    advance: (ms: number) => (clock += ms),
    get cookie() { return cookie; },
    set cookie(v: string) { cookie = v; },
  };
}
