/** The free month (DECISIONS FT-01 to FT-03). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PriceList } from '../../../src/link';
import type { Item } from '../../../src/domain/items';
import { defaultSettings, type StoreSettings } from '../../../src/domain/kedai';
import { makeWorld } from './world';

const price = JSON.parse(readFileSync(new URL('../../../spec/fixtures/price-list.valid.json', import.meta.url), 'utf8')) as PriceList;
const SETTINGS: StoreSettings = {
  ...defaultSettings('dapur-mak-long'), published: true, whatsapp: '60123456789',
  pickup: { on: true, address: 'Taman Sri Rambai', mapUrl: '', hours: '10 pg hingga 6 ptg' },
};
const DAY = 864e5;

async function newShop(over: Parameters<typeof makeWorld>[0] = { trialDays: 30 }) {
  const w = await makeWorld(over);
  await w.signIn();
  const me = await w.call('POST', '/api/shop', { name: 'Dapur Mak Long' });
  return { w, shopId: me.body.shop.id as string, me: me.body };
}

describe('free month', () => {
  it('a new shop gets the full version for 30 days, then Free', async () => {
    const { w, me } = await newShop();
    expect(me.shop).toMatchObject({ plan: 'pos', bought: false, trialEndsAt: '2026-11-09T01:00:00.000Z' });
    // Everything the full POS has: the UntungLab link, more than 10 items, Laporan.
    expect((await w.call('POST', '/api/items/import', { priceList: price })).status).toBe(200);
    for (let n = 0; n < 12; n++) expect((await w.call('POST', '/api/items', { name: `Kuih ${n}`, priceSen: 150 })).status).toBe(201);
    expect((await w.call('GET', '/api/reports?from=2026-10-01&to=2026-10-10')).body.locked).toBe(false);
    expect((await w.call('GET', '/api/billing')).body).toMatchObject({ plan: 'free', onTrial: true, trialEndsAt: '2026-11-09T01:00:00.000Z' });

    w.advance(30 * DAY);
    expect((await w.call('GET', '/api/me')).body.shop).toMatchObject({ plan: 'free', bought: false });
    expect((await w.call('GET', '/api/billing')).body).toMatchObject({ plan: 'free', onTrial: false });
    // Free again: adding is blocked past 10 items, nothing is removed; no link, no Laporan.
    expect((await w.call('POST', '/api/items', { name: 'Lagi', priceSen: 100 })).body.error).toBe('plan_limit');
    expect((await w.call('GET', '/api/items')).body.items.filter((i: Item) => i.active).length).toBeGreaterThan(10);
    expect((await w.call('POST', '/api/items/import', { priceList: price })).body.error).toBe('plan_required');
    expect((await w.call('GET', '/api/reports?from=2026-10-01&to=2026-10-10')).body.locked).toBe(true);
  });

  it('buying keeps everything open after the month', async () => {
    const { w, shopId } = await newShop();
    await w.store.setShopPlan(shopId, 'pos', '2026-10-12T00:00:00.000Z');
    w.advance(40 * DAY);
    expect((await w.call('GET', '/api/me')).body.shop).toMatchObject({ plan: 'pos', bought: true });
  });

  it('shops from before the free month get none (trialDays 0 also turns it off)', async () => {
    const { me } = await newShop({ trialDays: 0 });
    expect(me.shop).toMatchObject({ plan: 'free', trialEndsAt: null });
  });

  it('the online store works during the month; on Free it is closed, but placed orders keep their page', async () => {
    const { w } = await newShop();
    const items = (await w.call('POST', '/api/items/import', { priceList: price })).body.items as Item[];
    expect((await w.call('PUT', '/api/kedai', SETTINGS)).status).toBe(200);
    expect((await w.call('GET', '/api/kedai/summary')).body.available).toBe(true);
    const page = await w.kcall('GET', '/dapur-mak-long');
    expect(page.status).toBe(200);
    expect(page.body).toContain('id="kd"');
    const placed = await w.kcall('POST', '/dapur-mak-long/pesan', {
      lines: [{ itemId: items.find((i) => i.priceSen > 0)!.id, quantity: 1, note: '' }], name: 'Aina', phone: '012-345 6789',
      fulfilment: 'pickup', area: '', address: '', note: '', pay: 'qr',
    });
    expect(placed.status).toBe(201);

    w.advance(31 * DAY);
    expect((await w.call('GET', '/api/kedai')).body.available).toBe(false);
    const closed = await w.kcall('GET', '/dapur-mak-long');
    expect(closed.body).toContain('tidak menerima pesanan buat masa ini');
    expect(closed.body).toContain('https://wa.me/60123456789');
    expect(closed.body).not.toContain('id="kd"');
    expect((await w.kcall('GET', '/dapur-mak-long/troli')).body).toContain('tidak menerima pesanan');
    expect((await w.kcall('POST', '/dapur-mak-long/pesan', { lines: [] })).body.error).toBe('store_closed');
    // The customer's order page still opens.
    expect((await w.kcall('GET', new URL(placed.body.url, 'https://x').pathname)).status).toBe(200);
  });
});

describe('own items: margin % (FT-03)', () => {
  it('only shops whose owner has UntungLab may type a margin; it counts for profit', async () => {
    const { w, shopId } = await newShop();
    const made = await w.call('POST', '/api/items', { name: 'Air sirap', priceSen: 300, marginPct: 40 });
    expect(made.body.error).toBe('untunglab_required');
    const plain = (await w.call('POST', '/api/items', { name: 'Air sirap', priceSen: 300 })).body.item as Item;
    expect(plain.marginPct).toBeNull();
    expect((await w.call('PATCH', `/api/items/${plain.id}`, { marginPct: 40 })).body.error).toBe('untunglab_required');

    await w.store.setShopUlOwner(shopId, true);
    expect((await w.call('PATCH', `/api/items/${plain.id}`, { marginPct: 40 })).body.item.marginPct).toBe(40);
    expect((await w.call('PATCH', `/api/items/${plain.id}`, { marginPct: 120 })).body.error).toBe('bad_margin');
    const kuih = (await w.call('POST', '/api/items', { name: 'Kuih lapis', priceSen: 200, marginPct: 35.555 })).body.item as Item;
    expect(kuih.marginPct).toBe(35.56);
    // Clearing is always allowed.
    expect((await w.call('PATCH', `/api/items/${kuih.id}`, { marginPct: null })).body.item.marginPct).toBeNull();
    // UntungLab's own menus keep UntungLab's margin.
    const ul = (await w.call('POST', '/api/items/import', { priceList: price })).body.items.find((i: Item) => i.source === 'untunglab') as Item;
    expect((await w.call('PATCH', `/api/items/${ul.id}`, { marginPct: 10 })).body.error).toBe('set_in_untunglab');
  });
});

describe('Kedai Online (KS-01)', () => {
  it('after the free month, POS penuh alone has no online store; Kedai Online (paid or for life) keeps it', async () => {
    const { w, shopId } = await newShop();
    await w.call('PUT', '/api/kedai', SETTINGS);
    await w.store.setShopPlan(shopId, 'pos', '2026-10-12T00:00:00.000Z');
    const takes = async () => (await w.kcall('GET', '/dapur-mak-long')).body as string;
    // In the free month the store takes orders, bought or not.
    expect((await w.call('GET', '/api/kedai')).body.kedai).toMatchObject({ on: true, via: 'trial', bought: true });
    w.advance(31 * DAY);
    expect((await w.call('GET', '/api/kedai')).body).toMatchObject({ available: false, kedai: { on: false, via: null, bought: true } });
    expect(await takes()).toContain('tidak menerima pesanan');
    // Paid up to a date: open until then.
    await w.store.setShopKedai(shopId, new Date(Date.parse('2026-10-10T01:00:00.000Z') + 61 * DAY).toISOString());
    expect((await w.call('GET', '/api/kedai')).body.kedai).toMatchObject({ on: true, via: 'paid' });
    w.advance(31 * DAY);
    expect((await w.call('GET', '/api/kedai')).body.kedai.on).toBe(false);
    await w.store.setShopKedai(shopId, '9999-12-31T00:00:00.000Z');
    expect((await w.call('GET', '/api/kedai')).body.kedai).toMatchObject({ on: true, via: 'life', until: null });
  });
});
