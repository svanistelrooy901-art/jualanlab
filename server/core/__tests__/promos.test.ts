import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PriceList } from '../../../src/link';
import type { Item } from '../../../src/domain/items';
import { addItemWithPromos, type Promo } from '../../../src/domain/promo';
import { buildSale } from '../../../src/domain/sale';
import { promoTotals } from '../../../src/domain/summary';
import { makeWorld } from './world';

const price = JSON.parse(readFileSync(new URL('../../../spec/fixtures/price-list.valid.json', import.meta.url), 'utf8')) as PriceList;

async function shop() {
  const w = await makeWorld();
  await w.signIn();
  const me = await w.call('POST', '/api/shop', { name: 'Dapur Mak Long' });
  await w.store.setShopPlan(me.body.shop.id, 'pos', '2026-10-10T00:00:00.000Z');
  const items = (await w.call('POST', '/api/items/import', { priceList: price })).body.items as Item[];
  return { w, items, shopId: me.body.shop.id as string };
}

const OCT = { name: 'Promo Oktober', kind: 'pct', pct: 10, scope: 'all', categories: [], itemIds: [], prices: {}, startDate: '2026-10-01', endDate: '2026-10-31', on: true };

describe('promotions (Diskaun & Promosi)', () => {
  it('a shop keeps its promotions: add, change, switch off, remove', async () => {
    const { w, items } = await shop();
    expect((await w.call('GET', '/api/promos')).body).toEqual({ promos: [], presets: [5, 10, 15] });

    const add = await w.call('POST', '/api/promos', { ...OCT, name: '  Promo   Oktober ' });
    expect(add).toMatchObject({ status: 201, body: { promo: { name: 'Promo Oktober', pct: 10, scope: 'all', on: true } } });
    const id = add.body.promo.id as string;

    const k = items.find((i) => i.ulMenuId === 'm-karipap-01')!;
    const special = await w.call('POST', '/api/promos', { name: 'Karipap Jumaat', kind: 'price', prices: { [k.id]: 80 }, startDate: '2026-10-16', endDate: null, on: true, pct: 99, scope: 'all' });
    // A special-price promotion covers exactly its items; stray fields are dropped.
    expect(special.body.promo).toMatchObject({ kind: 'price', pct: null, scope: 'items', prices: { [k.id]: 80 }, endDate: null });

    const changed = await w.call('PUT', `/api/promos/${id}`, { ...OCT, pct: 15, scope: 'categories', categories: ['Kuih'], on: false });
    expect(changed.body.promo).toMatchObject({ id, pct: 15, scope: 'categories', categories: ['Kuih'], on: false, createdAt: add.body.promo.createdAt });

    const list = (await w.call('GET', '/api/promos')).body.promos as Promo[];
    expect(list.map((p) => p.name)).toEqual(['Promo Oktober', 'Karipap Jumaat']);

    expect(await w.call('DELETE', `/api/promos/${id}`)).toMatchObject({ status: 200, body: { ok: true } });
    expect((await w.call('DELETE', `/api/promos/${id}`)).status).toBe(404);
    expect((await w.call('PUT', `/api/promos/${id}`, OCT)).status).toBe(404);
    expect((await w.call('GET', '/api/promos')).body.promos).toHaveLength(1);
  });

  it('refuses a promotion that does not make sense', async () => {
    const { w } = await shop();
    const bad = async (p: Record<string, unknown>) => (await w.call('POST', '/api/promos', { ...OCT, ...p })).body;
    expect(await bad({ name: ' ' })).toMatchObject({ error: 'bad_promo', detail: 'name' });
    expect(await bad({ name: 'x'.repeat(41) })).toMatchObject({ detail: 'name' });
    for (const pct of [0, -5, 101, 10.555, '10', null]) expect(await bad({ pct })).toMatchObject({ detail: 'pct' });
    expect(await bad({ startDate: '2026-02-30' })).toMatchObject({ detail: 'startDate' });
    expect(await bad({ endDate: '2026-09-30' })).toMatchObject({ detail: 'endDate' });
    expect(await bad({ scope: 'categories', categories: [] })).toMatchObject({ detail: 'categories' });
    expect(await bad({ scope: 'items', itemIds: ['not-mine'] })).toMatchObject({ detail: 'unknown_item' });
    expect(await bad({ kind: 'price', prices: {} })).toMatchObject({ detail: 'prices' });
    expect(await bad({ kind: 'price', prices: { 'not-mine': 100 } })).toMatchObject({ detail: 'unknown_item' });
    expect(await bad({ on: 'yes' })).toMatchObject({ detail: 'on' });
    expect((await w.call('GET', '/api/promos')).body.promos).toEqual([]);
  });

  it('one shop cannot see or change another shop\'s promotions', async () => {
    const { w } = await shop();
    const id = (await w.call('POST', '/api/promos', OCT)).body.promo.id;
    const mine = w.cookie;
    w.cookie = '';
    await w.signIn('other@example.com');
    await w.call('POST', '/api/shop', { name: 'Kedai Lain' });
    expect((await w.call('GET', '/api/promos')).body.promos).toEqual([]);
    expect((await w.call('PUT', `/api/promos/${id}`, { ...OCT, pct: 50 })).status).toBe(404);
    expect((await w.call('DELETE', `/api/promos/${id}`)).status).toBe(404);
    w.cookie = mine;
    expect((await w.call('GET', '/api/promos')).body.promos[0]).toMatchObject({ id, pct: 10 });
  });

  it('the three quick discount buttons can be changed', async () => {
    const { w } = await shop();
    expect((await w.call('PUT', '/api/discount-presets', { presets: [30, 10, 20] })).body).toEqual({ presets: [10, 20, 30] });
    expect((await w.call('GET', '/api/promos')).body.presets).toEqual([10, 20, 30]);
    for (const presets of [[10, 20], [10, 10, 20], [0, 5, 10], [5, 10, 200], 'x']) {
      expect((await w.call('PUT', '/api/discount-presets', { presets })).body.error).toBe('bad_presets');
    }
  });

  it('a sale made with a promotion keeps its name on the line, and the report adds up what it gave away', async () => {
    const { w, items } = await shop();
    const promo = (await w.call('POST', '/api/promos', OCT)).body.promo as Promo;
    const k = items.find((i) => i.ulMenuId === 'm-karipap-01')!; // RM1.00
    let lines = addItemWithPromos([], k, [promo], '2026-10-11');
    lines = addItemWithPromos(lines, k, [promo], '2026-10-11');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ quantity: 2, unitPriceSen: 90, listPriceSen: 100, discountPct: 10, promoId: promo.id, promoName: 'Promo Oktober' });
    const sale = buildSale({
      id: 'sale-promo-0001', number: 'A7-0001', deviceId: 'device-abcdef01', createdAt: '2026-10-11T07:42:00.000Z', discountSen: 0, lines, method: 'cash', cashReceivedSen: 200,
    });
    expect(await w.call('POST', '/api/sales', { sale })).toMatchObject({ status: 201 });
    const got = (await w.call('GET', `/api/sales/${sale.id}`)).body.sale;
    expect(got.lines[0]).toMatchObject({ promoId: promo.id, promoName: 'Promo Oktober', listPriceSen: 100, unitPriceSen: 90 });
    // Removing the promotion later changes no record.
    await w.call('DELETE', `/api/promos/${promo.id}`);
    expect((await w.call('GET', `/api/sales/${sale.id}`)).body.sale.lines[0].promoName).toBe('Promo Oktober');
    expect(promoTotals([got])).toEqual([{ promoId: promo.id, name: 'Promo Oktober', quantity: 2, discountSen: 20, revenueSen: 180 }]);
  });

  it('a promotion name without its discount, or a bad one, is refused on a sale', async () => {
    const { w, items } = await shop();
    const k = items.find((i) => i.ulMenuId === 'm-karipap-01')!;
    const base = buildSale({
      id: 'sale-promo-0002', number: 'A7-0002', deviceId: 'device-abcdef01', createdAt: '2026-10-11T07:42:00.000Z', discountSen: 0,
      lines: [{ itemId: k.id, name: k.name, unitPriceSen: 100, quantity: 1, marginPct: null, note: '' }], method: 'qr', cashReceivedSen: null,
    });
    const send = (line: Record<string, unknown>) => w.call('POST', '/api/sales', { sale: { ...base, lines: [{ ...base.lines[0]!, ...line }] } });
    expect((await send({ promoId: 'p1', promoName: 'Promo' })).body).toMatchObject({ error: 'bad_sale', detail: 'lines[0].promoId' });
    expect((await send({ promoId: null, promoName: 'Promo' })).body).toMatchObject({ detail: 'lines[0].promoName' });
    const discounted = { listPriceSen: 120, unitPriceSen: 100 };
    const ok = { ...base, subtotalSen: 100, totalSen: 100 };
    expect((await w.call('POST', '/api/sales', { sale: { ...ok, lines: [{ ...base.lines[0]!, ...discounted, promoId: 'p1', promoName: 'x'.repeat(41) }] } })).body).toMatchObject({ detail: 'lines[0].promoName' });
    expect((await w.call('POST', '/api/sales', { sale: { ...ok, lines: [{ ...base.lines[0]!, ...discounted, promoId: 'p1', promoName: 'Promo' }] } })).status).toBe(201);
  });
});
