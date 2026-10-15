import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeWorld, ORIGIN } from '../../../server/core/__tests__/world';
import { JualanDb, useDatabase, db, getDevice, replaceItems, listItems } from '../../db/db';
import { addItem } from '../../domain/cart';
import type { Item } from '../../domain/items';
import { summarise } from '../../domain/summary';
import { normaliseMyPhone, whatsappLink } from '../../domain/whatsapp';
import { setFetch } from '../api';
import { malaysiaDay, pendingCount, recordSale, retrySale, salesBetween, syncSales, voidLocalSale, waitingSummary } from '../sales';
import { currentDay, knownDays, NoOpenDay, openDay, openDayHere } from '../days';
import { mergeDay } from '../useDay';
import { endBazaar, loadBazaar, MAX_BAZAAR_BUTTONS, startBazaar } from '../bazaar';

let n = 0;
beforeEach(() => {
  useDatabase(new JualanDb(`test-${++n}`));
});

type World = Awaited<ReturnType<typeof makeWorld>>;

/** Sells into the open day, opening one first when there is none (most tests are not about days). */
async function sell(input: Parameters<typeof recordSale>[0]) {
  if (!(await currentDay(input.shopId))) await openDayHere(input.shopId, 0, input.now);
  return recordSale(input);
}

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
    const a = await sell({ shopId: 's1', lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null });
    const b = await sell({ shopId: 's1', lines: addItem([], item), discountSen: 0, method: 'cash', cashReceivedSen: 500 });
    expect(a.number).toBe(`${dev.tag}-0001`);
    expect(b.number).toBe(`${dev.tag}-0002`);
    expect(b.changeSen).toBe(400);
    expect(await pendingCount('s1')).toBe(2);
    await expect(sell({ shopId: 's1', lines: addItem([], item), discountSen: 0, method: 'cash', cashReceivedSen: 50 })).rejects.toThrow();
    expect(await db.sales.count()).toBe(2);
  });

  it('sends waiting sales once the connection is back, and sending twice is harmless', async () => {
    const w = await makeWorld();
    let down = true;
    connect(w, { down: () => down });
    const { shopId, item } = await shopWithItem(w);
    const sale = await sell({ shopId, lines: addItem(addItem([], item), item), discountSen: 0, method: 'cash', cashReceivedSen: 1000 });

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
    const bad = await sell({ shopId, lines: addItem([], ghost), discountSen: 0, method: 'qr', cashReceivedSen: null });
    const good = await sell({ shopId, lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null });
    expect(await syncSales(shopId)).toBe('done');
    expect(await db.sales.get(bad.id)).toMatchObject({ sync: 'rejected', syncError: 'unknown_item' });
    expect((await db.sales.get(good.id))?.sync).toBe('sent');
  });

  it('stops when signed out and keeps everything', async () => {
    const w = await makeWorld();
    connect(w);
    const { shopId, item } = await shopWithItem(w);
    await sell({ shopId, lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null });
    w.cookie = '';
    expect(await syncSales(shopId)).toBe('signed_out');
    expect(await pendingCount(shopId)).toBe(1);
  });

  it('only sends the signed-in shop\'s sales', async () => {
    const w = await makeWorld();
    connect(w);
    const { shopId, item } = await shopWithItem(w);
    await sell({ shopId: 'another-shop', lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null });
    expect(await syncSales(shopId)).toBe('done');
    expect(await pendingCount('another-shop')).toBe(1);
  });

  it('lists today by Malaysian day and caches the catalogue per shop', async () => {
    expect(malaysiaDay(new Date('2026-10-10T17:30:00Z'))).toEqual({ from: '2026-10-10T16:00:00.000Z', to: '2026-10-11T16:00:00.000Z' });
    const item = { id: 'item-0001', source: 'own', ulMenuId: null, name: 'Air', category: null, priceSen: 150, ulPriceSen: null, marginPct: null, status: null, baseUlMenuId: null, active: true, updatedAt: '' } as Item;
    await sell({ shopId: 's1', lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null, now: new Date('2026-10-10T15:59:00Z') });
    await sell({ shopId: 's1', lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null, now: new Date('2026-10-10T16:01:00Z') });
    const d = malaysiaDay(new Date('2026-10-10T20:00:00Z'));
    expect(await salesBetween('s1', d.from, d.to)).toHaveLength(1);

    await replaceItems('s1', [item]);
    await replaceItems('s2', [{ ...item, id: 'item-0002' }]);
    await replaceItems('s1', []);
    expect(await listItems('s1')).toEqual([]);
    expect(await listItems('s2')).toHaveLength(1);
  });
});

describe('offline queue (Phase 5)', () => {
  it('a sale whose answer was lost is resent and lands once', async () => {
    const w = await makeWorld();
    let loseAnswer = true;
    setFetch(async (input, init) => {
      const headers = new Headers(init?.headers);
      if (init?.method && init.method !== 'GET') headers.set('origin', ORIGIN);
      if (w.cookie) headers.set('cookie', w.cookie);
      const res = await w.handle(new Request(`${ORIGIN}${String(input)}`, { method: init?.method, headers, body: init?.body }));
      if (loseAnswer && String(input) === '/api/sales') {
        loseAnswer = false;
        throw new TypeError('connection dropped after the server saved it');
      }
      return res;
    });
    const { shopId, item } = await shopWithItem(w);
    const sale = await sell({ shopId, lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null });
    expect(await syncSales(shopId)).toBe('offline');
    expect(await pendingCount(shopId)).toBe(1);
    expect(await syncSales(shopId)).toBe('done');
    const day = malaysiaDay(new Date(sale.createdAt));
    expect((await w.call('GET', `/api/sales?from=${day.from}&to=${day.to}`)).body.sales).toHaveLength(1);
  });

  it('voids offline: an unsent sale goes out voided, a sent one gets a void request', async () => {
    const w = await makeWorld();
    let down = true;
    connect(w, { down: () => down });
    const { shopId, item } = await shopWithItem(w);
    const a = await sell({ shopId, lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null });
    await voidLocalSale(a.id, 'Salah tekan');
    down = false;
    const b = await sell({ shopId, lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null });
    expect(await syncSales(shopId)).toBe('done');
    down = true;
    await voidLocalSale(b.id, 'Pelanggan batal');
    expect(await pendingCount(shopId)).toBe(1);
    expect((await waitingSummary()).count).toBe(1);
    expect(await syncSales(shopId)).toBe('offline');
    down = false;
    expect(await syncSales(shopId)).toBe('done');
    expect(await pendingCount(shopId)).toBe(0);
    const day = malaysiaDay(new Date(a.createdAt));
    const onServer = (await w.call('GET', `/api/sales?from=${day.from}&to=${day.to}`)).body.sales as { id: string; status: string; voidReason: string }[];
    expect(onServer.map((s) => [s.id === a.id ? 'a' : 'b', s.status, s.voidReason]).sort()).toEqual([['a', 'void', 'Salah tekan'], ['b', 'void', 'Pelanggan batal']]);
  });

  it('a refused sale can be put back in the queue', async () => {
    const w = await makeWorld();
    connect(w);
    const { shopId, item } = await shopWithItem(w);
    const ghost = await sell({ shopId, lines: addItem([], { ...item, id: 'not-on-server-2' }), discountSen: 0, method: 'qr', cashReceivedSen: null });
    await syncSales(shopId);
    expect((await db.sales.get(ghost.id))?.sync).toBe('rejected');
    await retrySale(ghost.id);
    expect(await pendingCount(shopId)).toBe(1);
  });

  it('merging a day: the phone wins while it has news the server lacks', () => {
    const mk = (id: string, status: 'done' | 'void') => ({ id, createdAt: `2026-10-11T0${id.length}:00:00.000Z`, status }) as never;
    const serverA = { ...(mk('a', 'done') as object) } as never;
    const local = [
      { id: 'a', shopId: 's', createdAt: '', sale: mk('a', 'void'), sync: 'sent', syncError: null, sentAt: null, voidPending: true },
      { id: 'bb', shopId: 's', createdAt: '', sale: mk('bb', 'done'), sync: 'pending', syncError: null, sentAt: null },
    ] as never[];
    const merged = mergeDay([serverA, mk('ccc', 'done')], local);
    expect(merged.map((r) => [r.sale.id, r.sale.status, r.local ? 'here' : 'other'])).toEqual([['ccc', 'done', 'other'], ['bb', 'done', 'here'], ['a', 'void', 'here']]);
    expect(mergeDay(null, local)).toHaveLength(2);
  });
});

describe('business days on the phone (T-07)', () => {
  it('nothing is sold until a day is open; opening works offline and the day reaches the server before its sales', async () => {
    const w = await makeWorld();
    let down = false;
    connect(w, { down: () => down });
    const { shopId, item } = await shopWithItem(w);
    down = true;
    await expect(recordSale({ shopId, lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null })).rejects.toBeInstanceOf(NoOpenDay);
    const { day, alreadyOpen } = await openDay(shopId, 5000);
    expect(alreadyOpen).toBe(false);
    expect(day).toMatchObject({ sync: 'pending', floatSen: 5000, closedAt: null });
    const sale = await recordSale({ shopId, lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null });
    expect(sale.dayId).toBe(day.id);
    expect(await syncSales(shopId)).toBe('offline');
    down = false;
    expect(await syncSales(shopId)).toBe('done');
    expect(await db.days.get(day.id)).toMatchObject({ sync: 'sent', floatSen: 5000 });
    const onServer = (await w.call('GET', `/api/days/${day.id}`)).body;
    expect(onServer.sales.map((s: { id: string }) => s.id)).toEqual([sale.id]);
  });

  it('two phones that opened offline end up in one day; the second phone follows it, sales and all', async () => {
    const w = await makeWorld();
    connect(w);
    const { shopId, item } = await shopWithItem(w);
    // Phone A opens and syncs.
    const a = await openDayHere(shopId, 3000, new Date(Date.now() - 60_000));
    await sell({ shopId, lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null });
    expect(await syncSales(shopId)).toBe('done');
    // Phone B (its own storage) had opened its own day offline.
    useDatabase(new JualanDb(`phone-b-${n}`));
    const b = await openDayHere(shopId, 2000);
    const bSale = await recordSale({ shopId, lines: addItem([], item), discountSen: 0, method: 'cash', cashReceivedSen: 100 });
    expect(await syncSales(shopId)).toBe('done');
    expect(await db.days.get(b.id)).toBeUndefined();
    expect((await currentDay(shopId))?.id).toBe(a.id);
    expect(await db.sales.get(bSale.id)).toMatchObject({ dayId: a.id, sale: { dayId: a.id } });
    expect((await w.call('GET', `/api/days/${a.id}`)).body.sales).toHaveLength(2);
  });

  it('a day closed on another phone is closed here after the next sync, so the next sale asks for a new day', async () => {
    const w = await makeWorld();
    connect(w);
    const { shopId, item } = await shopWithItem(w);
    const day = await openDayHere(shopId, 0);
    await syncSales(shopId);
    await w.call('POST', `/api/days/${day.id}/close`, { floatSen: 0, countedCashSen: 0 });
    expect(await syncSales(shopId)).toBe('done');
    expect(await currentDay(shopId)).toBeNull();
    expect((await knownDays(shopId))[0]).toMatchObject({ id: day.id, counted: true });
    await expect(recordSale({ shopId, lines: addItem([], item), discountSen: 0, method: 'qr', cashReceivedSen: null })).rejects.toBeInstanceOf(NoOpenDay);
    // Online, opening uses a day another phone already opened instead of making a second one.
    const other = await w.call('POST', '/api/days/open', { id: 'day-other-0001', openedAt: new Date().toISOString(), floatSen: 0, lastSeenDayId: day.id });
    expect(other.body.joined).toBe(false);
    expect(await openDay(shopId, 999)).toMatchObject({ alreadyOpen: true, day: { id: 'day-other-0001' } });
  });
});

describe('phone storage upgrade', () => {
  it('a phone with sales from before business days keeps them, and they can be looked up by day once the server places them', async () => {
    const name = `old-phone-${n}`;
    const old = new Dexie(name);
    old.version(1).stores({ items: 'id, shopId', sales: 'id, createdAt, sync, [shopId+sync], [shopId+createdAt]', meta: 'key' });
    const sale = { id: 'sale-old-0001', number: 'AB-0001', createdAt: '2026-10-14T10:00:00.000Z', lines: [], status: 'done' };
    await old.table('sales').add({ id: sale.id, shopId: 's1', createdAt: sale.createdAt, sale, sync: 'pending', syncError: null, sentAt: null });
    old.close();
    useDatabase(new JualanDb(name));
    expect(await db.sales.get(sale.id)).toMatchObject({ dayId: null, sync: 'pending' });
    expect(await pendingCount('s1')).toBe(1);
    // The server answers with the day it put the sale in; the phone follows.
    const { followSaleDay } = await import('../days');
    await followSaleDay(sale.id, 'day-server-0001');
    expect((await db.sales.where('[shopId+dayId]').equals(['s1', 'day-server-0001']).toArray()).map((r) => r.id)).toEqual([sale.id]);
  });
});

describe('day summary', () => {
  it('adds up done sales, splits cash, and leaves voids and margin-less items out of profit', () => {
    const base = { deviceId: 'd', createdAt: '', channel: 'counter' as const, cashReceivedSen: null, changeSen: null, voidReason: null, voidedAt: null, dayId: null, number: 'AB-0001' };
    const s = summarise([
      { ...base, id: '1', lines: [{ itemId: 'a', name: 'A', unitPriceSen: 1000, quantity: 2, marginPct: 30, note: '' }], subtotalSen: 2000, discountSen: 0, totalSen: 2000, method: 'cash', status: 'done' },
      { ...base, id: '2', lines: [{ itemId: 'b', name: 'B', unitPriceSen: 500, quantity: 1, marginPct: null, note: '' }], subtotalSen: 500, discountSen: 0, totalSen: 500, method: 'qr', status: 'done' },
      { ...base, id: '3', lines: [{ itemId: 'a', name: 'A', unitPriceSen: 1000, quantity: 9, marginPct: 30, note: '' }], subtotalSen: 9000, discountSen: 0, totalSen: 9000, method: 'cash', status: 'void' },
    ]);
    expect(s).toMatchObject({ count: 2, itemCount: 3, totalSen: 2500, estProfitSen: 600, itemsWithoutMargin: 1, cashSen: 2000, otherSen: 500, voidCount: 1, voidSen: 9000, marginRevenueSen: 2000 });
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

describe('Bazaar Mode settings', () => {
  it('starts in the open day with at most 8 buttons, keeps the float for next time, and ends', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `item-${i}`);
    const s = await startBazaar('s1', { ...(await loadBazaar('s1')), itemIds: ids, floatSen: 10000 }, 'day-bazaar-001');
    expect(s.itemIds).toHaveLength(MAX_BAZAAR_BUTTONS);
    expect(s.runningDayId).toBe('day-bazaar-001');
    await endBazaar('s1');
    expect((await loadBazaar('s1')).runningDayId).toBeNull();
    expect((await loadBazaar('s1')).floatSen).toBe(10000);
  });

  it('bazaar sales carry their channel', async () => {
    const item = { id: 'item-0009', source: 'own', ulMenuId: null, name: 'Air', category: null, priceSen: 150, ulPriceSen: null, marginPct: null, status: null, baseUlMenuId: null, active: true, updatedAt: '' } as Item;
    const sale = await sell({ shopId: 's1', lines: addItem([], item), discountSen: 0, method: 'cash', cashReceivedSen: 200, channel: 'bazaar' });
    expect(sale).toMatchObject({ channel: 'bazaar', changeSen: 50 });
  });
});

