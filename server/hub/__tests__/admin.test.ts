/** smeLab admin API: read the numbers and act on one buyer, from the UntungLab admin page (its own token, its own data). */
import { describe, expect, it } from 'vitest';
import { makeHub } from './world';

const TOKEN = 'a-long-random-admin-token-for-tests-0123456789';
const ORIGIN = 'https://beli.untunglab.space';

async function world() {
  const w = await makeHub({ adminToken: TOKEN, adminOrigins: [ORIGIN] });
  const admin = async (action: string, body: unknown = {}, token: string | null = TOKEN, origin: string | null = ORIGIN) => {
    const res = await w.hub.fetch(new Request(`https://smelab.untunglab.space/api/admin/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}), 'cf-connecting-ip': '1.2.3.4' },
      body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as any, headers: res.headers };
  };
  /** A buyer who pays for an item; returns the order id. */
  const buy = async (email: string, item: 'combo' | 'untunglab' | 'jualanlab', pay = true) => {
    await w.signIn(email);
    const c = await w.call('POST', '/api/checkout', { item, name: 'Kak Ros', phone: '0123456789' });
    if (pay) {
      w.pay(c.body.orderId);
      await w.call('GET', `/api/orders/${c.body.orderId}`);
    }
    w.cookie = '';
    return c.body.orderId as string;
  };
  return { ...w, admin, buy };
}

describe('admin access', () => {
  it('refuses a missing or wrong token, and every call that is not POST', async () => {
    const w = await world();
    expect((await w.admin('stats', {}, null)).status).toBe(401);
    expect((await w.admin('stats', {}, 'wrong')).status).toBe(401);
    const get = await w.hub.fetch(new Request('https://smelab.untunglab.space/api/admin/stats', { headers: { authorization: `Bearer ${TOKEN}` } }));
    expect(get.status).toBe(404);
  });

  it('is switched off when no admin token is set', async () => {
    const w = await makeHub();
    const res = await w.hub.fetch(new Request('https://smelab.untunglab.space/api/admin/stats', { method: 'POST', headers: { authorization: 'Bearer anything', 'content-type': 'application/json' }, body: '{}' }));
    expect(res.status).toBe(404);
  });

  it('locks an address out after repeated wrong tokens', async () => {
    const w = await world();
    for (let i = 0; i < 20; i++) expect((await w.admin('stats', {}, `bad${i}`)).status).toBe(401);
    expect((await w.admin('stats', {}, 'bad-again')).status).toBe(429);
    expect((await w.admin('stats')).status).toBe(429);
  });

  it('answers the browser pre-flight for the UntungLab admin page only', async () => {
    const w = await world();
    const ok = await w.hub.fetch(new Request('https://smelab.untunglab.space/api/admin/stats', { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } }));
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(ok.headers.get('access-control-allow-headers')!.toLowerCase()).toContain('authorization');
    const other = await w.hub.fetch(new Request('https://smelab.untunglab.space/api/admin/stats', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }));
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
    // Real answers carry the header for the allowed page, never for another.
    expect((await w.admin('stats')).headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect((await w.admin('stats', {}, TOKEN, 'https://evil.example')).headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('admin numbers', () => {
  it('all zero on an empty service, with early-bird places and the waiting list', async () => {
    const w = await world();
    const r = await w.admin('stats');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      accounts: 0, orders: { total: 0, paid: 0, pending: 0 }, revenueSen: 0, byItem: { untunglab: 0, jualanlab: 0, combo: 0 },
      active: { untunglab: 0, jualanlab: 0 }, revoked: 0, earlyLeft: { untunglab: 1, jualanlab: 2 }, waitlist: { promolab: 0, kiralab: 0, jualanlab: 0 }, recent: [],
    });
  });

  it('counts paid and pending orders, revenue and who owns what; recent orders carry no phone number', async () => {
    const w = await world();
    const o1 = await w.buy('a@example.com', 'combo');
    await w.buy('b@example.com', 'untunglab', false);
    const r = (await w.admin('stats')).body;
    expect(r.accounts).toBe(2);
    expect(r.orders).toEqual({ total: 2, paid: 1, pending: 1 });
    expect(r.revenueSen).toBe(7500);
    expect(r.byItem.combo).toBe(1);
    expect(r.active).toEqual({ untunglab: 1, jualanlab: 1 });
    expect(r.recent).toHaveLength(2);
    expect(r.recent[0].email).toBe('b@example.com');
    expect(JSON.stringify(r)).not.toContain('0123456789');
    expect(r.recent.find((x: any) => x.id === o1)).toMatchObject({ item: 'combo', status: 'paid', amountSen: 7500, ulCode: 'UL-NEW0-AAAA-BBBB' });
  });

  it('counts the waiting list per app', async () => {
    const w = await world();
    for (const [email, app] of [['a@x.com', 'promolab'], ['b@x.com', 'promolab'], ['a@x.com', 'kiralab']]) await w.call('POST', '/api/waitlist', { email, app });
    expect((await w.admin('stats')).body.waitlist).toEqual({ promolab: 2, kiralab: 1, jualanlab: 0 });
    const list = (await w.admin('waitlist', { app: 'promolab' })).body.entries;
    expect(list.map((x: any) => x.email).sort()).toEqual(['a@x.com', 'b@x.com']);
    expect((await w.admin('waitlist', { app: 'nope' })).status).toBe(400);
  });
});

describe('admin lookup and actions', () => {
  it('finds a buyer by email or order id: account, orders and what they own', async () => {
    const w = await world();
    const id = await w.buy('a@example.com', 'combo');
    const byEmail = (await w.admin('lookup', { email: 'A@Example.com ' })).body;
    expect(byEmail.account.email).toBe('a@example.com');
    expect(byEmail.orders.map((o: any) => o.id)).toEqual([id]);
    expect(byEmail.entitlements.map((e: any) => e.product).sort()).toEqual(['jualanlab', 'untunglab']);
    expect((await w.admin('lookup', { orderId: id })).body.account.email).toBe('a@example.com');
    expect((await w.admin('lookup', { email: 'nobody@example.com' })).status).toBe(404);
    expect((await w.admin('lookup', {})).status).toBe(400);
    expect(JSON.stringify(byEmail)).not.toContain('0123456789');
  });

  it('revokes and restores one entitlement; the app stops and then starts opening for that buyer', async () => {
    const w = await world();
    await w.buy('a@example.com', 'combo');
    const found = (await w.admin('lookup', { email: 'a@example.com' })).body;
    const accountId = found.account.id;
    const jl = found.entitlements.find((e: any) => e.product === 'jualanlab').id;
    expect((await w.admin('revoke', { entitlementId: jl })).body).toEqual({ ok: true });
    expect(await w.hub.productsOf(accountId)).toEqual(['untunglab']);
    expect((await w.admin('stats')).body.revoked).toBe(1);
    expect((await w.admin('revoke', { entitlementId: jl })).status).toBe(409);
    expect((await w.admin('restore', { entitlementId: jl })).body).toEqual({ ok: true });
    expect((await w.hub.productsOf(accountId))!.sort()).toEqual(['jualanlab', 'untunglab']);
    expect((await w.admin('restore', { entitlementId: jl })).status).toBe(409);
    expect((await w.admin('revoke', { entitlementId: 'nope' })).status).toBe(404);
  });

  it('will not restore when the buyer already owns that app again', async () => {
    const w = await world();
    await w.buy('a@example.com', 'untunglab');
    const f = (await w.admin('lookup', { email: 'a@example.com' })).body;
    const ul = f.entitlements[0].id;
    await w.admin('revoke', { entitlementId: ul });
    await w.store.addEntitlement({ id: 'again', accountId: f.account.id, product: 'untunglab', source: 'untunglab_licence', orderId: null, ulCode: null, createdAt: '2026-10-21T00:00:00.000Z', revokedAt: null });
    expect((await w.admin('restore', { entitlementId: ul })).status).toBe(409);
  });

  it('sends the receipt again for a paid order, not for an unpaid one', async () => {
    const w = await world();
    const paid = await w.buy('a@example.com', 'combo');
    const pending = await w.buy('b@example.com', 'untunglab', false);
    expect(w.receipts).toHaveLength(1);
    expect((await w.admin('resend', { orderId: paid })).body).toEqual({ ok: true });
    expect(w.receipts).toHaveLength(2);
    expect(w.receipts[1]).toMatchObject({ to: 'a@example.com', item: 'combo', ulCode: 'UL-NEW0-AAAA-BBBB' });
    expect((await w.admin('resend', { orderId: pending })).status).toBe(409);
    expect((await w.admin('resend', { orderId: 'f'.repeat(32) })).status).toBe(404);
  });
});
