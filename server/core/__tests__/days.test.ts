/** Business days (T-07): opened and closed by hand, shop-wide, may run past midnight. */
import { describe, expect, it } from 'vitest';
import { buildSale, type Sale } from '../../../src/domain/sale';
import { SqlStore } from '../store';
import { migrate, sqliteD1 } from './sqlite';
import { makeWorld } from './world';

const PHONE_A = 'device-aaaaaaa1';
const PHONE_B = 'device-bbbbbbb2';

async function stall() {
  const w = await makeWorld();
  await w.signIn();
  await w.call('POST', '/api/shop', { name: 'Burger Malam' });
  const item = (await w.call('POST', '/api/items', { name: 'Burger daging', priceSen: 600, category: null })).body.item as { id: string; name: string; priceSen: number };
  let n = 0;
  const sale = (createdAt: string, dayId: string | null, over: Partial<Sale> = {}): Sale => ({
    ...buildSale({
      id: `sale-${String(++n).padStart(8, '0')}`, number: `A7-${String(n).padStart(4, '0')}`, deviceId: PHONE_A, createdAt, dayId, discountSen: 0,
      lines: [{ itemId: item.id, name: item.name, unitPriceSen: item.priceSen, quantity: 1, marginPct: 40, note: '' }], method: 'cash', cashReceivedSen: 600,
    }),
    ...over,
  });
  const open = (id: string, openedAt: string, floatSen = 0, deviceId = PHONE_A, lastSeenDayId: string | null = null) =>
    w.call('POST', '/api/days/open', { id, openedAt, floatSen, deviceId, lastSeenDayId });
  return { w, sale, open };
}

describe('business days', () => {
  it('a night stall from 5 pm to 2 am is one day: every sale counts there, and closing adds up the whole night', async () => {
    const { w, sale, open } = await stall();
    w.setNow('2026-10-11T09:01:00.000Z'); // 5:01 pm in Malaysia
    const o = await open('day-night-0001', '2026-10-11T09:00:00.000Z', 5000);
    expect(o).toMatchObject({ status: 200, body: { joined: false, day: { id: 'day-night-0001', openedAt: '2026-10-11T09:00:00.000Z', closedAt: null, floatSen: 5000, counted: false } } });
    expect((await w.call('GET', '/api/days')).body.open.id).toBe('day-night-0001');
    w.setNow('2026-10-11T18:10:00.000Z'); // 2:10 am the next calendar day
    await w.call('POST', '/api/sales', { sale: sale('2026-10-11T10:00:00.000Z', 'day-night-0001') }); // 6 pm
    expect((await w.call('POST', '/api/sales', { sale: sale('2026-10-11T17:30:00.000Z', 'day-night-0001') })).body).toEqual({ status: 'created', dayId: 'day-night-0001' }); // 1:30 am
    const c = await w.call('POST', '/api/days/day-night-0001/close', { floatSen: 5000, countedCashSen: 6200 });
    expect(c.body.close).toMatchObject({ day: '2026-10-11', expectedCashSen: 6200, totals: { summary: { count: 2, totalSen: 1200 } } });
    const days = (await w.call('GET', '/api/days')).body;
    expect(days.open).toBeNull();
    expect(days.days[0]).toEqual({ id: 'day-night-0001', openedAt: '2026-10-11T09:00:00.000Z', closedAt: '2026-10-11T18:10:00.000Z', floatSen: 5000, counted: true });
    // A phone that was offline sends a sale made before the close: it joins the closed day, which then differs from its count.
    await w.call('POST', '/api/sales', { sale: sale('2026-10-11T17:55:00.000Z', 'day-night-0001') });
    const day = (await w.call('GET', '/api/days/day-night-0001')).body;
    expect(day.sales).toHaveLength(3);
    expect(day.closes[0].totals.summary.totalSen).toBe(1200);
  });

  it('one open day per shop: a second phone opening joins it, the earlier opening time is kept', async () => {
    const { w, sale, open } = await stall();
    w.setNow('2026-10-12T02:00:00.000Z');
    await open('day-phone-a001', '2026-10-12T01:00:00.000Z', 3000);
    // Phone B opened without internet a little earlier, and sold before reconnecting.
    expect((await w.call('POST', '/api/sales', { sale: sale('2026-10-12T00:55:00.000Z', 'day-phone-b001', { deviceId: PHONE_B }) })).body.dayId).toBe('day-phone-a001');
    const b = await open('day-phone-b001', '2026-10-12T00:50:00.000Z', 2000, PHONE_B);
    expect(b.body).toMatchObject({ joined: true, day: { id: 'day-phone-a001', openedAt: '2026-10-12T00:50:00.000Z', floatSen: 3000 } });
    await w.call('POST', '/api/sales', { sale: sale('2026-10-12T01:30:00.000Z', 'day-phone-a001') });
    // Either id shows the same day, with both phones' sales.
    const viaB = (await w.call('GET', '/api/days/day-phone-b001')).body;
    expect(viaB.day.id).toBe('day-phone-a001');
    expect(viaB.sales).toHaveLength(2);
    const list = (await w.call('GET', '/api/days')).body.days;
    expect(list.map((d: { id: string }) => d.id)).toEqual(['day-phone-a001']);
    // Opening again is harmless.
    expect((await open('day-phone-a001', '2026-10-12T01:00:00.000Z', 3000)).body.day.openedAt).toBe('2026-10-12T00:50:00.000Z');
  });

  it('an opening made offline while another day was open then is joined to that day, even if it has closed since', async () => {
    const { w, open } = await stall();
    w.setNow('2026-10-12T15:00:00.000Z');
    await open('day-morning-01', '2026-10-12T01:00:00.000Z');
    await w.call('POST', '/api/days/day-morning-01/close', { floatSen: 0, countedCashSen: 0 });
    const late = await open('day-offline-01', '2026-10-12T03:00:00.000Z');
    expect(late.body).toMatchObject({ joined: true, day: { id: 'day-morning-01' } });
    // After the close, a new opening is a new day.
    expect((await open('day-evening-01', '2026-10-12T15:00:00.000Z')).body).toMatchObject({ joined: false, day: { id: 'day-evening-01', closedAt: null } });
  });

  it('a phone that saw the day close opens a new one, even when its clock is a few minutes behind', async () => {
    const { w, open } = await stall();
    w.setNow('2026-10-12T15:00:00.000Z');
    await open('day-lunch-0001', '2026-10-12T03:00:00.000Z');
    await w.call('POST', '/api/days/day-lunch-0001/close', { floatSen: 0, countedCashSen: 0 });
    // The phone thinks it is 14:57; it knew day-lunch had closed.
    const next = await open('day-dinner-001', '2026-10-12T14:57:00.000Z', 0, PHONE_A, 'day-lunch-0001');
    expect(next.body).toMatchObject({ joined: false, day: { id: 'day-dinner-001', openedAt: '2026-10-12T15:00:00.000Z', closedAt: null } });
  });

  it('a sale that arrives before its day starts it; the opening then fills in the time and cash', async () => {
    const { w, sale, open } = await stall();
    w.setNow('2026-10-12T05:00:00.000Z');
    await w.call('POST', '/api/sales', { sale: sale('2026-10-12T04:10:00.000Z', 'day-early-0001') });
    expect((await w.call('GET', '/api/days')).body.open).toMatchObject({ id: 'day-early-0001', openedAt: '2026-10-12T04:10:00.000Z', floatSen: 0 });
    const o = await open('day-early-0001', '2026-10-12T04:00:00.000Z', 2500);
    expect(o.body).toMatchObject({ joined: false, day: { id: 'day-early-0001', openedAt: '2026-10-12T04:00:00.000Z', floatSen: 2500 } });
  });

  it('a sale from an app older than business days goes into the day open when it was made, or starts one', async () => {
    const { w, sale, open } = await stall();
    w.setNow('2026-10-12T05:00:00.000Z');
    const first = (await w.call('POST', '/api/sales', { sale: sale('2026-10-12T04:00:00.000Z', null) })).body.dayId;
    expect(first).toEqual(expect.any(String));
    expect((await w.call('POST', '/api/sales', { sale: sale('2026-10-12T04:30:00.000Z', null) })).body.dayId).toBe(first);
    await w.call('POST', `/api/days/${first}/close`, { floatSen: 0, countedCashSen: 1200 });
    await open('day-next-00001', '2026-10-12T05:00:00.000Z');
    expect((await w.call('POST', '/api/sales', { sale: sale('2026-10-12T05:00:00.000Z', null) })).body.dayId).toBe('day-next-00001');
  });

  it('profit and the money envelopes follow UntungLab\'s cost when an item is sold at a discount', async () => {
    const { w, sale, open } = await stall();
    w.setNow('2026-10-12T05:00:00.000Z');
    await open('day-disc-00001', '2026-10-12T04:00:00.000Z');
    // Burger at RM6.00, cost RM3.60 from UntungLab: 10% off sells at RM5.40, profit RM1.80.
    const s = sale('2026-10-12T04:30:00.000Z', 'day-disc-00001');
    const line = { ...s.lines[0]!, unitPriceSen: 540, listPriceSen: 600, discountPct: 10, unitCostSen: 360, marginPct: 33.33 };
    const discounted = { ...s, lines: [line], subtotalSen: 540, totalSen: 540, cashReceivedSen: 600, changeSen: 60 };
    expect((await w.call('POST', '/api/sales', { sale: discounted })).status).toBe(201);
    const day = (await w.call('GET', '/api/days/day-disc-00001')).body;
    expect(day.sales[0].lines[0]).toMatchObject({ unitPriceSen: 540, listPriceSen: 600, discountPct: 10, unitCostSen: 360 });
    const c = (await w.call('POST', '/api/days/day-disc-00001/close', { floatSen: 0, countedCashSen: 540 })).body.close;
    expect(c.totals.summary).toMatchObject({ totalSen: 540, estProfitSen: 180, itemDiscountSen: 60 });
    expect(c.totals.envelopes).toEqual({ capitalSen: 360, profitSen: 180, unsplitSen: 0 });
  });

  it('a day closed by mistake can be opened again, only the latest one and only while none is open', async () => {
    const { w, open } = await stall();
    w.setNow('2026-10-12T03:00:00.000Z');
    await open('day-first-0001', '2026-10-12T01:00:00.000Z');
    await w.call('POST', '/api/days/day-first-0001/close', { floatSen: 0, countedCashSen: 0 });
    w.setNow('2026-10-12T05:00:00.000Z');
    await open('day-second-001', '2026-10-12T04:00:00.000Z', 0, PHONE_A, 'day-first-0001');
    expect((await w.call('POST', '/api/days/day-first-0001/reopen', {})).body.error).toBe('another_open');
    await w.call('POST', '/api/days/day-second-001/close', { floatSen: 0, countedCashSen: 0 });
    expect((await w.call('POST', '/api/days/day-first-0001/reopen', {})).body.error).toBe('not_latest');
    expect((await w.call('POST', '/api/days/day-second-001/reopen', {})).body.day).toMatchObject({ id: 'day-second-001', closedAt: null, counted: true });
    expect((await w.call('GET', '/api/days')).body.open.id).toBe('day-second-001');
  });

  it('checks what a phone sends, and a phone clock running ahead is held to the server time', async () => {
    const { w, open } = await stall();
    w.setNow('2026-10-12T05:00:00.000Z');
    expect((await open('short', '2026-10-12T05:00:00.000Z')).body.error).toBe('bad_day');
    expect((await w.call('POST', '/api/days/open', { id: 'day-time-0001', openedAt: 'tomorrow', floatSen: 0 })).body.error).toBe('bad_time');
    expect((await open('day-time-0001', '2026-10-12T05:00:00.000Z', -5)).body.error).toBe('bad_float');
    expect((await open('day-time-0001', '2026-10-13T09:00:00.000Z')).body.day.openedAt).toBe('2026-10-12T05:00:00.000Z');
  });

  it('one shop cannot see or close another shop\'s day', async () => {
    const { w, open } = await stall();
    w.setNow('2026-10-12T05:00:00.000Z');
    await open('day-mine-00001', '2026-10-12T04:00:00.000Z');
    w.cookie = '';
    await w.signIn('jiran@example.com');
    await w.call('POST', '/api/shop', { name: 'Kedai Jiran' });
    expect((await w.call('GET', '/api/days/day-mine-00001')).status).toBe(404);
    expect((await w.call('POST', '/api/days/day-mine-00001/close', { floatSen: 0, countedCashSen: 0 })).status).toBe(404);
    // Its own opening with the same id is refused, never joined to the other shop's day.
    expect((await open('day-mine-00001', '2026-10-12T04:30:00.000Z')).body.error).toBe('bad_day');
    expect((await w.call('GET', '/api/days')).body.days).toEqual([]);
  });
});

describe('migration to business days', () => {
  it('puts sales made before it into one ended day per shop and Malaysian date, keeping their closes', async () => {
    const d1 = sqliteD1();
    await migrate(d1, '0003_billing.sql');
    const store = new SqlStore(d1);
    await d1.prepare("INSERT INTO users (id, email, created_at) VALUES ('u1', 'a@example.com', '2026-10-01T00:00:00.000Z')").run();
    await store.createShop({ id: 'shop00000001', ownerId: 'u1', name: 'Kedai', createdAt: '2026-10-01T00:00:00.000Z' });
    const line = { itemId: 'item00000001', name: 'Karipap', unitPriceSen: 100, quantity: 1, marginPct: 30, note: '' };
    const old = (id: string, createdAt: string) => ({ ...buildSale({ id, number: 'A7-0001', deviceId: PHONE_A, createdAt, lines: [line], discountSen: 0, method: 'qr', cashReceivedSen: null }) });
    // Before migration 4 the sales table has no day column: write the rows as the old app did.
    for (const s of [old('sale-old-00001', '2026-10-10T02:00:00.000Z'), old('sale-old-00002', '2026-10-10T15:30:00.000Z'), old('sale-old-00003', '2026-10-11T03:00:00.000Z')]) {
      await d1.prepare(`INSERT INTO sales (id, shop_id, number, device_id, created_at, channel, subtotal_sen, discount_sen, total_sen, method, status, received_at)
        VALUES (?, 'shop00000001', ?, ?, ?, 'counter', 100, 0, 100, 'qr', 'done', ?)`).bind(s.id, s.number, s.deviceId, s.createdAt, s.createdAt).run();
    }
    await d1.prepare(`INSERT INTO day_closes (id, shop_id, day, closed_at, device_id, float_sen, expected_cash_sen, counted_cash_sen, totals_json)
      VALUES ('close-0001', 'shop00000001', '2026-10-10', '2026-10-10T14:00:00.000Z', 'x', 3000, 3000, 3000, '{}')`).run();
    await migrate(d1);
    const days = await store.listDays('shop00000001', 10);
    // 15:30 UTC on the 10th is 11:30 pm Malaysian time: still the 10th. 03:00 UTC on the 11th is the 11th.
    expect(days.map((d) => [d.id, d.openedAt, d.closedAt, d.floatSen, d.counted])).toEqual([
      ['legacy-shop00000001-2026-10-11', '2026-10-11T03:00:00.000Z', '2026-10-11T03:00:00.000Z', 0, false],
      ['legacy-shop00000001-2026-10-10', '2026-10-10T02:00:00.000Z', '2026-10-10T14:00:00.000Z', 3000, true],
    ]);
    expect((await store.listSalesOfDay('shop00000001', 'legacy-shop00000001-2026-10-10')).map((s) => s.id).sort()).toEqual(['sale-old-00001', 'sale-old-00002']);
    expect((await store.listClosesOfDay('shop00000001', 'legacy-shop00000001-2026-10-10'))[0]!.floatSen).toBe(3000);
    expect(await store.openDay('shop00000001')).toBeNull();
  });
});
