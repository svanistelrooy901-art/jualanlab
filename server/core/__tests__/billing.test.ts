import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { md5 } from '../md5';
import { normaliseUlCode } from '../untunglab';
import { toSen } from '../toyyibpay';
import { BILLING, makeWorld, ORIGIN } from './world';

const price = JSON.parse(readFileSync(new URL('../../../spec/fixtures/price-list.valid.json', import.meta.url), 'utf8'));

async function freeShop(opts?: { toyyib?: boolean; untungLab?: boolean }) {
  const w = await makeWorld({}, opts);
  await w.signIn();
  const me = await w.call('POST', '/api/shop', { name: 'Dapur Mak Long' });
  return { w, shopId: me.body.shop.id as string };
}

const buyer = { name: 'Mak Long', phone: '012-345 6789' };

function callback(w: Awaited<ReturnType<typeof makeWorld>>, orderId: string, status = '1', secret = BILLING.toyyibSecret) {
  const refno = 'TP123';
  const form = new URLSearchParams({ status, order_id: orderId, refno, billcode: 'x', hash: md5(secret + status + orderId + refno + 'ok') });
  return w.handle(new Request(`${ORIGIN}/api/billing/toyyib/callback`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() }));
}

describe('Free plan', () => {
  it('allows 10 active items, blocks adding the 11th and reactivating past the limit, never removes anything', async () => {
    const { w } = await freeShop();
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) ids.push((await w.call('POST', '/api/items', { name: `Item ${i}`, priceSen: 100 })).body.item.id);
    expect(await w.call('POST', '/api/items', { name: 'Item 11', priceSen: 100 })).toMatchObject({ status: 403, body: { error: 'plan_limit', limit: 10 } });
    await w.call('PATCH', `/api/items/${ids[0]}`, { active: false });
    expect((await w.call('POST', '/api/items', { name: 'Item 11', priceSen: 100 })).status).toBe(201);
    expect((await w.call('PATCH', `/api/items/${ids[0]}`, { active: true })).body.error).toBe('plan_limit');
    expect((await w.call('PATCH', `/api/items/${ids[1]}`, { priceSen: 250 })).status).toBe(200); // editing is never blocked
    expect((await w.call('GET', '/api/items')).body.items).toHaveLength(11);
  });

  it('cannot receive the UntungLab price list', async () => {
    const { w } = await freeShop();
    expect(await w.call('POST', '/api/items/import', { priceList: price })).toMatchObject({ status: 403, body: { error: 'plan_required' } });
    expect((await w.call('GET', '/api/me')).body.shop.plan).toBe('free');
  });
});

describe('buying the full POS', () => {
  it('shows prices decided by the server, with early-bird places left', async () => {
    const { w } = await freeShop();
    expect((await w.call('GET', '/api/billing')).body).toMatchObject({
      plan: 'free', freeItemLimit: 10, buyingOpen: true,
      prices: { normalSen: 4900, early: { priceSen: 3900, left: 2 }, untungLabSen: 2900, bundleSen: 7500 },
    });
    const closed = await freeShop({ toyyib: false });
    expect((await closed.w.call('GET', '/api/billing')).body).toMatchObject({ buyingOpen: false, prices: null });
    expect((await closed.w.call('POST', '/api/billing/checkout', { product: 'pos', ...buyer })).body.error).toBe('buying_closed');
  });

  it('pays through ToyyibPay: only a confirmed payment of the right amount opens the full POS', async () => {
    const { w } = await freeShop();
    expect((await w.call('POST', '/api/billing/checkout', { product: 'pos', name: 'M', phone: '0123456789' })).body.error).toBe('bad_name');
    expect((await w.call('POST', '/api/billing/checkout', { product: 'pos', name: 'Mak Long', phone: '12' })).body.error).toBe('bad_phone');
    const c = await w.call('POST', '/api/billing/checkout', { product: 'pos', ...buyer, amountSen: 1 });
    expect(c.body).toMatchObject({ amountSen: 3900, payUrl: 'https://toyyibpay.test/bill1' }); // early bird; the phone cannot set the price
    const id = c.body.orderId as string;

    expect((await w.call('GET', `/api/billing/orders/${id}`)).body.status).toBe('pending');
    // Forged callback: wrong hash.
    expect((await callback(w, id, '1', 'not-the-secret')).status).toBe(400);
    // Right hash but ToyyibPay has not been paid: not trusted.
    expect((await callback(w, id)).status).toBe(500);
    // Paid the wrong amount: still not trusted.
    w.payBill(id, 100);
    expect((await w.call('GET', `/api/billing/orders/${id}`)).body.status).toBe('pending');
    w.payBill(id, 3900);
    expect((await callback(w, id)).status).toBe(200);
    expect((await w.call('GET', `/api/billing/orders/${id}`)).body).toMatchObject({ status: 'paid', amountSen: 3900 });
    expect((await w.call('GET', '/api/me')).body.shop.plan).toBe('pos');
    expect(w.receipts).toEqual([{ to: 'mak.long@example.com', amountSen: 3900, bundle: false }]);
    // Confirming again (callback + polling) sends no second receipt.
    await callback(w, id);
    await w.call('GET', `/api/billing/orders/${id}`);
    expect(w.receipts).toHaveLength(1);
    // Now the UntungLab list can come in, and buying again is refused.
    expect((await w.call('POST', '/api/items/import', { priceList: price })).status).toBe(200);
    expect((await w.call('POST', '/api/billing/checkout', { product: 'pos', ...buyer })).body.error).toBe('already_paid');
  });

  it('the callback needs no app Origin, but other changes still do', async () => {
    const { w } = await freeShop();
    const res = await w.handle(new Request(`${ORIGIN}/api/billing/toyyib/callback`, { method: 'POST', body: 'status=1' }));
    expect(res.status).toBe(400); // reached the handler (bad request), not blocked as bad_origin
    expect((await w.call('POST', '/api/billing/checkout', { product: 'pos', ...buyer }, { origin: 'https://evil.example' })).body.error).toBe('bad_origin');
  });

  it('early-bird price ends after the set number of paid early-bird orders', async () => {
    const shops = [];
    for (const email of ['a@x.co', 'b@x.co', 'c@x.co']) shops.push(email);
    const w = await makeWorld();
    for (const email of shops) {
      w.cookie = '';
      await w.signIn(email);
      await w.call('POST', '/api/shop', { name: email });
      const c = await w.call('POST', '/api/billing/checkout', { product: 'pos', ...buyer });
      w.payBill(c.body.orderId);
      await w.call('GET', `/api/billing/orders/${c.body.orderId}`);
    }
    // Slots = 2 in tests: the third buyer paid the normal price.
    expect([...w.bills.values()].map((b) => b.amountSen)).toEqual([3900, 3900, 4900]);
  });

  it('UntungLab users: a valid code gives RM29 once; unknown, revoked or used codes are refused', async () => {
    const { w } = await freeShop();
    expect((await w.call('POST', '/api/billing/check-ul', { code: 'abcd efgh jkmn' })).body).toEqual({ ok: true, code: 'UL-ABCD-EFGH-JKMN' });
    expect((await w.call('POST', '/api/billing/check-ul', { code: 'UL-0000' })).body.error).toBe('ul_code_format');
    expect((await w.call('POST', '/api/billing/check-ul', { code: 'UL-REVK-REVK-REVK' })).body.error).toBe('ul_code_revoked');
    expect((await w.call('POST', '/api/billing/check-ul', { code: 'UL-ZZZZ-ZZZZ-ZZZZ' })).body.error).toBe('ul_code_unknown');
    expect((await w.call('POST', '/api/billing/checkout', { product: 'pos', ...buyer, ulCode: 'UL-ZZZZ-ZZZZ-ZZZZ' })).body.error).toBe('ul_code_unknown');
    const c = await w.call('POST', '/api/billing/checkout', { product: 'pos', ...buyer, ulCode: 'UL-ABCD-EFGH-JKMN' });
    expect(c.body.amountSen).toBe(2900);
    w.payBill(c.body.orderId);
    await w.call('GET', `/api/billing/orders/${c.body.orderId}`);
    // Another shop tries the same code.
    w.cookie = '';
    await w.signIn('friend@example.com');
    await w.call('POST', '/api/shop', { name: 'Kedai Kawan' });
    expect((await w.call('POST', '/api/billing/checkout', { product: 'pos', ...buyer, ulCode: 'ULABCDEFGHJKMN' })).body.error).toBe('ul_code_used');
    w.setUlDown(true);
    expect((await w.call('POST', '/api/billing/check-ul', { code: 'UL-ABCD-EFGH-JKMP' })).body.error).toBe('ul_unavailable');
  });

  it('bundle: RM75, and the UntungLab licence is created once (retried if UntungLab was down)', async () => {
    const { w } = await freeShop();
    const c = await w.call('POST', '/api/billing/checkout', { product: 'bundle', ...buyer });
    expect(c.body.amountSen).toBe(7500);
    w.payBill(c.body.orderId);
    w.setUlDown(true);
    expect((await w.call('GET', `/api/billing/orders/${c.body.orderId}`)).body).toMatchObject({ status: 'paid', ulIssuedCode: null });
    expect((await w.call('GET', '/api/me')).body.shop.plan).toBe('pos');
    w.setUlDown(false);
    expect((await w.call('GET', `/api/billing/orders/${c.body.orderId}`)).body.ulIssuedCode).toBe('UL-NEW0-AAAA-BBBB');
    await w.call('GET', `/api/billing/orders/${c.body.orderId}`);
    expect(w.ulIssued).toHaveLength(1);
    expect(w.receipts[0]).toMatchObject({ bundle: true, amountSen: 7500 });
  });

  it('without the UntungLab connection there is no RM29 price and no bundle', async () => {
    const { w } = await freeShop({ untungLab: false });
    expect((await w.call('GET', '/api/billing')).body.prices).toMatchObject({ untungLabSen: null, bundleSen: null });
    expect((await w.call('POST', '/api/billing/checkout', { product: 'bundle', ...buyer })).body.error).toBe('ul_unavailable');
  });

  it('an order is only visible to its own shop', async () => {
    const { w } = await freeShop();
    const c = await w.call('POST', '/api/billing/checkout', { product: 'pos', ...buyer });
    w.cookie = '';
    await w.signIn('other@example.com');
    await w.call('POST', '/api/shop', { name: 'Lain' });
    expect((await w.call('GET', `/api/billing/orders/${c.body.orderId}`)).status).toBe(404);
  });
});

describe('owner and tester accounts', () => {
  it('get the full POS without paying; others stay on Free', async () => {
    const w = await makeWorld({ complimentaryEmails: ['owner@example.com'] });
    await w.signIn('owner@example.com');
    const me = await w.call('POST', '/api/shop', { name: 'Kedai Owner' });
    expect(me.body.shop.plan).toBe('pos');
    expect((await w.call('POST', '/api/items/import', { priceList: price })).status).toBe(200);
    w.cookie = '';
    await w.signIn('someone@example.com');
    expect((await w.call('POST', '/api/shop', { name: 'Lain' })).body.shop.plan).toBe('free');
  });
});

describe('helpers', () => {
  it('UntungLab codes and ToyyibPay amounts', () => {
    expect(normaliseUlCode(' ul-abcd efgh-jkmn ')).toBe('UL-ABCD-EFGH-JKMN');
    expect(normaliseUlCode('UL-ABCD-EFGH-JKM0')).toBeNull(); // 0 is not in the alphabet
    expect(toSen('39.00')).toBe(3900);
    expect(toSen('39')).toBe(3900);
    expect(toSen('3900')).toBe(3900);
    expect(toSen('abc')).toBeNull();
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });
});
