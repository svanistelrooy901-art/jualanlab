import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PriceList } from '../../../src/link';
import { buildSale } from '../../../src/domain/sale';
import { makeWorld, ORIGIN } from './world';

const price = JSON.parse(readFileSync(new URL('../../../spec/fixtures/price-list.valid.json', import.meta.url), 'utf8')) as PriceList;

describe('sign in with an email code', () => {
  it('sends a 6-digit code, signs in, and creates the account once', async () => {
    const w = await makeWorld();
    const start = await w.call('POST', '/api/auth/email/start', { email: '  Mak.Long@Example.com ', lang: 'ms' });
    expect(start).toMatchObject({ status: 200, body: { ok: true } });
    expect(start.body.devCode).toBeUndefined();
    expect(w.sent[0]).toMatchObject({ to: 'mak.long@example.com', lang: 'ms' });
    expect(w.sent[0]!.code).toMatch(/^\d{6}$/);
    const v = await w.call('POST', '/api/auth/email/verify', { email: 'mak.long@example.com', code: w.sent[0]!.code });
    expect(v.status).toBe(200);
    expect(v.body).toMatchObject({ user: { email: 'mak.long@example.com' }, shop: null });
    expect(v.setCookie).toMatch(/^jl_session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=5184000; Secure$/);
    expect((await w.call('GET', '/api/me')).body.user.email).toBe('mak.long@example.com');
    // signing in again reuses the account
    await w.call('POST', '/api/auth/logout', {});
    expect((await w.call('GET', '/api/me')).status).toBe(401);
    const again = await w.signIn('mak.long@example.com');
    expect(again.body.user.id).toBe(v.body.user.id);
  });

  it('a code works once, expires after 10 minutes, and allows 5 wrong tries', async () => {
    const w = await makeWorld();
    await w.call('POST', '/api/auth/email/start', { email: 'a@b.co' });
    const code = w.sent[0]!.code;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) {
      expect(await w.call('POST', '/api/auth/email/verify', { email: 'a@b.co', code: wrong })).toMatchObject({ status: 400, body: { error: 'wrong_code', attemptsLeft: 4 - i } });
    }
    expect((await w.call('POST', '/api/auth/email/verify', { email: 'a@b.co', code: wrong })).body.attemptsLeft).toBe(0);
    expect(await w.call('POST', '/api/auth/email/verify', { email: 'a@b.co', code })).toMatchObject({ status: 429, body: { error: 'too_many_attempts' } });

    await w.call('POST', '/api/auth/email/start', { email: 'a@b.co' });
    const fresh = w.sent[1]!.code;
    w.advance(10 * 60_000 + 1);
    expect((await w.call('POST', '/api/auth/email/verify', { email: 'a@b.co', code: fresh })).body.error).toBe('code_expired');

    await w.call('POST', '/api/auth/email/start', { email: 'a@b.co' });
    const third = w.sent[2]!.code;
    expect((await w.call('POST', '/api/auth/email/verify', { email: 'a@b.co', code: third })).status).toBe(200);
    expect((await w.call('POST', '/api/auth/email/verify', { email: 'a@b.co', code: third })).body.error).toBe('code_expired');
  });

  it('limits code emails to 5 an hour per address', async () => {
    const w = await makeWorld();
    for (let i = 0; i < 5; i++) expect((await w.call('POST', '/api/auth/email/start', { email: 'x@y.co' })).status).toBe(200);
    expect(await w.call('POST', '/api/auth/email/start', { email: 'x@y.co' })).toMatchObject({ status: 429 });
    w.advance(3600_000 + 1);
    expect((await w.call('POST', '/api/auth/email/start', { email: 'x@y.co' })).status).toBe(200);
  });

  it('rejects bad emails, reports a failed email, and dev mode returns the code', async () => {
    const w = await makeWorld();
    expect((await w.call('POST', '/api/auth/email/start', { email: 'not-an-email' })).body.error).toBe('bad_email');
    w.setMailFails(true);
    expect(await w.call('POST', '/api/auth/email/start', { email: 'a@b.co' })).toMatchObject({ status: 502, body: { error: 'email_failed' } });
    const dev = await makeWorld({ devMode: true });
    const r = await dev.call('POST', '/api/auth/email/start', { email: 'a@b.co' });
    expect(r.body.devCode).toMatch(/^\d{6}$/);
    expect(dev.sent).toHaveLength(0);
  });

  it('public config gives the Google client id, or null when Google sign-in is off', async () => {
    expect((await (await makeWorld()).call('GET', '/api/config')).body).toEqual({ googleClientId: 'test-client', devMode: false });
    expect((await (await makeWorld({ googleClientId: '' })).call('GET', '/api/config')).body.googleClientId).toBeNull();
  });
});

describe('sign in with Google', () => {
  it('creates an account, then links Google to an existing email account', async () => {
    const w = await makeWorld();
    w.googleTokens.set('tok-new', { sub: 'g1', email: 'new@example.com', emailVerified: true, name: 'New' });
    const r = await w.call('POST', '/api/auth/google', { credential: 'tok-new' });
    expect(r).toMatchObject({ status: 200, body: { user: { email: 'new@example.com', name: 'New' } } });

    const v = await w.signIn('mak.long@example.com');
    w.googleTokens.set('tok-link', { sub: 'g2', email: 'mak.long@example.com', emailVerified: true, name: 'Mak Long' });
    const linked = await w.call('POST', '/api/auth/google', { credential: 'tok-link' });
    expect(linked.body.user.id).toBe(v.body.user.id);
    expect((await w.store.getUserById(v.body.user.id))!.googleSub).toBe('g2');
  });
  it('refuses an unverified email or an invalid token', async () => {
    const w = await makeWorld();
    w.googleTokens.set('unverified', { sub: 'g3', email: 'u@example.com', emailVerified: false, name: null });
    expect((await w.call('POST', '/api/auth/google', { credential: 'unverified' })).status).toBe(401);
    expect((await w.call('POST', '/api/auth/google', { credential: 'garbage' })).status).toBe(401);
  });
});

describe('guards', () => {
  it('blocks changes from another origin and non-JSON bodies', async () => {
    const w = await makeWorld();
    expect((await w.call('POST', '/api/auth/email/start', { email: 'a@b.co' }, { origin: 'https://evil.example' })).body.error).toBe('bad_origin');
    const res = await w.handle(new Request(`${ORIGIN}/api/auth/email/start`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'text/plain' }, body: '{"email":"a@b.co"}' }));
    expect(res.status).toBe(415);
  });
  it('needs a session, then a shop', async () => {
    const w = await makeWorld();
    expect((await w.call('GET', '/api/items')).status).toBe(401);
    await w.signIn();
    expect((await w.call('GET', '/api/items')).body.error).toBe('no_shop');
    expect((await w.call('POST', '/api/shop', { name: '  Dapur   Mak Long ' })).body.shop.name).toBe('Dapur Mak Long');
    expect((await w.call('GET', '/api/items')).body).toEqual({ items: [], lastImport: null });
  });
  it('an expired session is signed out; an old session is renewed', async () => {
    const w = await makeWorld();
    await w.signIn();
    w.advance(31 * 86400_000);
    const renewed = await w.call('GET', '/api/me');
    expect(renewed.status).toBe(200);
    expect(renewed.setCookie).toMatch(/Max-Age=5184000/);
    w.advance(61 * 86400_000);
    expect((await w.call('GET', '/api/me')).status).toBe(401);
  });
  it('unknown routes and wrong methods', async () => {
    const w = await makeWorld();
    expect((await w.call('GET', '/api/nope')).status).toBe(404);
    expect((await w.call('DELETE', '/api/me')).status).toBe(405);
  });
});

async function shopWorld() {
  const w = await makeWorld();
  await w.signIn();
  await w.call('POST', '/api/shop', { name: 'Dapur Mak Long' });
  return w;
}

describe('catalogue', () => {
  it('imports a price list, then reports nothing new the second time', async () => {
    const w = await shopWorld();
    const r = await w.call('POST', '/api/items/import', { priceList: price });
    expect(r.body).toMatchObject({ added: 7, changed: 0, same: 0, deactivated: 0, lastImport: { sentAt: price.sentAt, menus: 7 } });
    expect(r.body.items).toHaveLength(7);
    const again = await w.call('POST', '/api/items/import', { priceList: price });
    expect(again.body).toMatchObject({ added: 0, changed: 0, same: 7, deactivated: 0 });
  });
  it('rejects an invalid price list with the link error', async () => {
    const w = await shopWorld();
    const bad = structuredClone(price);
    bad.menus[0]!.priceSen = 1.5;
    expect((await w.call('POST', '/api/items/import', { priceList: bad })).body).toMatchObject({ error: 'bad_price_list', linkError: { path: 'menus[0].priceSen' } });
  });
  it('own items: add, edit, deactivate; UntungLab names cannot be edited here', async () => {
    const w = await shopWorld();
    const add = await w.call('POST', '/api/items', { name: 'Air botol', category: 'Minuman', priceSen: 150 });
    expect(add).toMatchObject({ status: 201, body: { item: { source: 'own', marginPct: null, priceSen: 150 } } });
    const id = add.body.item.id;
    expect((await w.call('PATCH', `/api/items/${id}`, { name: 'Air mineral', priceSen: 200 })).body.item).toMatchObject({ name: 'Air mineral', priceSen: 200 });
    expect((await w.call('PATCH', `/api/items/${id}`, { active: false })).body.item.active).toBe(false);
    expect((await w.call('POST', '/api/items', { name: '', priceSen: 100 })).body.error).toBe('bad_name');
    expect((await w.call('POST', '/api/items', { name: 'X', priceSen: 1.5 })).body.error).toBe('bad_price');

    const imp = await w.call('POST', '/api/items/import', { priceList: price });
    const ul = imp.body.items.find((i: { ulMenuId: string }) => i.ulMenuId === 'm-karipap-01');
    expect((await w.call('PATCH', `/api/items/${ul.id}`, { name: 'Other' })).body.error).toBe('set_in_untunglab');
    expect((await w.call('PATCH', `/api/items/${ul.id}`, { priceSen: 150 })).body.item).toMatchObject({ priceSen: 150, ulPriceSen: 100 });
    expect((await w.call('PATCH', '/api/items/nope0000', { priceSen: 1 })).status).toBe(404);
  });
  it('one shop cannot see or change another shop\'s items', async () => {
    const w = await shopWorld();
    const id = (await w.call('POST', '/api/items', { name: 'Rahsia', priceSen: 100 })).body.item.id;
    const mine = w.cookie;
    w.cookie = '';
    await w.signIn('other@example.com');
    await w.call('POST', '/api/shop', { name: 'Kedai Lain' });
    expect((await w.call('GET', '/api/items')).body.items).toEqual([]);
    expect((await w.call('PATCH', `/api/items/${id}`, { priceSen: 1 })).status).toBe(404);
    w.cookie = mine;
    expect((await w.call('GET', '/api/items')).body.items).toHaveLength(1);
  });
});

describe('sales', () => {
  async function withItems() {
    const w = await shopWorld();
    const items = (await w.call('POST', '/api/items/import', { priceList: price })).body.items as { id: string; name: string; priceSen: number; ulMenuId: string }[];
    const k = items.find((i) => i.ulMenuId === 'm-karipap-01')!;
    const sale = buildSale({
      id: 'sale-aaaa-0001', number: 'A7-0001', deviceId: 'device-abcdef01', createdAt: '2026-10-11T07:42:00.000Z', discountSen: 0,
      lines: [{ itemId: k.id, name: k.name, unitPriceSen: k.priceSen, quantity: 5, marginPct: 31.2, note: '' }], method: 'cash', cashReceivedSen: 1000,
    });
    return { w, sale };
  }
  it('stores a sale once, however many times it is sent', async () => {
    const { w, sale } = await withItems();
    expect(await w.call('POST', '/api/sales', { sale })).toMatchObject({ status: 201, body: { status: 'created' } });
    expect(await w.call('POST', '/api/sales', { sale })).toMatchObject({ status: 200, body: { status: 'exists' } });
    const list = await w.call('GET', '/api/sales?from=2026-10-11T00:00:00Z&to=2026-10-12T00:00:00Z');
    expect(list.body.sales).toEqual([sale]);
  });
  it('rejects a sale whose total does not add up, or with an item from nowhere', async () => {
    const { w, sale } = await withItems();
    expect((await w.call('POST', '/api/sales', { sale: { ...sale, totalSen: 1 } })).body).toMatchObject({ error: 'bad_sale' });
    const foreign = { ...sale, id: 'sale-aaaa-0002', lines: [{ ...sale.lines[0]!, itemId: 'not-my-item' }] };
    expect((await w.call('POST', '/api/sales', { sale: foreign })).body).toMatchObject({ error: 'unknown_item' });
  });
  it('a failed write leaves no half sale behind', async () => {
    const { w, sale } = await withItems();
    const twoLines = { ...sale, id: 'sale-aaaa-0003', lines: [sale.lines[0]!, { ...sale.lines[0]!, note: 'x' }], subtotalSen: 1000, totalSen: 1000, cashReceivedSen: 1000, changeSen: 0 };
    twoLines.lines = twoLines.lines.map((l) => ({ ...l, quantity: 5, unitPriceSen: 100 }));
    // Make the database refuse the second line, after the sale row and first line were written.
    await w.d1.prepare("CREATE TRIGGER fail_second BEFORE INSERT ON sale_lines WHEN NEW.line_no = 1 BEGIN SELECT RAISE(ABORT, 'boom'); END").run();
    const shopId = (await w.d1.prepare('SELECT id FROM shops').first<{ id: string }>())!.id;
    await expect(w.store.saveSale(shopId, twoLines, '2026-10-11T08:00:00.000Z')).rejects.toThrow(/boom/);
    expect(await w.store.getSale(shopId, 'sale-aaaa-0003')).toBeNull();
    expect(await w.d1.prepare("SELECT COUNT(*) AS n FROM sale_lines WHERE sale_id = 'sale-aaaa-0003'").first()).toEqual({ n: 0 });
  });
});
