/**
 * JualanLab HTTP API. Platform-neutral: takes a Request, returns a Response.
 * The Cloudflare Worker (server/worker) and the local dev server (scripts/dev-server.ts) both wrap this.
 */
import { validatePriceList } from '../../src/link/priceList';
import { planImport, planWrites } from '../../src/domain/importPlan';
import { MAX_CATEGORY, MAX_ITEM_NAME, MAX_PRICE_SEN, type Item } from '../../src/domain/items';
import { validateSale, validVoidReason } from '../../src/domain/sale';
import { dayKey, dayRange, isDayKey } from '../../src/domain/day';
import { envelopes, expectedCash, summarise } from '../../src/domain/summary';
import { base64url, safeEqual, sha256Hex, sixDigitCode } from './crypto';
import { md5 } from './md5';
import { isDayId } from '../../src/domain/bizday';
import type { Sale } from '../../src/domain/sale';
import type { GoogleVerifier, Mailer, Order, PriceKind, Product, ServerDay, Shop, Store, ToyyibClient, UntungLabLicences, User } from './ports';
import { normaliseUlCode } from './untunglab';

/** Free plan: everything, up to this many active items, no UntungLab link (Mamu, 9 Oct). */
export const FREE_ITEM_LIMIT = 10;

export interface BillingConfig {
  priceSen: number;
  earlyBirdPriceSen: number;
  earlyBirdSlots: number;
  untungLabUserPriceSen: number;
  bundlePriceSen: number;
  /** This app's public address, for ToyyibPay's callback and return pages. */
  publicBaseUrl: string;
  /** ToyyibPay user secret key, also used to check the callback hash. */
  toyyibSecret: string;
}

export interface Config {
  /** Origins allowed to make changes (CSRF guard), e.g. https://jualan.untunglab.space. */
  appOrigins: string[];
  /** Secret mixed into login-code hashes. */
  codePepper: string;
  /** Secure cookies; false only for local http development. */
  secureCookies: boolean;
  /** Local development: email codes are returned in the response instead of only emailed. Never on in production. */
  devMode: boolean;
  /** Google OAuth client id shown to the sign-in page; empty = Google sign-in off. */
  googleClientId: string;
  /** Buying the full POS. Absent (or no ToyyibPay client) = buying not open yet. */
  billing?: BillingConfig;
  /** Owner and tester accounts that get the full POS without paying (lower-case emails). */
  complimentaryEmails?: string[];
  /**
   * Before launch: no new accounts, except the tester list above. Accounts that already exist keep working.
   * Turned off at launch (PRELAUNCH var).
   */
  prelaunch?: boolean;
  /** Before launch: may sign up but stay on Free, to test buying for real (lower-case emails). */
  testerEmails?: string[];
}

export interface Deps {
  store: Store;
  mailer: Mailer;
  google: GoogleVerifier;
  config: Config;
  now: () => Date;
  randomBytes: (n: number) => Uint8Array;
  newId: () => string;
  /** ToyyibPay. Null until the shop owner's ToyyibPay key and category are set. */
  toyyib?: ToyyibClient | null;
  /** UntungLab licence server. Null = no UntungLab-user price and no bundle. */
  untungLab?: UntungLabLicences | null;
}

export const SESSION_COOKIE = 'jl_session';
const SESSION_DAYS = 60;
const HITS_KEEP_MS = 2 * 86400_000;
const CODE_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
const EMAIL_SENDS_PER_HOUR = 5;
const IP_SENDS_PER_HOUR = 20;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

class HttpError extends Error {
  constructor(public status: number, public code: string, public extra: Record<string, unknown> = {}) {
    super(code);
  }
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

export function createHandler(d: Deps) {
  const iso = (msFromNow = 0) => new Date(d.now().getTime() + msFromNow).toISOString();

  function cookie(token: string, maxAgeS: number): string {
    return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${d.config.secureCookies ? '; Secure' : ''}`;
  }

  function readCookie(req: Request): string | null {
    const raw = req.headers.get('cookie') ?? '';
    for (const part of raw.split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === SESSION_COOKIE) return v.join('=') || null;
    }
    return null;
  }

  async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
    if (!(req.headers.get('content-type') ?? '').includes('application/json')) throw new HttpError(415, 'json_required');
    const text = await req.text();
    if (text.length > 1_100_000) throw new HttpError(413, 'too_large');
    try {
      const v = JSON.parse(text) as unknown;
      if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error();
      return v as T;
    } catch {
      throw new HttpError(400, 'bad_json');
    }
  }

  async function startSession(userId: string): Promise<string> {
    const token = base64url(d.randomBytes(32));
    await d.store.createSession(await sha256Hex(token), userId, iso(), iso(SESSION_DAYS * 86400_000));
    return cookie(token, SESSION_DAYS * 86400);
  }

  async function currentUser(req: Request): Promise<{ user: User; tokenHash: string; refreshCookie?: string } | null> {
    const token = readCookie(req);
    if (!token) return null;
    const tokenHash = await sha256Hex(token);
    const s = await d.store.getSession(tokenHash);
    if (!s || s.expiresAt <= iso()) return null;
    const user = await d.store.getUserById(s.userId);
    if (!user) return null;
    // Sliding expiry: renewed when less than half the lifetime is left.
    if (Date.parse(s.expiresAt) - d.now().getTime() < (SESSION_DAYS / 2) * 86400_000) {
      await d.store.extendSession(tokenHash, iso(SESSION_DAYS * 86400_000));
      return { user, tokenHash, refreshCookie: cookie(token, SESSION_DAYS * 86400) };
    }
    return { user, tokenHash };
  }

  async function requireUser(req: Request) {
    const u = await currentUser(req);
    if (!u) throw new HttpError(401, 'signed_out');
    return u;
  }

  async function requireShop(user: User): Promise<Shop> {
    const shop = await d.store.getShopByOwner(user.id);
    if (!shop) throw new HttpError(409, 'no_shop');
    return complimentary(user, shop);
  }

  /** Owner/tester accounts are moved to the full POS the first time their shop is used. */
  async function complimentary(user: User, shop: Shop): Promise<Shop> {
    if ((shop.plan ?? 'free') === 'pos' || !(d.config.complimentaryEmails ?? []).includes(user.email)) return shop;
    await d.store.setShopPlan(shop.id, 'pos', iso());
    return { ...shop, plan: 'pos', planSince: iso() };
  }

  // ---- business days (T-07) ----

  /** Follows joins to the day that holds the sales now. */
  async function canonicalDay(shopId: string, id: string): Promise<ServerDay | null> {
    let day = await d.store.getDay(shopId, id);
    for (let hops = 0; day?.mergedInto && hops < 10; hops++) day = await d.store.getDay(shopId, day.mergedInto);
    return day;
  }

  async function dayInfo(x: ServerDay) {
    const counted = (await d.store.listClosesOfDay(x.shopId, x.id)).length > 0;
    return { id: x.id, openedAt: x.openedAt, closedAt: x.closedAt, floatSen: x.floatSen, counted };
  }

  /** A time sent by a phone, as a UTC ISO string; a phone clock running ahead is held to the server's now. */
  function phoneTime(v: string): string {
    const t = Date.parse(v);
    return new Date(Math.min(t, d.now().getTime())).toISOString();
  }

  /**
   * Opens a day made on a phone, or one the server starts because a sale reached it first ('auto'). Safe to repeat.
   * When the shop already had a day open at that moment (two phones opened without internet), the new day is joined
   * to it and its sales go there. Returns the day that now holds this day's sales.
   */
  async function openDay(
    shopId: string,
    input: { id: string; openedAt: string; floatSen: number; deviceId: string; lastSeenDayId?: string | null },
    attempt = 0,
  ): Promise<ServerDay> {
    const existing = await d.store.getDay(shopId, input.id);
    if (existing) {
      if (existing.openedDeviceId === 'auto' && input.deviceId !== 'auto') {
        // Started from one of its sales; the real opening now says when, and with how much cash.
        const openedAt = input.openedAt < existing.openedAt ? input.openedAt : existing.openedAt;
        await d.store.updateDay(shopId, existing.id, existing.mergedInto ? { openedDeviceId: input.deviceId } : { openedDeviceId: input.deviceId, floatSen: input.floatSen, openedAt });
      }
      const day = (await canonicalDay(shopId, input.id))!;
      if (input.openedAt < day.openedAt) {
        await d.store.updateDay(shopId, day.id, { openedAt: input.openedAt });
        return { ...day, openedAt: input.openedAt };
      }
      return day;
    }
    // A day already open joins it (one open day per shop). A day that has ended since joins it only when this phone
    // never heard of that day (it was offline all along); a phone that saw it close is opening a new day, even if
    // its clock runs a little behind. A day started from a sale never joins an ended day.
    const seen = input.lastSeenDayId ? await canonicalDay(shopId, input.lastSeenDayId) : null;
    let host = await d.store.dayAt(shopId, input.openedAt);
    if (host && host.closedAt !== null && (input.deviceId === 'auto' || (seen && seen.openedAt >= host.openedAt))) host = null;
    host ??= await d.store.openDay(shopId);
    let openedAt = input.openedAt;
    if (!host && seen?.closedAt && openedAt < seen.closedAt) openedAt = seen.closedAt;
    const day: ServerDay = { id: input.id, shopId, openedAt, openedDeviceId: input.deviceId, floatSen: input.floatSen, closedAt: null, mergedInto: host?.id ?? null };
    try {
      await d.store.insertDay(day, iso());
    } catch (e) {
      // Another phone opened a day in the same moment: look again and join it.
      if (attempt === 0) return openDay(shopId, input, 1);
      console.error('openDay', e);
      throw new HttpError(400, 'bad_day');
    }
    if (!host) return day;
    if (input.openedAt < host.openedAt && host.closedAt === null) {
      await d.store.updateDay(shopId, host.id, { openedAt: input.openedAt });
      return { ...host, openedAt: input.openedAt };
    }
    return host;
  }

  /** The day a sale belongs in: its own (started by the server if it got here first), or for an app from before business days, the day open when it was made. */
  async function dayForSale(shopId: string, sale: Sale): Promise<ServerDay> {
    const at = phoneTime(sale.createdAt);
    if (sale.dayId) return openDay(shopId, { id: sale.dayId, openedAt: at, floatSen: 0, deviceId: 'auto' });
    const open = (await d.store.dayAt(shopId, at)) ?? (await d.store.openDay(shopId));
    return open ?? openDay(shopId, { id: d.newId(), openedAt: at, floatSen: 0, deviceId: 'auto' });
  }

  /** Free-plan limit only stops adding; nothing already there is removed or hidden. */
  async function checkItemLimit(shop: Shop) {
    if ((shop.plan ?? 'free') === 'pos') return;
    if ((await d.store.countActiveItems(shop.id)) >= FREE_ITEM_LIMIT) throw new HttpError(403, 'plan_limit', { limit: FREE_ITEM_LIMIT });
  }

  // ---------- buying the full POS ----------

  const buyingOpen = () => !!(d.config.billing && d.toyyib);

  async function prices() {
    const b = d.config.billing!;
    const earlyUsed = await d.store.countPaidOrders('early');
    const earlyLeft = Math.max(0, b.earlyBirdSlots - earlyUsed);
    return {
      normalSen: b.priceSen,
      early: earlyLeft > 0 ? { priceSen: b.earlyBirdPriceSen, left: earlyLeft } : null,
      untungLabSen: d.untungLab ? b.untungLabUserPriceSen : null,
      bundleSen: d.untungLab ? b.bundlePriceSen : null,
    };
  }

  /** Why an UntungLab code cannot give the UntungLab-user price, or null when it can. */
  async function ulCodeProblem(raw: unknown): Promise<string | null> {
    const code = typeof raw === 'string' ? normaliseUlCode(raw) : null;
    if (!code) return 'ul_code_format';
    if (!d.untungLab) return 'ul_unavailable';
    if (await d.store.ulCodeUsed(code)) return 'ul_code_used';
    let state: 'active' | 'revoked' | 'unknown';
    try {
      state = await d.untungLab.check(code);
    } catch (e) {
      console.error('UntungLab check failed', e);
      return 'ul_unavailable';
    }
    return state === 'active' ? null : state === 'revoked' ? 'ul_code_revoked' : 'ul_code_unknown';
  }

  /**
   * Asks ToyyibPay directly whether the bill is paid with the right amount, and only then opens the full POS.
   * Shared by the callback and by the app's own polling, so confirmation never depends on the callback alone (UntungLab D-64).
   */
  async function confirmOrder(order: Order): Promise<void> {
    if (order.status === 'pending') {
      let tx;
      try {
        tx = await d.toyyib!.getTransactions(order.billCode);
      } catch (e) {
        console.error('getTransactions failed', e);
        return;
      }
      const ok = tx.some((t) => (t.orderId === '' || t.orderId === order.id) && t.status === '1' && t.amountSen === order.amountSen);
      if (!ok) return;
      let first: boolean;
      try {
        first = await d.store.markOrderPaid(order.id, iso());
      } catch (e) {
        // Two paid orders with the same UntungLab code (a race): they paid, so honour it.
        console.error('markOrderPaid failed', e);
        return;
      }
      if (first) {
        await d.store.setShopPlan(order.shopId, 'pos', iso());
        const shop = await d.store.getShopById(order.shopId);
        try {
          await d.mailer.sendPurchaseReceipt(order.email, { name: order.name, shopName: shop?.name ?? '', amountSen: order.amountSen, orderId: order.id, bundle: order.product === 'bundle' });
          await d.store.updateOrder(order.id, { emailSentAt: iso() });
        } catch (e) {
          console.error('receipt email failed', e);
        }
      }
      order = { ...order, status: 'paid' };
    }
    // Bundle: the UntungLab licence is created (and emailed by UntungLab) once; retried on the next check if it failed.
    if (order.status === 'paid' && order.product === 'bundle' && !order.ulIssuedCode && d.untungLab) {
      try {
        const code = await d.untungLab.issue(order.name, order.email);
        await d.store.updateOrder(order.id, { ulIssuedCode: code });
      } catch (e) {
        console.error('UntungLab issue failed; will retry', e);
      }
    }
  }

  async function rateLimit(key: string, max: number, windowMs: number) {
    if ((await d.store.countHits(key, iso(-windowMs))) >= max) throw new HttpError(429, 'too_many_requests');
    await d.store.recordHit(key, iso());
    // Counters hold IP addresses and emails: kept two days at most (privacy notice).
    await d.store.pruneHits(iso(-HITS_KEEP_MS));
  }

  /** Before launch only existing accounts and listed testers get in (Mamu, 14 Oct). */
  async function mayEnter(email: string): Promise<boolean> {
    if (!d.config.prelaunch) return true;
    if ((d.config.complimentaryEmails ?? []).includes(email)) return true;
    if ((d.config.testerEmails ?? []).includes(email)) return true;
    return (await d.store.getUserByEmail(email)) !== null;
  }

  async function findOrCreateUser(email: string, name: string | null): Promise<User> {
    const existing = await d.store.getUserByEmail(email);
    if (existing) return existing;
    if (!(await mayEnter(email))) throw new HttpError(403, 'prelaunch');
    const u: User = { id: d.newId(), email, name, googleSub: null, createdAt: iso() };
    await d.store.createUser(u);
    return u;
  }

  async function meBody(user: User) {
    const found = await d.store.getShopByOwner(user.id);
    const shop = found ? await complimentary(user, found) : null;
    return {
      user: { id: user.id, email: user.email, name: user.name },
      shop: shop ? { id: shop.id, name: shop.name, plan: shop.plan ?? 'free' } : null,
      lastImport: shop ? await d.store.lastImport(shop.id) : null,
    };
  }

  const routes: { method: string; path: RegExp; run: (req: Request, m: RegExpMatchArray) => Promise<Response> }[] = [
    {
      // Public settings the sign-in page needs.
      method: 'GET', path: /^\/api\/config$/,
      run: async () => json(200, { googleClientId: d.config.googleClientId || null, devMode: d.config.devMode, prelaunch: !!d.config.prelaunch }),
    },
    {
      method: 'POST', path: /^\/api\/auth\/email\/start$/,
      run: async (req) => {
        const b = await body<{ email?: unknown; lang?: unknown }>(req);
        const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
        if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpError(400, 'bad_email');
        const lang = b.lang === 'en' ? 'en' : 'ms';
        // No code is sent to an address that could not get in before launch.
        if (!(await mayEnter(email))) throw new HttpError(403, 'prelaunch');
        await rateLimit(`code:email:${email}`, EMAIL_SENDS_PER_HOUR, 3600_000);
        await rateLimit(`code:ip:${req.headers.get('cf-connecting-ip') ?? 'local'}`, IP_SENDS_PER_HOUR, 3600_000);
        const code = sixDigitCode(d.randomBytes);
        await d.store.putLoginCode({ email, codeHash: await sha256Hex(`${d.config.codePepper}:${email}:${code}`), expiresAt: iso(CODE_MINUTES * 60_000), attempts: 0, sentAt: iso() });
        if (d.config.devMode) return json(200, { ok: true, devCode: code });
        try {
          await d.mailer.sendLoginCode(email, code, lang);
        } catch {
          throw new HttpError(502, 'email_failed');
        }
        return json(200, { ok: true });
      },
    },
    {
      method: 'POST', path: /^\/api\/auth\/email\/verify$/,
      run: async (req) => {
        const b = await body<{ email?: unknown; code?: unknown }>(req);
        const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
        const code = typeof b.code === 'string' ? b.code.replace(/\s/g, '') : '';
        const rec = await d.store.getLoginCode(email);
        if (!rec || rec.expiresAt <= iso()) throw new HttpError(400, 'code_expired');
        if (rec.attempts >= MAX_CODE_ATTEMPTS) throw new HttpError(429, 'too_many_attempts');
        const hash = await sha256Hex(`${d.config.codePepper}:${email}:${code}`);
        if (!/^\d{6}$/.test(code) || !safeEqual(hash, rec.codeHash)) {
          await d.store.countLoginAttempt(email);
          throw new HttpError(400, 'wrong_code', { attemptsLeft: Math.max(0, MAX_CODE_ATTEMPTS - rec.attempts - 1) });
        }
        await d.store.deleteLoginCode(email);
        const user = await findOrCreateUser(email, null);
        return json(200, await meBody(user), { 'set-cookie': await startSession(user.id) });
      },
    },
    {
      method: 'POST', path: /^\/api\/auth\/google$/,
      run: async (req) => {
        const b = await body<{ credential?: unknown }>(req);
        if (typeof b.credential !== 'string' || b.credential.length > 4096) throw new HttpError(400, 'bad_credential');
        const g = await d.google.verify(b.credential);
        if (!g || !g.emailVerified) throw new HttpError(401, 'google_rejected');
        let user = await d.store.getUserByGoogleSub(g.sub);
        if (!user) {
          user = await findOrCreateUser(g.email, g.name);
          if (!user.googleSub) await d.store.linkGoogle(user.id, g.sub, g.name);
        }
        return json(200, await meBody(user), { 'set-cookie': await startSession(user.id) });
      },
    },
    {
      method: 'POST', path: /^\/api\/auth\/logout$/,
      run: async (req) => {
        const u = await currentUser(req);
        if (u) await d.store.deleteSession(u.tokenHash);
        return json(200, { ok: true }, { 'set-cookie': cookie('', 0) });
      },
    },
    {
      method: 'GET', path: /^\/api\/me$/,
      run: async (req) => {
        const u = await requireUser(req);
        return json(200, await meBody(u.user), u.refreshCookie ? { 'set-cookie': u.refreshCookie } : {});
      },
    },
    {
      method: 'POST', path: /^\/api\/shop$/,
      run: async (req) => {
        const { user } = await requireUser(req);
        const b = await body<{ name?: unknown }>(req);
        const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : '';
        if (name.length < 1 || name.length > 60) throw new HttpError(400, 'bad_name');
        const shop = await d.store.getShopByOwner(user.id);
        if (shop) await d.store.renameShop(shop.id, name);
        else await d.store.createShop({ id: d.newId(), ownerId: user.id, name, createdAt: iso() });
        return json(200, await meBody(user));
      },
    },
    {
      method: 'GET', path: /^\/api\/items$/,
      run: async (req) => {
        const shop = await requireShop((await requireUser(req)).user);
        return json(200, { items: await d.store.listItems(shop.id), lastImport: await d.store.lastImport(shop.id) });
      },
    },
    {
      method: 'POST', path: /^\/api\/items\/import$/,
      run: async (req) => {
        const shop = await requireShop((await requireUser(req)).user);
        if ((shop.plan ?? 'free') !== 'pos') throw new HttpError(403, 'plan_required');
        const b = await body<{ priceList?: unknown }>(req);
        const checked = validatePriceList(b.priceList);
        if (!checked.ok) throw new HttpError(400, 'bad_price_list', { linkError: checked.error });
        const now = iso();
        const plan = planImport(await d.store.listItems(shop.id), checked.value, { now, newId: d.newId });
        await d.store.saveImport(shop.id, planWrites(plan), { id: d.newId(), sentAt: checked.value.sentAt, receivedAt: now, menus: checked.value.menus.length });
        return json(200, {
          added: plan.add.length, changed: plan.change.length, same: plan.same.length, deactivated: plan.deactivate.length,
          items: await d.store.listItems(shop.id), lastImport: await d.store.lastImport(shop.id),
        });
      },
    },
    {
      method: 'POST', path: /^\/api\/items$/,
      run: async (req) => {
        const shop = await requireShop((await requireUser(req)).user);
        const b = await body(req);
        await checkItemLimit(shop);
        const it: Item = {
          id: d.newId(), source: 'own', ulMenuId: null, name: itemName(b.name), category: itemCategory(b.category),
          priceSen: itemPrice(b.priceSen), ulPriceSen: null, marginPct: null, status: null, baseUlMenuId: null, active: true, updatedAt: iso(),
        };
        await d.store.saveItems(shop.id, [it]);
        return json(201, { item: it });
      },
    },
    {
      method: 'PATCH', path: /^\/api\/items\/([A-Za-z0-9_-]{1,64})$/,
      run: async (req, m) => {
        const shop = await requireShop((await requireUser(req)).user);
        const existing = await d.store.getItem(shop.id, m[1]!);
        if (!existing) throw new HttpError(404, 'not_found');
        const b = await body(req);
        const next: Item = { ...existing, updatedAt: iso() };
        if ('name' in b || 'category' in b) {
          // UntungLab owns these for its menus; change them there and send the list again.
          if (existing.source === 'untunglab') throw new HttpError(400, 'set_in_untunglab');
          if ('name' in b) next.name = itemName(b.name);
          if ('category' in b) next.category = itemCategory(b.category);
        }
        if ('priceSen' in b) next.priceSen = itemPrice(b.priceSen);
        if ('active' in b) {
          if (typeof b.active !== 'boolean') throw new HttpError(400, 'bad_active');
          if (b.active && !existing.active) await checkItemLimit(shop);
          next.active = b.active;
        }
        await d.store.saveItems(shop.id, [next]);
        return json(200, { item: next });
      },
    },
    {
      method: 'POST', path: /^\/api\/sales$/,
      run: async (req) => {
        const shop = await requireShop((await requireUser(req)).user);
        const b = await body<{ sale?: unknown }>(req);
        const v = validateSale(b.sale);
        if (!v.ok) throw new HttpError(400, 'bad_sale', { detail: v.error });
        const known = new Set((await d.store.listItems(shop.id)).map((i) => i.id));
        const unknown = v.sale.lines.find((l) => !known.has(l.itemId));
        if (unknown) throw new HttpError(400, 'unknown_item', { itemId: unknown.itemId });
        const day = await dayForSale(shop.id, v.sale);
        const result = await d.store.saveSale(shop.id, { ...v.sale, dayId: day.id }, iso());
        if (result === 'exists') {
          // Sent once as done (answer lost), voided on the phone, sent again: the void must not be lost.
          if (v.sale.status === 'void') await d.store.voidSale(shop.id, v.sale.id, v.sale.voidReason!, v.sale.voidedAt ?? iso());
          const stored = await d.store.getSale(shop.id, v.sale.id);
          return json(200, { status: result, dayId: stored?.dayId ?? day.id });
        }
        return json(201, { status: result, dayId: day.id });
      },
    },
    {
      method: 'GET', path: /^\/api\/billing$/,
      run: async (req) => {
        const shop = await requireShop((await requireUser(req)).user);
        const open = buyingOpen();
        return json(200, {
          plan: shop.plan ?? 'free', planSince: shop.planSince ?? null, freeItemLimit: FREE_ITEM_LIMIT,
          activeItems: await d.store.countActiveItems(shop.id), buyingOpen: open, prices: open ? await prices() : null,
        });
      },
    },
    {
      method: 'POST', path: /^\/api\/billing\/check-ul$/,
      run: async (req) => {
        const { user } = await requireUser(req);
        await rateLimit(`ulcheck:${user.id}`, 10, 3600_000);
        const b = await body<{ code?: unknown }>(req);
        const problem = await ulCodeProblem(b.code);
        return json(200, problem ? { ok: false, error: problem } : { ok: true, code: normaliseUlCode(b.code as string) });
      },
    },
    {
      method: 'POST', path: /^\/api\/billing\/checkout$/,
      run: async (req) => {
        const { user } = await requireUser(req);
        const shop = await requireShop(user);
        if (!buyingOpen()) throw new HttpError(503, 'buying_closed');
        if ((shop.plan ?? 'free') === 'pos') throw new HttpError(409, 'already_paid');
        await rateLimit(`checkout:${shop.id}`, 10, 3600_000);
        const b = await body<{ product?: unknown; name?: unknown; phone?: unknown; ulCode?: unknown }>(req);
        const product: Product = b.product === 'bundle' ? 'bundle' : 'pos';
        const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
        const phone = typeof b.phone === 'string' ? b.phone.replace(/[^0-9+]/g, '') : '';
        if (name.length < 2) throw new HttpError(400, 'bad_name');
        if (!/^\+?\d{9,15}$/.test(phone)) throw new HttpError(400, 'bad_phone');
        const p = await prices();
        let priceKind: PriceKind;
        let amountSen: number;
        let ulCode: string | null = null;
        if (product === 'bundle') {
          if (p.bundleSen === null) throw new HttpError(503, 'ul_unavailable');
          priceKind = 'bundle';
          amountSen = p.bundleSen;
        } else if (b.ulCode !== undefined && b.ulCode !== null && b.ulCode !== '') {
          const problem = await ulCodeProblem(b.ulCode);
          if (problem) throw new HttpError(400, problem);
          priceKind = 'untunglab';
          amountSen = p.untungLabSen!;
          ulCode = normaliseUlCode(b.ulCode as string);
        } else if (p.early) {
          priceKind = 'early';
          amountSen = p.early.priceSen;
        } else {
          priceKind = 'normal';
          amountSen = p.normalSen;
        }
        const id = Array.from(d.randomBytes(16), (x) => x.toString(16).padStart(2, '0')).join('');
        const cfg = d.config.billing!;
        let bill: { billCode: string; payUrl: string };
        try {
          bill = await d.toyyib!.createBill({
            amountSen, orderId: id, name, email: user.email, phone,
            billName: product === 'bundle' ? 'JualanLab + UntungLab' : 'JualanLab POS penuh',
            description: product === 'bundle' ? 'JualanLab POS penuh dan UntungLab, sekali bayar' : 'JualanLab POS penuh, sekali bayar',
            callbackUrl: `${cfg.publicBaseUrl}/api/billing/toyyib/callback`,
            returnUrl: `${cfg.publicBaseUrl}/pelan`,
          });
        } catch (e) {
          console.error('createBill failed', e);
          throw new HttpError(502, 'payment_unavailable');
        }
        await d.store.createOrder({
          id, shopId: shop.id, email: user.email, name, phone, product, priceKind, amountSen, ulCode, status: 'pending',
          billCode: bill.billCode, ulIssuedCode: null, createdAt: iso(), paidAt: null, emailSentAt: null,
        });
        return json(200, { orderId: id, payUrl: bill.payUrl, amountSen });
      },
    },
    {
      method: 'GET', path: /^\/api\/billing\/orders\/([0-9a-f]{32})$/,
      run: async (req, m) => {
        const shop = await requireShop((await requireUser(req)).user);
        let order = await d.store.getOrder(m[1]!);
        if (!order || order.shopId !== shop.id) throw new HttpError(404, 'not_found');
        if (buyingOpen()) {
          await confirmOrder(order);
          order = (await d.store.getOrder(order.id)) ?? order;
        }
        return json(200, { status: order.status, product: order.product, amountSen: order.amountSen, ulIssuedCode: order.ulIssuedCode });
      },
    },
    {
      // ToyyibPay posts a form here. Never trusted alone: the hash must match AND ToyyibPay must confirm when asked.
      method: 'POST', path: /^\/api\/billing\/toyyib\/callback$/,
      run: async (req) => {
        if (!buyingOpen()) return new Response('closed', { status: 503 });
        const text = await req.text();
        if (text.length > 10_000) return new Response('too large', { status: 413 });
        const f = new URLSearchParams(text);
        const status = f.get('status') ?? '';
        const orderId = f.get('order_id') ?? '';
        const refno = f.get('refno') ?? '';
        const hash = (f.get('hash') ?? '').toLowerCase();
        if (!status || !orderId || !refno || !hash) return new Response('bad request', { status: 400 });
        if (!safeEqual(hash, md5(d.config.billing!.toyyibSecret + status + orderId + refno + 'ok'))) return new Response('bad hash', { status: 400 });
        if (status !== '1') return new Response('OK');
        const order = /^[0-9a-f]{32}$/.test(orderId) ? await d.store.getOrder(orderId) : null;
        if (!order) return new Response('OK');
        await confirmOrder(order);
        const after = await d.store.getOrder(order.id);
        return after?.status === 'paid' ? new Response('OK') : new Response('try again', { status: 500 });
      },
    },
    {
      // Local development only: switch plans without paying.
      method: 'POST', path: /^\/api\/dev\/plan$/,
      run: async (req) => {
        if (!d.config.devMode) throw new HttpError(404, 'not_found');
        const shop = await requireShop((await requireUser(req)).user);
        const b = await body<{ plan?: unknown }>(req);
        await d.store.setShopPlan(shop.id, b.plan === 'pos' ? 'pos' : 'free', iso());
        return json(200, { ok: true });
      },
    },
    {
      method: 'GET', path: /^\/api\/sales\/([A-Za-z0-9_-]{8,64})$/,
      run: async (req, m) => {
        const shop = await requireShop((await requireUser(req)).user);
        const sale = await d.store.getSale(shop.id, m[1]!);
        if (!sale) throw new HttpError(404, 'not_found');
        return json(200, { sale });
      },
    },
    {
      method: 'POST', path: /^\/api\/sales\/([A-Za-z0-9_-]{8,64})\/void$/,
      run: async (req, m) => {
        const shop = await requireShop((await requireUser(req)).user);
        const b = await body<{ reason?: unknown; voidedAt?: unknown }>(req);
        if (!validVoidReason(b.reason)) throw new HttpError(400, 'bad_reason');
        const at = typeof b.voidedAt === 'string' && Number.isFinite(Date.parse(b.voidedAt)) ? new Date(b.voidedAt).toISOString() : iso();
        const r = await d.store.voidSale(shop.id, m[1]!, b.reason.trim(), at);
        if (r === 'not_found') throw new HttpError(404, 'not_found');
        return json(200, { status: r });
      },
    },
    {
      method: 'GET', path: /^\/api\/days\/(\d{4}-\d{2}-\d{2})$/,
      run: async (req, m) => {
        const shop = await requireShop((await requireUser(req)).user);
        if (!isDayKey(m[1])) throw new HttpError(400, 'bad_day');
        const { from, to } = dayRange(m[1]);
        return json(200, { day: m[1], sales: await d.store.listSales(shop.id, from, to), closes: await d.store.listDayCloses(shop.id, m[1]) });
      },
    },
    {
      method: 'GET', path: /^\/api\/days$/,
      run: async (req) => {
        const shop = await requireShop((await requireUser(req)).user);
        const days = (await d.store.listDays(shop.id, 60)).map((x) => ({ id: x.id, openedAt: x.openedAt, closedAt: x.closedAt, floatSen: x.floatSen, counted: x.counted }));
        return json(200, { days, open: days.find((x) => x.closedAt === null) ?? null });
      },
    },
    {
      method: 'POST', path: /^\/api\/days\/open$/,
      run: async (req) => {
        const shop = await requireShop((await requireUser(req)).user);
        const b = await body<{ id?: unknown; openedAt?: unknown; floatSen?: unknown; deviceId?: unknown; lastSeenDayId?: unknown }>(req);
        if (!isDayId(b.id)) throw new HttpError(400, 'bad_day');
        if (typeof b.openedAt !== 'string' || !Number.isFinite(Date.parse(b.openedAt))) throw new HttpError(400, 'bad_time');
        if (!money(b.floatSen)) throw new HttpError(400, 'bad_float');
        const deviceId = typeof b.deviceId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(b.deviceId) ? b.deviceId : 'unknown';
        const lastSeenDayId = isDayId(b.lastSeenDayId) ? b.lastSeenDayId : null;
        const day = await openDay(shop.id, { id: b.id, openedAt: phoneTime(b.openedAt), floatSen: b.floatSen, deviceId, lastSeenDayId });
        return json(200, { day: await dayInfo(day), joined: day.id !== b.id });
      },
    },
    {
      method: 'GET', path: /^\/api\/days\/([A-Za-z0-9_-]{8,64})$/,
      run: async (req, m) => {
        const shop = await requireShop((await requireUser(req)).user);
        const day = await canonicalDay(shop.id, m[1]!);
        if (!day) throw new HttpError(404, 'not_found');
        return json(200, { day: await dayInfo(day), sales: await d.store.listSalesOfDay(shop.id, day.id), closes: await d.store.listClosesOfDay(shop.id, day.id) });
      },
    },
    {
      method: 'POST', path: /^\/api\/days\/([A-Za-z0-9_-]{8,64})\/close$/,
      run: async (req, m) => {
        const shop = await requireShop((await requireUser(req)).user);
        const b = await body<{ floatSen?: unknown; countedCashSen?: unknown; note?: unknown; deviceId?: unknown }>(req);
        if (!money(b.floatSen)) throw new HttpError(400, 'bad_float');
        if (!money(b.countedCashSen)) throw new HttpError(400, 'bad_counted');
        const day = await canonicalDay(shop.id, m[1]!);
        if (!day) throw new HttpError(404, 'not_found');
        const note = typeof b.note === 'string' ? b.note.trim().slice(0, 200) : '';
        const deviceId = typeof b.deviceId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(b.deviceId) ? b.deviceId : 'unknown';
        // The server adds up the day itself from the sales it holds.
        const summary = summarise(await d.store.listSalesOfDay(shop.id, day.id));
        const closedAt = iso();
        const close = {
          id: d.newId(), shopId: shop.id, day: dayKey(new Date(day.openedAt)), bizDayId: day.id, closedAt, deviceId, floatSen: b.floatSen,
          expectedCashSen: expectedCash(summary, b.floatSen), countedCashSen: b.countedCashSen,
          totals: { summary, envelopes: envelopes(summary) }, note,
        };
        await d.store.saveDayClose(close);
        // The first close ends the day; closing again (after a late sale or a void) only adds a newer count.
        await d.store.updateDay(shop.id, day.id, day.closedAt ? { floatSen: b.floatSen } : { floatSen: b.floatSen, closedAt });
        return json(201, { close, day: await dayInfo({ ...day, floatSen: b.floatSen, closedAt: day.closedAt ?? closedAt }) });
      },
    },
    {
      method: 'POST', path: /^\/api\/days\/([A-Za-z0-9_-]{8,64})\/reopen$/,
      run: async (req, m) => {
        const shop = await requireShop((await requireUser(req)).user);
        const day = await canonicalDay(shop.id, m[1]!);
        if (!day) throw new HttpError(404, 'not_found');
        if (day.closedAt === null) return json(200, { day: await dayInfo(day) });
        if (await d.store.openDay(shop.id)) throw new HttpError(400, 'another_open');
        if (await d.store.dayOpenedAfter(shop.id, day.openedAt)) throw new HttpError(400, 'not_latest');
        try {
          await d.store.updateDay(shop.id, day.id, { closedAt: null });
        } catch {
          throw new HttpError(400, 'another_open');
        }
        return json(200, { day: await dayInfo({ ...day, closedAt: null }) });
      },
    },
    {
      method: 'GET', path: /^\/api\/sales$/,
      run: async (req) => {
        const shop = await requireShop((await requireUser(req)).user);
        const url = new URL(req.url);
        const from = url.searchParams.get('from') ?? '';
        const to = url.searchParams.get('to') ?? '';
        if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to))) throw new HttpError(400, 'bad_range');
        return json(200, { sales: await d.store.listSales(shop.id, new Date(from).toISOString(), new Date(to).toISOString()) });
      },
    },
  ];

  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD' && url.pathname !== '/api/billing/toyyib/callback') {
        // CSRF guard: changes must come from the app's own pages.
        const origin = req.headers.get('origin');
        if (!origin || !d.config.appOrigins.includes(origin)) throw new HttpError(403, 'bad_origin');
      }
      for (const r of routes) {
        const m = url.pathname.match(r.path);
        if (m && r.method === req.method) return await r.run(req, m);
      }
      const pathKnown = routes.some((r) => r.path.test(url.pathname));
      throw new HttpError(pathKnown ? 405 : 404, pathKnown ? 'method_not_allowed' : 'not_found');
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.code, ...e.extra });
      console.error('unhandled', e);
      return json(500, { error: 'server_error' });
    }
  };
}

function itemName(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (s.length < 1 || s.length > MAX_ITEM_NAME) throw new HttpError(400, 'bad_name');
  return s;
}

function itemCategory(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') throw new HttpError(400, 'bad_category');
  const s = v.trim().replace(/\s+/g, ' ');
  if (s.length > MAX_CATEGORY) throw new HttpError(400, 'bad_category');
  return s || null;
}

function itemPrice(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX_PRICE_SEN) throw new HttpError(400, 'bad_price');
  return v;
}

function money(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100_000_000;
}
