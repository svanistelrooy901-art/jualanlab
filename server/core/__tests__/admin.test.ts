/** JualanLab admin API: numbers and the free-month extension, for the UntungLab admin page (own token, own data). */
import { describe, expect, it } from 'vitest';
import { makeWorld } from './world';

const TOKEN = 'a-long-random-jl-admin-token-for-tests-0123456789';
const ORIGIN = 'https://beli.untunglab.space';
const DAY = 864e5;

async function world(over: Parameters<typeof makeWorld>[0] = {}) {
  const w = await makeWorld({ adminToken: TOKEN, adminOrigins: [ORIGIN], trialDays: 30, ...over });
  const admin = async (action: string, body: unknown = {}, token: string | null = TOKEN, origin: string | null = ORIGIN) => {
    const res = await w.handle(new Request(`https://jualan.untunglab.space/api/admin/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}), 'cf-connecting-ip': '1.2.3.4' },
      body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as any, headers: res.headers };
  };
  /** A shop owner who signs in and opens a shop. */
  const shop = async (email: string, name = 'Dapur Mak Long') => {
    await w.signIn(email);
    const me = await w.call('POST', '/api/shop', { name });
    w.cookie = '';
    return me.body.shop.id as string;
  };
  return { ...w, admin, shop };
}

describe('admin access', () => {
  it('refuses a missing or wrong token', async () => {
    const w = await world();
    expect((await w.admin('stats', {}, null)).status).toBe(401);
    expect((await w.admin('stats', {}, 'wrong')).status).toBe(401);
  });

  it('is off when no admin token is set', async () => {
    const w = await makeWorld();
    const res = await w.handle(new Request('https://jualan.untunglab.space/api/admin/stats', { method: 'POST', headers: { authorization: 'Bearer x', 'content-type': 'application/json', origin: ORIGIN }, body: '{}' }));
    expect(res.status).toBe(404);
  });

  it('is not reachable with a signed-in seller cookie, and does not break the waiting-list export', async () => {
    const w = await world();
    await w.signIn('mak.long@example.com');
    const asSeller = await w.call('POST', '/api/admin/stats', {});
    expect(asSeller.status).toBe(401);
    const csv = await w.call('GET', '/api/admin/waitlist.csv');
    expect(csv.status).toBe(403); // not an owner account: the existing rule, unchanged
  });

  it('locks an address out after repeated wrong tokens', async () => {
    const w = await world();
    for (let i = 0; i < 20; i++) expect((await w.admin('stats', {}, `bad${i}`)).status).toBe(401);
    expect((await w.admin('stats')).status).toBe(429);
  });

  it('answers the browser pre-flight for the UntungLab admin page only', async () => {
    const w = await world();
    const ok = await w.handle(new Request('https://jualan.untunglab.space/api/admin/stats', { method: 'OPTIONS', headers: { origin: ORIGIN } }));
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(ok.headers.get('access-control-allow-headers')!.toLowerCase()).toContain('authorization');
    const other = await w.handle(new Request('https://jualan.untunglab.space/api/admin/stats', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }));
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
    expect((await w.admin('stats')).headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect((await w.admin('stats', {}, TOKEN, 'https://evil.example')).headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('admin numbers', () => {
  it('all zero on an empty service', async () => {
    const w = await world();
    expect((await w.admin('stats')).body).toMatchObject({
      users: 0, shops: 0, bought: 0, onTrial: 0, trialEndingSoon: 0, free: 0, soldLast7: 0, soldLast30: 0, activeShops7: 0, waitlist: 0, recent: [],
    });
  });

  it('counts shops by what they have: free month, bought, ended; and who is trading', async () => {
    const w = await world();
    const a = await w.shop('a@example.com', 'Kedai A');
    await w.shop('b@example.com', 'Kedai B');
    await w.store.setShopPlan(a, 'pos', '2026-10-10T01:00:00.000Z');
    const r1 = (await w.admin('stats')).body;
    expect(r1).toMatchObject({ users: 2, shops: 2, bought: 1, onTrial: 1, free: 0 });
    // Past B's free month: B is on Free.
    w.advance(31 * DAY);
    const r2 = (await w.admin('stats')).body;
    expect(r2).toMatchObject({ bought: 1, onTrial: 0, free: 1 });
  });

  it('flags free months ending within 7 days', async () => {
    const w = await world();
    await w.shop('b@example.com');
    w.advance(25 * DAY);
    expect((await w.admin('stats')).body).toMatchObject({ onTrial: 1, trialEndingSoon: 1 });
    w.advance(-10 * DAY);
    expect((await w.admin('stats')).body).toMatchObject({ onTrial: 1, trialEndingSoon: 0 });
  });

  it('lists the newest shops with owner email, never money or customers', async () => {
    const w = await world();
    await w.shop('a@example.com', 'Kedai A');
    w.advance(DAY);
    await w.shop('b@example.com', 'Kedai B');
    const r = (await w.admin('stats')).body;
    expect(r.recent.map((x: any) => x.name)).toEqual(['Kedai B', 'Kedai A']);
    expect(r.recent[0]).toMatchObject({ email: 'b@example.com', plan: 'free', onTrial: true });
    expect(Object.keys(r.recent[0]).sort()).toEqual(['createdAt', 'email', 'name', 'onTrial', 'plan', 'shopId', 'trialEndsAt']);
  });

  it('counts the pre-launch waiting list', async () => {
    const w = await world();
    await w.store.joinWaitlist({ email: 'x@example.com', name: 'X', business: 'cafe', lang: 'ms', createdAt: '2026-10-10T01:00:00.000Z' });
    expect((await w.admin('stats')).body.waitlist).toBe(1);
  });
});

describe('admin lookup and the free month', () => {
  it('finds a seller by email: account, shop, plan, free month and how much they use it', async () => {
    const w = await world();
    const id = await w.shop('a@example.com', 'Kedai A');
    const r = (await w.admin('lookup', { email: ' A@Example.com' })).body;
    expect(r.user.email).toBe('a@example.com');
    expect(r.shop).toMatchObject({ id, name: 'Kedai A', plan: 'free', onTrial: true, trialEndsAt: '2026-11-09T01:00:00.000Z', activeItems: 0, sales: 0, lastSaleAt: null });
    expect((await w.admin('lookup', { email: 'nobody@example.com' })).status).toBe(404);
    expect((await w.admin('lookup', {})).status).toBe(400);
  });

  it('extends the free month from today, or from its end when it is still running', async () => {
    const w = await world();
    await w.shop('a@example.com');
    const ext = await w.admin('extend-trial', { email: 'a@example.com', days: 14 });
    expect(ext.body).toEqual({ ok: true, trialEndsAt: '2026-11-23T01:00:00.000Z' });
    // Ended already: counted from today.
    w.advance(60 * DAY);
    const again = await w.admin('extend-trial', { email: 'a@example.com', days: 7 });
    expect(again.body.trialEndsAt).toBe(new Date(Date.parse('2026-10-10T01:00:00.000Z') + 67 * DAY).toISOString());
    expect((await w.admin('lookup', { email: 'a@example.com' })).body.shop).toMatchObject({ onTrial: true, plan: 'free' });
  });

  it('refuses a silly number of days, a shop that already bought, and an unknown seller', async () => {
    const w = await world();
    const id = await w.shop('a@example.com');
    for (const days of [0, -3, 91, 1.5, '7', null]) expect((await w.admin('extend-trial', { email: 'a@example.com', days })).status).toBe(400);
    await w.store.setShopPlan(id, 'pos', '2026-10-10T01:00:00.000Z');
    expect((await w.admin('extend-trial', { email: 'a@example.com', days: 7 })).status).toBe(409);
    expect((await w.admin('extend-trial', { email: 'nobody@example.com', days: 7 })).status).toBe(404);
  });
});
