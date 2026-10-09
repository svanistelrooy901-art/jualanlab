/**
 * JualanLab HTTP API. Platform-neutral: takes a Request, returns a Response.
 * The Cloudflare Worker (server/worker) and the local dev server (scripts/dev-server.ts) both wrap this.
 */
import { validatePriceList } from '../../src/link/priceList';
import { planImport, planWrites } from '../../src/domain/importPlan';
import { MAX_CATEGORY, MAX_ITEM_NAME, MAX_PRICE_SEN, type Item } from '../../src/domain/items';
import { validateSale } from '../../src/domain/sale';
import { base64url, safeEqual, sha256Hex, sixDigitCode } from './crypto';
import type { GoogleVerifier, Mailer, Shop, Store, User } from './ports';

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
}

export interface Deps {
  store: Store;
  mailer: Mailer;
  google: GoogleVerifier;
  config: Config;
  now: () => Date;
  randomBytes: (n: number) => Uint8Array;
  newId: () => string;
}

export const SESSION_COOKIE = 'jl_session';
const SESSION_DAYS = 60;
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
    return shop;
  }

  async function rateLimit(key: string, max: number, windowMs: number) {
    if ((await d.store.countHits(key, iso(-windowMs))) >= max) throw new HttpError(429, 'too_many_requests');
    await d.store.recordHit(key, iso());
  }

  async function findOrCreateUser(email: string, name: string | null): Promise<User> {
    const existing = await d.store.getUserByEmail(email);
    if (existing) return existing;
    const u: User = { id: d.newId(), email, name, googleSub: null, createdAt: iso() };
    await d.store.createUser(u);
    return u;
  }

  async function meBody(user: User) {
    const shop = await d.store.getShopByOwner(user.id);
    return {
      user: { id: user.id, email: user.email, name: user.name },
      shop: shop ? { id: shop.id, name: shop.name } : null,
      lastImport: shop ? await d.store.lastImport(shop.id) : null,
    };
  }

  const routes: { method: string; path: RegExp; run: (req: Request, m: RegExpMatchArray) => Promise<Response> }[] = [
    {
      // Public settings the sign-in page needs.
      method: 'GET', path: /^\/api\/config$/,
      run: async () => json(200, { googleClientId: d.config.googleClientId || null, devMode: d.config.devMode }),
    },
    {
      method: 'POST', path: /^\/api\/auth\/email\/start$/,
      run: async (req) => {
        const b = await body<{ email?: unknown; lang?: unknown }>(req);
        const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
        if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpError(400, 'bad_email');
        const lang = b.lang === 'en' ? 'en' : 'ms';
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
        const result = await d.store.saveSale(shop.id, v.sale, iso());
        return json(result === 'created' ? 201 : 200, { status: result });
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
      if (req.method !== 'GET' && req.method !== 'HEAD') {
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
