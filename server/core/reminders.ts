/**
 * Scheduled reminders (Workers cron). OM-04: 30 minutes before closing, a store in mode 'auto' that counts stock
 * gets one phone notification asking to check tomorrow's stock (once a day; none after the seller answered).
 */
import { closingToday, myClock } from '../../src/domain/kedai';
import type { Store } from './ports';
import { notifyShop, type PushResult } from './webpush';

export async function stockReminderSweep(store: Store, push: (endpoint: string) => Promise<PushResult>, nowIso: string): Promise<number> {
  const c = myClock(nowIso);
  let sent = 0;
  for (const { shopId, settings: s } of await store.listStores()) {
    if (s.orderMode !== 'auto' || !s.published) continue;
    const close = closingToday(s, nowIso);
    if (!close) continue;
    const closeMin = Number(close.slice(0, 2)) * 60 + Number(close.slice(3, 5));
    if (c.minutes < closeMin - 30 || c.minutes >= closeMin) continue;
    if (await store.hasReminder(shopId, 'stock-ok', c.date)) continue;
    if (![...(await store.listItemStore(shopId)).values()].some((x) => x.stock !== null)) continue;
    if (!(await store.markReminder(shopId, 'stock-push', c.date, nowIso))) continue;
    sent += await notifyShop(store, push, shopId);
  }
  return sent;
}
