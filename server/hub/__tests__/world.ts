/** A complete smeLab account service for tests: real SQL on SQLite, fake email, Google, ToyyibPay and UntungLab. */
import { migrate, sqliteD1 } from '../../core/__tests__/sqlite';
import type { GoogleIdentity, ToyyibClient } from '../../core/ports';
import { createHub } from '../core/api';
import type { HubConfig } from '../core/ports';
import { SqlHubStore } from '../core/store';

export const HUB = 'https://smelab.untunglab.space';
export const JL_CALLBACK = 'https://jualan.untunglab.space/api/auth/smelab/callback';
export const UL_CALLBACK = 'https://untunglab.space/';

export const CONFIG: HubConfig = {
  publicBaseUrl: HUB,
  codePepper: 'pepper',
  secureCookies: true,
  devMode: false,
  googleClientId: '',
  apps: {
    jualanlab: { url: 'https://jualan.untunglab.space', redirectUris: [JL_CALLBACK] },
    untunglab: { url: 'https://untunglab.space', redirectUris: [UL_CALLBACK] },
  },
  complimentaryEmails: ['mamu@example.com'],
  prices: {
    untunglab: { normalSen: 4900, earlySen: 3900, earlySlots: 1 },
    jualanlab: { normalSen: 4900, earlySen: 3900, earlySlots: 2 },
    secondAppSen: 2900,
    comboSen: 7500,
  },
  onSale: { untunglab: true, jualanlab: true, combo: true },
  toyyibSecret: 'toyyib-secret',
};

export async function makeHub(over: Partial<HubConfig> = {}) {
  const d1 = sqliteD1();
  await migrate(d1, undefined, new URL('../migrations/', import.meta.url));
  const store = new SqlHubStore(d1);
  const codes: { to: string; code: string }[] = [];
  const receipts: { to: string; item: string; amountSen: number; ulCode: string | null }[] = [];
  const bills = new Map<string, { orderId: string; amountSen: number; paid: boolean }>();
  const toyyib: ToyyibClient = {
    async createBill(i) {
      const billCode = `bill${bills.size + 1}`;
      bills.set(billCode, { orderId: i.orderId, amountSen: i.amountSen, paid: false });
      return { billCode, payUrl: `https://toyyibpay.test/${billCode}` };
    },
    async getTransactions(billCode) {
      const b = bills.get(billCode);
      return b?.paid ? [{ orderId: b.orderId, status: '1', amountSen: b.amountSen }] : [];
    },
  };
  // UntungLab licences bought before smeLab, by email.
  const ulLicences = new Map<string, string[]>([['lama@example.com', ['UL-ABCD-EFGH-JKMN']]]);
  const ulIssued: { name: string; email: string; code: string }[] = [];
  let ulDown = false;
  const googleTokens = new Map<string, GoogleIdentity>();
  let clock = Date.parse('2026-10-20T02:00:00.000Z');
  let ids = 0;
  let seed = 11;
  const hub = createHub({
    store,
    mailer: {
      async sendLoginCode(to, code) {
        codes.push({ to, code });
      },
      async sendReceipt(to, info) {
        receipts.push({ to, item: info.item, amountSen: info.amountSen, ulCode: info.ulCode });
      },
    },
    google: { verify: async (t) => googleTokens.get(t) ?? null },
    toyyib,
    untungLab: {
      async activeCodes(email) {
        if (ulDown) throw new Error('down');
        return ulLicences.get(email) ?? [];
      },
      async issue(name, email) {
        if (ulDown) throw new Error('down');
        const code = `UL-NEW${ulIssued.length}-AAAA-BBBB`;
        ulIssued.push({ name, email, code });
        return code;
      },
    },
    config: { ...CONFIG, ...over },
    now: () => new Date(clock),
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) & 0xff),
    newId: () => `acc${String(++ids).padStart(6, '0')}`,
  });

  let cookie = '';
  async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await hub.fetch(new Request(`${HUB}${path}`, {
      method,
      redirect: 'manual',
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(method !== 'GET' ? { origin: HUB } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0]!.endsWith('=') ? '' : set.split(';')[0]!;
    const type = res.headers.get('content-type') ?? '';
    return { status: res.status, location: res.headers.get('location'), body: (type.includes('json') ? await res.json() : await res.text()) as any, headers: res.headers };
  }

  async function signIn(email = 'kak.ros@example.com') {
    await call('POST', '/api/auth/email/start', { email });
    const code = codes[codes.length - 1]!.code;
    return call('POST', '/api/auth/email/verify', { email, code });
  }

  return {
    hub, store, d1, call, signIn, codes, receipts, bills, ulLicences, ulIssued, googleTokens,
    setUlDown: (v: boolean) => (ulDown = v),
    pay(orderId: string) {
      for (const b of bills.values()) if (b.orderId === orderId) b.paid = true;
    },
    advance: (ms: number) => (clock += ms),
    get cookie() { return cookie; },
    set cookie(v: string) { cookie = v; },
  };
}
