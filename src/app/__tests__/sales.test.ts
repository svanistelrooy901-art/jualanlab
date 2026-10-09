import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeWorld, ORIGIN } from '../../../server/core/__tests__/world';
import { JualanDb, useDatabase, db, getDevice, replaceItems, listItems } from '../../db/db';
import { addItem } from '../../domain/cart';
import type { Item } from '../../domain/items';
import { summarise } from '../../domain/summary';
import { normaliseMyPhone, whatsappLink } from '../../domain/whatsapp';
import { setFetch } from '../api';
import { malaysiaDay, pendingCount, recordSale, salesBetween, syncSales } from '../sales';

let n = 0;
beforeEach(() => {
  useDatabase(new JualanDb(`test-${++n}`));
});

type World = Awaited<ReturnType<typeof makeWorld>>;

/** The client talks to the real server core, with the world's cookie jar. */
function connect(w: World, opts: { down?: () => boolean } = {}) {
  setFetch(async (input, init) => {
    if (opts.down?.()) throw new TypeError('Failed to fetch');
    const headers = new Headers(init?.headers);
    if (init?.method && init.method !== 'GET') headers.set('origin', ORIGIN);
    if (w.cookie) headers.set('cookie', w.cookie);
    return w.handle(new Request(`${ORIGIN}${String(input)}`, { method: init?.method, headers, body: init?.body }));
  });
}

async function shopWithItem(w: World): Promise<{ shopId: string; item: Item }> {
  await w.signIn();
  const me = await w.call('POST', '/api/shop', { name: 'Dapur Mak Long' });
  const r = await w.call('POST', '/api/items', { name: 'Karipap', category: 'Kuih', priceSen: 100 });
  return { shopId: me.body.shop.id, item: r.body.item };
}

describe('sales on the phone', () => {
  it('numbers receipts per device and saves the sale before any network', async () => {
    const dev = await getDevice(() => 0.1, () => 'device-0001');
    expect(dev.tag).toMatch(/^[A-Z2-9]{2}$/);
    expect(await getDevice()).toEqual(dev);
    const item = { id: 'item-0001', source: 'own', ulMenuId: null, name: 'Karipap', category: null, priceSen: 100, ulPriceSen: null, marginPct: null, status: null, baseUlMenuId: null, active: true, updatedAt: '' } as Item;
    const a = await recordSale({ shopId: 's1', lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null });
    const b = await recordSale({ shopId: 's1', lines: addItem([], item), discountSen: 0, method: 'cash', cashReceivedSen: 500 });
    expect(a.number).toBe(`${dev.tag}-0001`);
    expect(b.number).toBe(`${dev.tag}-0002`);
    expect(b.changeSen).toBe(400);
    expect(await pendingCount('s1')).toBe(2);
    await expect(recordSale({ shopId: 's1', lines: addItem([], item), discountSen: 0, method: 'cash', cashReceivedSen: 50 })).rejects.toThrow();
    expect(await db.sales.count()).toBe(2);
  });

  it('sends waiting sales once the connection is back, and sending twice is harmless', async () => {
    const w = await makeWorld();
    let down = true;
    connect(w, { down: () => down });
    const { shopId, item } = await shopWithItem(w);
    const sale = await recordSale({ shopId, lines: addItem(addItem([], item), item), discountSen: 0, method: 'cash', cashReceivedSen: 1000 });

    expect(await syncSales(shopId)).toBe('offline');
    expect(await pendingCount(shopId)).toBe(1);

    down = false;
    expect(await syncSales(shopId)).toBe('done');
    expect(await pendingCount(shopId)).toBe(0);
    expect((await db.sales.get(sale.id))?.sync).toBe('sent');

    await db.sales.update(sale.id, { sync: 'pending' });
    expect(await syncSales(shopId)).toBe('done');
    const day = malaysiaDay(new Date(sale.createdAt));
    const onServer = await w.call('GET', `/api/sales?from=${day.from}&to=${day.to}`);
    expect(onServer.body.sales).toHaveLength(1);
    expect(onServer.body.sales[0].totalSen).toBe(200);
  });

  it('keeps a sale the server refuses, marked, and carries on with the rest', async () => {
    const w = await makeWorld();
    connect(w);
    const { shopId, item } = await shopWithItem(w);
    const ghost = { ...item, id: 'not-on-server-1' };
    const bad = await recordSale({ shopId, lines: addItem([], ghost), discountSen: 0, method: 'qr', cashReceivedSen: null });
    const good = await recordSale({ shopId, lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null });
    expect(await syncSales(shopId)).toBe('done');
    expect(await db.sales.get(bad.id)).toMatchObject({ sync: 'rejected', syncError: 'unknown_item' });
    expect((await db.sales.get(good.id))?.sync).toBe('sent');
  });

  it('stops when signed out and keeps everything', async () => {
    const w = await makeWorld();
    connect(w);
    const { shopId, item } = await shopWithItem(w);
    await recordSale({ shopId, lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null });
    w.cookie = '';
    expect(await syncSales(shopId)).toBe('signed_out');
    expect(await pendingCount(shopId)).toBe(1);
  });

  it('only sends the signed-in shop\'s sales', async () => {
    const w = await makeWorld();
    connect(w);
    const { shopId, item } = await shopWithItem(w);
    await recordSale({ shopId: 'another-shop', lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null });
    expect(await syncSales(shopId)).toBe('done');
    expect(await pendingCount('another-shop')).toBe(1);
  });

  it('lists today by Malaysian day and caches the catalogue per shop', async () => {
    expect(malaysiaDay(new Date('2026-10-10T17:30:00Z'))).toEqual({ from: '2026-10-10T16:00:00.000Z', to: '2026-10-11T16:00:00.000Z' });
    const item = { id: 'item-0001', source: 'own', ulMenuId: null, name: 'Air', category: null, priceSen: 150, ulPriceSen: null, marginPct: null, status: null, baseUlMenuId: null, active: true, updatedAt: '' } as Item;
    await recordSale({ shopId: 's1', lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null, now: new Date('2026-10-10T15:59:00Z') });
    await recordSale({ shopId: 's1', lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null, now: new Date('2026-10-10T16:01:00Z') });
    const d = malaysiaDay(new Date('2026-10-10T20:00:00Z'));
    expect(await salesBetween('s1', d.from, d.to)).toHaveLength(1);

    await replaceItems('s1', [item]);
    await replaceItems('s2', [{ ...item, id: 'item-0002' }]);
    await replaceItems('s1', []);
    expect(await listItems('s1')).toEqual([]);
    expect(await listItems('s2')).toHaveLength(1);
  });
});

describe('day summary', () => {
  it('adds up done sales, splits cash, and leaves voids and margin-less items out of profit', () => {
    const base = { deviceId: 'd', createdAt: '', channel: 'counter' as const, cashReceivedSen: null, changeSen: null, voidReason: null, voidedAt: null, number: 'AB-0001' };
    const s = summarise([
      { ...base, id: '1', lines: [{ itemId: 'a', name: 'A', unitPriceSen: 1000, quantity: 2, marginPct: 30, note: '' }], subtotalSen: 2000, discountSen: 0, totalSen: 2000, method: 'cash', status: 'done' },
      { ...base, id: '2', lines: [{ itemId: 'b', name: 'B', unitPriceSen: 500, quantity: 1, marginPct: null, note: '' }], subtotalSen: 500, discountSen: 0, totalSen: 500, method: 'qr', status: 'done' },
      { ...base, id: '3', lines: [{ itemId: 'a', name: 'A', unitPriceSen: 1000, quantity: 9, marginPct: 30, note: '' }], subtotalSen: 9000, discountSen: 0, totalSen: 9000, method: 'cash', status: 'void' },
    ]);
    expect(s).toEqual({ count: 2, itemCount: 3, totalSen: 2500, estProfitSen: 600, itemsWithoutMargin: 1, cashSen: 2000, otherSen: 500 });
  });
});

describe('WhatsApp receipt link', () => {
  it('turns Malaysian numbers into international form', () => {
    expect(normaliseMyPhone('012-345 6789')).toBe('60123456789');
    expect(normaliseMyPhone('+60 12 345 6789')).toBe('60123456789');
    expect(normaliseMyPhone('60123456789')).toBe('60123456789');
    expect(normaliseMyPhone('12')).toBeNull();
    expect(whatsappLink('Resit A & B')).toBe('https://wa.me/?text=Resit%20A%20%26%20B');
    expect(whatsappLink('x', '0123456789')).toBe('https://wa.me/60123456789?text=x');
  });
});
