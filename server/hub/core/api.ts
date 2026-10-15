/**
 * smeLab account service: one account for every smeLab app (DECISIONS A-01, A-05), the suite's sales page and checkout.
 * Platform-neutral like JualanLab's core: takes a Request, returns a Response; the apps reach `redeem` and
 * `productsOf` through a Cloudflare service binding (server/hub/worker), never over the public internet.
 */
import { base64url, safeEqual, sha256Hex, sixDigitCode } from '../../core/crypto';
import { md5 } from '../../core/md5';
import { normaliseUlCode } from '../../core/untunglab';
import { offerFor, ITEMS, productsOf, type Offer } from './offers';
import { accountPage, checkoutPage, donePage, legalPage, salesPage, signInPage, HUB_JS, type Lang } from './pages';
import { APPS, type Account, type AppId, type HubDeps, type Item, type Order, type Product } from './ports';

export const HUB_SESSION_COOKIE = 'sm_session';
const SESSION_DAYS = 90;
const CODE_MINUTES = 10;
const APP_CODE_SECONDS = 120;
const MAX_CODE_ATTEMPTS = 5;
const EMAIL_SENDS_PER_HOUR = 5;
const IP_SENDS_PER_HOUR = 20;
const HITS_KEEP_MS = 2 * 86400_000;
/** A paid order's licence and receipt are retried by a later check only after this long (see deliver). */
const RETRY_AFTER_MS = 60_000;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const STATE_RE = /^[A-Za-z0-9_-]{8,200}$/;

/** What an app gets for a signed-in person. */
export interface AppAccount {
  account: { id: string; email: string; name: string | null };
  products: Product[];
}

class HttpError extends Error {
  constructor(public status: number, public code: string, public extra: Record<string, unknown> = {}) {
    super(code);
  }
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

/** Pages: scripts only from this origin; Google's sign-in button when it is on. */
const PAGE_CSP =
  "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; " +
  "img-src 'self' data: https:; connect-src 'self' https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'";

const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': PAGE_CSP,
      'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'strict-transport-security': 'max-age=31536000', ...headers,
    },
  });

const redirect = (to: string, headers: Record<string, string> = {}) => new Response(null, { status: 302, headers: { location: to, 'cache-control': 'no-store', ...headers } });

export function createHub(d: HubDeps) {
  const cfg = d.config;
  const base = cfg.publicBaseUrl.replace(/\/+$/, '');
  const iso = (msFromNow = 0) => new Date(d.now().getTime() + msFromNow).toISOString();

  // ---------- sessions ----------

  function cookie(token: string, maxAgeS: number): string {
    return `${HUB_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${cfg.secureCookies ? '; Secure' : ''}`;
  }
  function readCookie(req: Request, name: string): string | null {
    for (const part of (req.headers.get('cookie') ?? '').split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === name) return v.join('=') || null;
    }
    return null;
  }
  async function startSession(accountId: string): Promise<string> {
    const token = base64url(d.randomBytes(32));
    await d.store.createSession(await sha256Hex(token), accountId, iso(), iso(SESSION_DAYS * 86400_000));
    return cookie(token, SESSION_DAYS * 86400);
  }
  async function current(req: Request): Promise<{ account: Account; tokenHash: string; refreshCookie?: string } | null> {
    const token = readCookie(req, HUB_SESSION_COOKIE);
    if (!token) return null;
    const tokenHash = await sha256Hex(token);
    const s = await d.store.getSession(tokenHash);
    if (!s || s.expiresAt <= iso()) return null;
    const account = await d.store.getAccount(s.accountId);
    if (!account) return null;
    if (Date.parse(s.expiresAt) - d.now().getTime() < (SESSION_DAYS / 2) * 86400_000) {
      await d.store.extendSession(tokenHash, iso(SESSION_DAYS * 86400_000));
      return { account, tokenHash, refreshCookie: cookie(token, SESSION_DAYS * 86400) };
    }
    return { account, tokenHash };
  }
  async function requireAccount(req: Request) {
    const c = await current(req);
    if (!c) throw new HttpError(401, 'signed_out');
    return c;
  }

  async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
    if (!(req.headers.get('content-type') ?? '').includes('application/json')) throw new HttpError(415, 'json_required');
    const text = await req.text();
    if (text.length > 20_000) throw new HttpError(413, 'too_large');
    try {
      const v = JSON.parse(text) as unknown;
      if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error();
      return v as T;
    } catch {
      throw new HttpError(400, 'bad_json');
    }
  }

  async function rateLimit(key: string, max: number, windowMs: number) {
    if ((await d.store.countHits(key, iso(-windowMs))) >= max) throw new HttpError(429, 'too_many_requests');
    await d.store.recordHit(key, iso());
    await d.store.pruneHits(iso(-HITS_KEEP_MS));
  }

  // ---------- accounts and what they own ----------

  async function findOrCreate(email: string, name: string | null): Promise<Account> {
    const found = await d.store.getAccountByEmail(email);
    if (found) return found;
    const a: Account = { id: d.newId(), email, name, googleSub: null, createdAt: iso() };
    try {
      await d.store.createAccount(a);
      return a;
    } catch {
      // Two sign-ins for a new email at once: the other one created it.
      const again = await d.store.getAccountByEmail(email);
      if (again) return again;
      throw new HttpError(500, 'server_error');
    }
  }

  /** An UntungLab licence bought with this email (before smeLab) belongs to the account (DECISIONS A-03). */
  async function pickUpUntungLabLicence(a: Account): Promise<void> {
    if (!d.untungLab) return;
    const owned = await d.store.listEntitlements(a.id);
    if (owned.some((e) => e.product === 'untunglab' && !e.revokedAt)) return;
    let codes: string[];
    try {
      codes = await d.untungLab.activeCodes(a.email);
    } catch (e) {
      console.error('UntungLab lookup failed', e);
      return;
    }
    // A code another account already claimed (A-13) stays with that account.
    for (const code of codes) {
      const taken = await d.store.entitlementByUlCode(code);
      if (taken && taken.accountId !== a.id) continue;
      await d.store.addEntitlement({ id: d.newId(), accountId: a.id, product: 'untunglab', source: 'untunglab_licence', orderId: null, ulCode: code, createdAt: iso(), revokedAt: null });
      return;
    }
  }

  const complimentary = (a: Account) => cfg.complimentaryEmails.includes(a.email);

  async function owned(a: Account): Promise<Set<Product>> {
    if (complimentary(a)) return new Set(APPS);
    return new Set((await d.store.listEntitlements(a.id)).filter((e) => !e.revokedAt).map((e) => e.product));
  }

  async function signedIn(a: Account): Promise<string> {
    await pickUpUntungLabLicence(a);
    return startSession(a.id);
  }

  // ---------- handing a signed-in account to an app ----------

  function appFor(app: unknown, redirectUri: unknown): { app: AppId; redirectUri: string } | null {
    if (typeof app !== 'string' || !(APPS as readonly string[]).includes(app)) return null;
    if (typeof redirectUri !== 'string' || !cfg.apps[app as AppId].redirectUris.includes(redirectUri)) return null;
    return { app: app as AppId, redirectUri };
  }

  /** The address to send the person back to, carrying a one-time code for the app's server. */
  async function backToApp(accountId: string, target: { app: AppId; redirectUri: string }, state: string): Promise<string> {
    const code = base64url(d.randomBytes(32));
    await d.store.putAppCode({ codeHash: await sha256Hex(code), accountId, app: target.app, redirectUri: target.redirectUri, expiresAt: iso(APP_CODE_SECONDS * 1000) });
    const url = new URL(target.redirectUri);
    url.searchParams.set('code', code);
    url.searchParams.set('state', state);
    return url.toString();
  }

  /** For apps (service binding): the account behind a one-time code, once. */
  async function redeem(code: string, app: AppId, redirectUri: string): Promise<AppAccount | null> {
    if (typeof code !== 'string' || code.length < 20 || code.length > 100) return null;
    const rec = await d.store.takeAppCode(await sha256Hex(code), iso());
    if (!rec || rec.app !== app || rec.redirectUri !== redirectUri || rec.expiresAt <= iso()) return null;
    const a = await d.store.getAccount(rec.accountId);
    if (!a) return null;
    return { account: { id: a.id, email: a.email, name: a.name }, products: [...(await owned(a))] };
  }

  /** For apps (service binding): what the account owns now. */
  async function productsOfAccount(accountId: string): Promise<Product[] | null> {
    const a = await d.store.getAccount(accountId);
    return a ? [...(await owned(a))] : null;
  }

  /** For UntungLab's licence server (service binding): the licence code behind the account's UntungLab, if any. */
  async function untungLabCodeOf(accountId: string): Promise<string | null> {
    const a = await d.store.getAccount(accountId);
    if (!a) return null;
    await pickUpUntungLabLicence(a);
    const e = (await d.store.listEntitlements(a.id)).find((x) => x.product === 'untunglab' && !x.revokedAt);
    return e?.ulCode ?? null;
  }

  // ---------- email codes (used by smeLab's own page, and by apps signing in inside themselves) ----------

  type CodeResult = { ok: true; devCode?: string } | { ok: false; error: string };
  type VerifyResult = { ok: true; account: Account } | { ok: false; error: string; attemptsLeft?: number };

  async function startEmailCode(rawEmail: unknown, lang: unknown, ip: string): Promise<CodeResult> {
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, error: 'bad_email' };
    try {
      await rateLimit(`code:email:${email}`, EMAIL_SENDS_PER_HOUR, 3600_000);
      await rateLimit(`code:ip:${ip}`, IP_SENDS_PER_HOUR, 3600_000);
    } catch (e) {
      // Only the limit itself is "too many"; anything else (the database, say) is a real error, not hidden as one.
      if (e instanceof HttpError && e.code === 'too_many_requests') return { ok: false, error: 'too_many_requests' };
      throw e;
    }
    const code = sixDigitCode(d.randomBytes);
    await d.store.putLoginCode({ email, codeHash: await sha256Hex(`${cfg.codePepper}:${email}:${code}`), expiresAt: iso(CODE_MINUTES * 60_000), attempts: 0, sentAt: iso() });
    if (cfg.devMode) return { ok: true, devCode: code };
    try {
      await d.mailer.sendLoginCode(email, code, lang === 'en' ? 'en' : 'ms');
    } catch {
      return { ok: false, error: 'email_failed' };
    }
    return { ok: true };
  }

  async function verifyEmailCode(rawEmail: unknown, rawCode: unknown): Promise<VerifyResult> {
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const code = typeof rawCode === 'string' ? rawCode.replace(/\s/g, '') : '';
    const rec = await d.store.getLoginCode(email);
    if (!rec || rec.expiresAt <= iso()) return { ok: false, error: 'code_expired' };
    if (rec.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, error: 'too_many_attempts' };
    if (!/^\d{6}$/.test(code) || !safeEqual(await sha256Hex(`${cfg.codePepper}:${email}:${code}`), rec.codeHash)) {
      await d.store.countLoginAttempt(email);
      return { ok: false, error: 'wrong_code', attemptsLeft: Math.max(0, MAX_CODE_ATTEMPTS - rec.attempts - 1) };
    }
    await d.store.deleteLoginCode(email);
    const a = await findOrCreate(email, null);
    await pickUpUntungLabLicence(a);
    return { ok: true, account: a };
  }

  const STATUS: Record<string, number> = { bad_email: 400, too_many_requests: 429, email_failed: 502, code_expired: 400, too_many_attempts: 429, wrong_code: 400 };

  /** For apps (service binding): sign-in inside the app with a smeLab email code. */
  async function appStartEmailCode(email: string, lang: 'ms' | 'en', ip: string) {
    return startEmailCode(email, lang, ip);
  }
  async function appVerifyEmailCode(email: string, code: string): Promise<{ ok: true; app: AppAccount } | { ok: false; error: string; attemptsLeft?: number }> {
    const r = await verifyEmailCode(email, code);
    if (!r.ok) return r;
    return { ok: true, app: { account: { id: r.account.id, email: r.account.email, name: r.account.name }, products: [...(await owned(r.account))] } };
  }

  // ---------- buying ----------

  async function earlyUsed(): Promise<Record<Product, number>> {
    return { untunglab: await d.store.countEarly('untunglab'), jualanlab: await d.store.countEarly('jualanlab') };
  }

  async function offersFor(a: Account | null): Promise<Record<Item, Offer | string>> {
    const own = a ? await owned(a) : new Set<Product>();
    const used = await earlyUsed();
    const out = {} as Record<Item, Offer | string>;
    for (const item of ITEMS) out[item] = offerFor(item, own, used, cfg);
    const t = cfg.testers;
    if (a && t && t.emails.includes(a.email) && !own.has('jualanlab')) {
      out.jualanlab = { item: 'jualanlab', products: ['jualanlab'], amountSen: t.jualanlabSen, kind: 'normal', fullSen: cfg.prices.jualanlab.normalSen };
    }
    return out;
  }

  /** Asks ToyyibPay whether the bill is paid in full; only then does the account get the apps (never on the callback alone). */
  async function confirmOrder(order: Order): Promise<Order> {
    let first = false;
    if (order.status === 'pending' && d.toyyib) {
      let tx;
      try {
        tx = await d.toyyib.getTransactions(order.billCode);
      } catch (e) {
        console.error('getTransactions failed', e);
        return order;
      }
      const ok = tx.some((t) => (t.orderId === '' || t.orderId === order.id) && t.status === '1' && t.amountSen === order.amountSen);
      if (!ok) return order;
      first = await d.store.markOrderPaid(order.id, iso());
    }
    const now = (await d.store.getOrder(order.id)) ?? order;
    if (now.status === 'paid') await deliver(now, first);
    return (await d.store.getOrder(order.id)) ?? now;
  }

  /**
   * Gives a paid order's apps to the account, issues the UntungLab licence, emails the receipt. Safe to repeat. The
   * licence and the receipt come from the call that marked the order paid; another call (the callback and the
   * buyer's page often check at the same moment) retries them only after a minute, so nothing is issued twice.
   */
  async function deliver(order: Order, first: boolean): Promise<void> {
    const settled = first || (order.paidAt !== null && d.now().getTime() - Date.parse(order.paidAt) > RETRY_AFTER_MS);
    for (const product of productsOf(order.item)) {
      await d.store.addEntitlement({ id: d.newId(), accountId: order.accountId, product, source: 'purchase', orderId: order.id, ulCode: null, createdAt: iso(), revokedAt: null });
    }
    let ulCode = order.ulCode;
    if (productsOf(order.item).includes('untunglab') && !ulCode && d.untungLab && settled) {
      try {
        ulCode = await d.untungLab.issue(order.name, order.email, `smeLab ${order.id} RM${(order.amountSen / 100).toFixed(2)}`);
        await d.store.updateOrder(order.id, { ulCode });
      } catch (e) {
        console.error('UntungLab issue failed; retried on the next check', e);
      }
    }
    if (ulCode) {
      const e = (await d.store.listEntitlements(order.accountId)).find((x) => x.product === 'untunglab' && !x.revokedAt);
      if (e && !e.ulCode) await d.store.setEntitlementUlCode(e.id, ulCode);
    }
    if (!order.receiptSentAt && settled) {
      try {
        await d.mailer.sendReceipt(order.email, { name: order.name, item: order.item, amountSen: order.amountSen, orderId: order.id, ulCode, baseUrl: base, jualanLabOpen: cfg.onSale.jualanlab });
        await d.store.updateOrder(order.id, { receiptSentAt: iso() });
      } catch (e) {
        console.error('receipt email failed', e);
      }
    }
  }

  // ---------- pages ----------

  function langOf(req: Request): Lang {
    const url = new URL(req.url);
    const q = url.searchParams.get('lang');
    if (q === 'en' || q === 'ms') return q;
    const c = readCookie(req, 'sm_lang');
    return c === 'en' ? 'en' : 'ms';
  }

  function safeNext(v: string | null): string {
    return v && v.startsWith('/') && !v.startsWith('//') && v.length < 300 ? v : '/akaun';
  }

  async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (req.method === 'GET' || req.method === 'HEAD') {
        if (path === '/hub.js') return new Response(HUB_JS, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=300' } });
        if (path === '/') {
          const c = await current(req);
          return html(salesPage({ lang: langOf(req), account: c?.account ?? null, offers: await offersFor(c?.account ?? null), cfg }));
        }
        if (path === '/masuk') return await signInRoute(req, url);
        if (path === '/akaun') {
          const c = await current(req);
          if (!c) return redirect(`/masuk?next=${encodeURIComponent('/akaun')}`);
          await pickUpUntungLabLicence(c.account);
          return html(accountPage({
            lang: langOf(req), account: c.account, products: [...(await owned(c.account))], complimentary: complimentary(c.account),
            entitlements: await d.store.listEntitlements(c.account.id), orders: await d.store.listOrders(c.account.id), cfg,
          }));
        }
        if (path === '/beli') {
          const item = url.searchParams.get('item') as Item | null;
          if (!item || !ITEMS.includes(item)) return redirect('/#harga');
          const c = await current(req);
          if (!c) return redirect(`/masuk?next=${encodeURIComponent(`/beli?item=${item}`)}`);
          return html(checkoutPage({ lang: langOf(req), account: c.account, item, offer: (await offersFor(c.account))[item], buyingOpen: !!d.toyyib }));
        }
        if (path === '/beli/selesai') return html(donePage({ lang: langOf(req), orderId: url.searchParams.get('order') ?? '', cfg }));
        if (path === '/privasi') return html(legalPage({ lang: langOf(req), doc: 'privacy' }));
        if (path === '/terma') return html(legalPage({ lang: langOf(req), doc: 'terms' }));
        if (path === '/api/config') return json(200, { googleClientId: cfg.googleClientId || null, devMode: cfg.devMode });
        if (path === '/api/me') {
          const c = await requireAccount(req);
          return json(200, { account: { email: c.account.email, name: c.account.name }, products: [...(await owned(c.account))] });
        }
        const order = /^\/api\/orders\/([0-9a-f]{32})$/.exec(path);
        if (order) {
          const c = await requireAccount(req);
          const o = await d.store.getOrder(order[1]!);
          if (!o || o.accountId !== c.account.id) throw new HttpError(404, 'not_found');
          const after = await confirmOrder(o);
          return json(200, { status: after.status, item: after.item, amountSen: after.amountSen, ulCode: after.ulCode });
        }
        throw new HttpError(404, 'not_found');
      }

      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      if (path === '/api/toyyib/callback') return await callback(req);
      // CSRF guard: changes only from smeLab's own pages.
      if (req.headers.get('origin') !== base) throw new HttpError(403, 'bad_origin');

      switch (path) {
        case '/api/auth/email/start': {
          const b = await body<{ email?: unknown; lang?: unknown }>(req);
          const r = await startEmailCode(b.email, b.lang, req.headers.get('cf-connecting-ip') ?? 'local');
          if (!r.ok) throw new HttpError(STATUS[r.error] ?? 400, r.error);
          return json(200, r);
        }
        case '/api/auth/email/verify': {
          const b = await body<{ email?: unknown; code?: unknown }>(req);
          const r = await verifyEmailCode(b.email, b.code);
          if (!r.ok) throw new HttpError(STATUS[r.error] ?? 400, r.error, r.attemptsLeft !== undefined ? { attemptsLeft: r.attemptsLeft } : {});
          return json(200, { ok: true }, { 'set-cookie': await startSession(r.account.id) });
        }
        case '/api/auth/google': {
          const b = await body<{ credential?: unknown }>(req);
          if (typeof b.credential !== 'string' || b.credential.length > 4096) throw new HttpError(400, 'bad_credential');
          const g = await d.google.verify(b.credential);
          if (!g || !g.emailVerified) throw new HttpError(401, 'google_rejected');
          let a = await d.store.getAccountByGoogleSub(g.sub);
          if (!a) {
            a = await findOrCreate(g.email.toLowerCase(), g.name);
            if (!a.googleSub) await d.store.linkGoogle(a.id, g.sub, g.name);
          }
          return json(200, { ok: true }, { 'set-cookie': await signedIn(a) });
        }
        case '/api/auth/logout': {
          const c = await current(req);
          if (c) await d.store.deleteSession(c.tokenHash);
          return json(200, { ok: true }, { 'set-cookie': cookie('', 0) });
        }
        case '/api/checkout': {
          const c = await requireAccount(req);
          if (!d.toyyib) throw new HttpError(503, 'buying_closed');
          const b = await body<{ item?: unknown; name?: unknown; phone?: unknown }>(req);
          const item = b.item as Item;
          if (!ITEMS.includes(item)) throw new HttpError(400, 'bad_item');
          const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
          const phone = typeof b.phone === 'string' ? b.phone.replace(/[^0-9+]/g, '') : '';
          if (name.length < 2) throw new HttpError(400, 'bad_name');
          if (!/^\+?6?0\d{8,10}$/.test(phone)) throw new HttpError(400, 'bad_phone');
          await rateLimit(`checkout:${c.account.id}`, 10, 3600_000);
          const offer = (await offersFor(c.account))[item];
          if (typeof offer === 'string') throw new HttpError(409, offer);
          const id = [...d.randomBytes(16)].map((x) => x.toString(16).padStart(2, '0')).join('');
          let bill;
          try {
            bill = await d.toyyib.createBill({
              amountSen: offer.amountSen, orderId: id, name, email: c.account.email, phone,
              billName: item === 'combo' ? 'smeLab UntungLab+JualanLab' : item === 'untunglab' ? 'smeLab UntungLab' : 'smeLab JualanLab POS',
              description: 'Bayaran sekali. Dibuka pada akaun smeLab anda sebaik bayaran disahkan.',
              contentEmail: 'Terima kasih. Aplikasi dibuka pada akaun smeLab anda sebaik bayaran disahkan.',
              callbackUrl: `${base}/api/toyyib/callback`, returnUrl: `${base}/beli/selesai?order=${id}`,
            });
          } catch (e) {
            console.error('createBill failed', e);
            throw new HttpError(502, 'payment_unavailable');
          }
          await d.store.createOrder({
            id, accountId: c.account.id, item, priceKind: offer.kind, amountSen: offer.amountSen, name, phone, email: c.account.email,
            status: 'pending', billCode: bill.billCode, ulCode: null, createdAt: iso(), paidAt: null, receiptSentAt: null,
          });
          return json(200, { orderId: id, payUrl: bill.payUrl, amountSen: offer.amountSen });
        }
        case '/api/untunglab/claim': {
          // A licence bought under another email (DECISIONS A-13): the code proves it; one account per code.
          const c = await requireAccount(req);
          if (!d.untungLab) throw new HttpError(503, 'claim_unavailable');
          await rateLimit(`claim:${c.account.id}`, 10, 3600_000);
          const raw = (await body<{ code?: unknown }>(req)).code;
          const code = typeof raw === 'string' ? normaliseUlCode(raw) : null;
          if (!code) throw new HttpError(400, 'bad_code');
          const mine = (await d.store.listEntitlements(c.account.id)).find((e) => e.product === 'untunglab' && !e.revokedAt);
          if (mine) throw new HttpError(409, mine.ulCode === code ? 'already_yours' : 'already_owned');
          const taken = await d.store.entitlementByUlCode(code);
          if (taken) throw new HttpError(409, 'code_taken');
          let active: boolean;
          try {
            active = await d.untungLab.codeActive(code);
          } catch (e) {
            console.error('UntungLab code check failed', e);
            throw new HttpError(502, 'untunglab_unavailable');
          }
          if (!active) throw new HttpError(404, 'code_not_found');
          if (!(await d.store.addEntitlement({ id: d.newId(), accountId: c.account.id, product: 'untunglab', source: 'untunglab_licence', orderId: null, ulCode: code, createdAt: iso(), revokedAt: null }))) {
            throw new HttpError(409, 'already_owned');
          }
          return json(200, { ok: true, ulCode: code });
        }
        case '/api/waitlist': {
          const b = await body<{ email?: unknown; app?: unknown }>(req);
          const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
          if (!EMAIL_RE.test(email)) throw new HttpError(400, 'bad_email');
          if (b.app !== 'promolab' && b.app !== 'kiralab' && b.app !== 'jualanlab') throw new HttpError(400, 'bad_app');
          await rateLimit(`waitlist:${req.headers.get('cf-connecting-ip') ?? 'local'}`, 20, 3600_000);
          await d.store.addToWaitlist(email, b.app, iso());
          return json(200, { ok: true });
        }
        default:
          throw new HttpError(404, 'not_found');
      }
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.code, ...e.extra });
      console.error('unhandled', e);
      return json(500, { error: 'server_error' });
    }
  }

  /** /masuk: signed in → straight back to the app (or the page asked for); otherwise the sign-in page. */
  async function signInRoute(req: Request, url: URL): Promise<Response> {
    const lang = langOf(req);
    const p = url.searchParams;
    const target = p.has('app') ? appFor(p.get('app'), p.get('redirect_uri')) : null;
    if (p.has('app') && !target) return html(signInPage({ lang, error: 'bad_app', cfg }));
    const state = p.get('state') ?? '';
    if (target && !STATE_RE.test(state)) return html(signInPage({ lang, error: 'bad_app', cfg }));
    const c = await current(req);
    const choose = p.get('pilih') === '1';
    if (c && !choose) {
      if (target) return redirect(await backToApp(c.account.id, target, state), c.refreshCookie ? { 'set-cookie': c.refreshCookie } : {});
      return redirect(safeNext(p.get('next')));
    }
    return html(signInPage({ lang, cfg, app: target?.app ?? null, signedInAs: c?.account.email ?? null }));
  }

  async function callback(req: Request): Promise<Response> {
    if (!d.toyyib) return new Response('closed', { status: 503 });
    const text = await req.text();
    if (text.length > 10_000) return new Response('too large', { status: 413 });
    const f = new URLSearchParams(text);
    const status = f.get('status') ?? '';
    const orderId = f.get('order_id') ?? '';
    const refno = f.get('refno') ?? '';
    const hash = (f.get('hash') ?? '').toLowerCase();
    if (!status || !orderId || !refno || !hash) return new Response('bad request', { status: 400 });
    if (!safeEqual(hash, md5(cfg.toyyibSecret + status + orderId + refno + 'ok'))) return new Response('bad hash', { status: 400 });
    if (status !== '1') return new Response('OK');
    const order = /^[0-9a-f]{32}$/.test(orderId) ? await d.store.getOrder(orderId) : null;
    if (!order) return new Response('OK');
    const after = await confirmOrder(order);
    return after.status === 'paid' ? new Response('OK') : new Response('try again', { status: 500 });
  }

  return { fetch: handle, redeem, productsOf: productsOfAccount, untungLabCodeOf, startEmailCode: appStartEmailCode, verifyEmailCode: appVerifyEmailCode };
}

export type Hub = ReturnType<typeof createHub>;
