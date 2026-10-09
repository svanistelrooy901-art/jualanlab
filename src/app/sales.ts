/**
 * Sales on this phone: saved here first (the sale is never lost to a bad connection), then sent to the server.
 * The server de-duplicates by sale id, so sending twice is safe.
 */
import { buildSale, receiptNumber, type PayMethod, type Sale } from '../domain/sale';
import type { CartLine } from '../domain/cart';
import { db, getDevice, getMeta, setMeta, type LocalSale } from '../db/db';
import { Api, ApiError } from './api';

const MYT_OFFSET_MS = 8 * 3600_000;

/** Start and end (exclusive) of the Malaysian day containing `now`, as ISO strings in UTC. */
export function malaysiaDay(now: Date): { from: string; to: string } {
  const local = now.getTime() + MYT_OFFSET_MS;
  const start = Math.floor(local / 86400_000) * 86400_000 - MYT_OFFSET_MS;
  return { from: new Date(start).toISOString(), to: new Date(start + 86400_000).toISOString() };
}

export async function recordSale(input: {
  shopId: string;
  lines: CartLine[];
  discountSen: number;
  method: PayMethod;
  cashReceivedSen: number | null;
  now?: Date;
  newId?: () => string;
}): Promise<Sale> {
  const device = await getDevice();
  return db.transaction('rw', db.meta, db.sales, async () => {
    const seq = ((await getMeta<number>('saleSeq')) ?? 0) + 1;
    const sale = buildSale({
      id: (input.newId ?? (() => crypto.randomUUID()))(),
      number: receiptNumber(device.tag, seq),
      deviceId: device.id,
      createdAt: (input.now ?? new Date()).toISOString(),
      lines: input.lines,
      discountSen: input.discountSen,
      method: input.method,
      cashReceivedSen: input.cashReceivedSen,
    });
    await setMeta('saleSeq', seq);
    await db.sales.add({ id: sale.id, shopId: input.shopId, createdAt: sale.createdAt, sale, sync: 'pending', syncError: null, sentAt: null });
    return sale;
  });
}

export async function getLocalSale(id: string): Promise<LocalSale | undefined> {
  return db.sales.get(id);
}

export async function salesBetween(shopId: string, from: string, to: string): Promise<LocalSale[]> {
  const rows = await db.sales.where('[shopId+createdAt]').between([shopId, from], [shopId, to], true, false).toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function pendingCount(shopId: string): Promise<number> {
  return db.sales.where('[shopId+sync]').equals([shopId, 'pending']).count();
}

export async function allPendingCount(): Promise<number> {
  return db.sales.where('sync').equals('pending').count();
}

export type SyncOutcome = 'done' | 'offline' | 'signed_out' | 'server_busy';

let running: Promise<SyncOutcome> | null = null;

/** Sends this shop's waiting sales, oldest first. Stops at the first sign the server cannot take them now. */
export function syncSales(shopId: string, now: () => Date = () => new Date()): Promise<SyncOutcome> {
  running ??= (async () => {
    try {
      const pending = (await db.sales.where('[shopId+sync]').equals([shopId, 'pending']).toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const row of pending) {
        try {
          await Api.sendSale(row.sale);
          await db.sales.update(row.id, { sync: 'sent', syncError: null, sentAt: now().toISOString() });
        } catch (e) {
          if (!(e instanceof ApiError)) throw e;
          if (e.offline) return 'offline';
          if (e.status === 401 || e.status === 409) return 'signed_out';
          if (e.status === 400) {
            // The server will never accept this one as it is; keep it on the phone and show it, never drop it.
            await db.sales.update(row.id, { sync: 'rejected', syncError: e.code });
            continue;
          }
          return 'server_busy';
        }
      }
      return 'done';
    } finally {
      running = null;
    }
  })();
  return running;
}
