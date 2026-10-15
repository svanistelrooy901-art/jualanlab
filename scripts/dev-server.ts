/**
 * Local development: JualanLab's API (port 8787, behind Vite's /api proxy) and the smeLab account service
 * (port 8790), both on SQLite in .dev/, with dev mode on (sign-in codes shown on screen and printed here).
 * ToyyibPay and UntungLab are faked: "paying" is instant. Run: npm run dev:api
 * SMELAB=0 runs JualanLab with its own email-code sign-in instead.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { randomUUID, getRandomValues } from 'node:crypto';
import { createHandler } from '../server/core/api';
import { createGoogleVerifier } from '../server/core/google';
import { SqlStore } from '../server/core/store';
import { migrate, sqliteD1 } from '../server/core/__tests__/sqlite';
import { createHub } from '../server/hub/core/api';
import { SqlHubStore } from '../server/hub/core/store';

const PORT = Number(process.env.PORT ?? 8787);
const HUB_PORT = Number(process.env.HUB_PORT ?? 8790);
const APP = process.env.APP_URL ?? 'http://localhost:5173';
const ORIGINS = (process.env.APP_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173').split(',');
const SMELAB = process.env.SMELAB !== '0';
const HUB_URL = `http://localhost:${HUB_PORT}`;

mkdirSync('.dev', { recursive: true });
const d1 = sqliteD1('.dev/jualanlab.sqlite');
await migrate(d1);
const hubDb = sqliteD1('.dev/smelab.sqlite');
await migrate(hubDb, undefined, new URL('../server/hub/migrations/', import.meta.url));

const devBills = new Map<string, number>();
const hub = createHub({
  store: new SqlHubStore(hubDb),
  mailer: {
    async sendLoginCode(to, code) { console.log(`[dev smeLab] sign-in code for ${to}: ${code}`); },
    async sendReceipt(to, info) { console.log(`[dev smeLab] receipt to ${to}: ${info.item} RM${info.amountSen / 100}`); },
  },
  google: createGoogleVerifier({ clientId: '' }),
  // Dev ToyyibPay: the "payment page" is smeLab's own return page, already paid.
  toyyib: {
    async createBill(i) {
      devBills.set(i.orderId, i.amountSen);
      return { billCode: `dev-${i.orderId}`, payUrl: i.returnUrl };
    },
    async getTransactions(billCode) {
      const id = billCode.replace(/^dev-/, '');
      return devBills.has(id) ? [{ orderId: id, status: '1', amountSen: devBills.get(id)! }] : [];
    },
  },
  untungLab: {
    async activeCodes(email) { return email === 'lama@example.com' ? ['UL-ABCD-EFGH-JKMN'] : []; },
    async issue() { return 'UL-DEVV-DEVV-DEVV'; },
  },
  config: {
    publicBaseUrl: HUB_URL, codePepper: 'dev-pepper', secureCookies: false, devMode: true, googleClientId: '',
    apps: {
      jualanlab: { url: APP, redirectUris: ORIGINS.map((o) => `${o}/api/auth/smelab/callback`) },
      untunglab: { url: 'https://untunglab.space', redirectUris: ['https://untunglab.space/'] },
    },
    complimentaryEmails: (process.env.COMP_EMAILS ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
    prices: { untunglab: { normalSen: 4900, earlySen: 3900, earlySlots: 15 }, jualanlab: { normalSen: 4900, earlySen: 3900, earlySlots: 15 }, secondAppSen: 2900, comboSen: 7500 },
    onSale: { untunglab: true, jualanlab: true },
    toyyibSecret: 'dev',
  },
  now: () => new Date(),
  randomBytes: (n) => getRandomValues(new Uint8Array(n)),
  newId: () => randomUUID().replace(/-/g, ''),
});

const handle = createHandler({
  store: new SqlStore(d1),
  mailer: { async sendLoginCode(to, code) { console.log(`[dev] sign-in code for ${to}: ${code}`); } },
  google: createGoogleVerifier({ clientId: process.env.GOOGLE_CLIENT_ID ?? '' }),
  smelab: SMELAB
    ? {
        redeem: (c, a, r) => hub.redeem(c, a, r),
        productsOf: (id) => hub.productsOf(id),
        startEmailCode: (e, l, ip) => hub.startEmailCode(e, l, ip),
        verifyEmailCode: (e, c) => hub.verifyEmailCode(e, c),
      }
    : null,
  config: {
    appOrigins: ORIGINS, codePepper: 'dev-pepper', secureCookies: false, devMode: true, googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    prelaunch: process.env.PRELAUNCH === '1',
    complimentaryEmails: (process.env.COMP_EMAILS ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
    smelab: SMELAB ? { url: HUB_URL, callbackUrl: `${APP}/api/auth/smelab/callback` } : undefined,
  },
  now: () => new Date(),
  randomBytes: (n) => getRandomValues(new Uint8Array(n)),
  newId: () => randomUUID(),
});

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml' };

function serve(port: number, fn: (r: Request) => Promise<Response>, assets?: URL) {
  createServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0]!;
    if (assets && /^\/[a-z0-9/_.-]+\.(jpg|png|svg)$/.test(path) && !path.includes('..')) {
      const file = new URL(`.${path}`, assets);
      if (existsSync(file)) {
        res.writeHead(200, { 'content-type': TYPES[path.split('.').pop()!]! });
        res.end(readFileSync(file));
        return;
      }
    }
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const response = await fn(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body }));
    const out: Record<string, string | string[]> = {};
    response.headers.forEach((v, k) => {
      if (k === 'set-cookie') return;
      out[k] = v;
    });
    const cookies = response.headers.getSetCookie?.() ?? [];
    if (cookies.length) out['set-cookie'] = cookies;
    res.writeHead(response.status, out);
    res.end(Buffer.from(await response.arrayBuffer()));
  }).listen(port);
}

serve(PORT, handle);
console.log(`JualanLab dev API on http://localhost:${PORT}${SMELAB ? ` (sign-in through smeLab at ${HUB_URL})` : ''}`);
if (SMELAB) {
  serve(HUB_PORT, (r) => hub.fetch(r), new URL('../server/hub/public/', import.meta.url));
  console.log(`smeLab dev on ${HUB_URL}`);
}
