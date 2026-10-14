/**
 * Sales on this phone: saved here first (the sale is never lost to a bad connection), then sent to the server.
 * The server de-duplicates by sale id, so sending twice is safe. Voids travel the same way: a sale not sent yet
 * goes out already voided; a sale already on the server gets a separate void request.
 */
import { buildSale, receiptNumber, voidSale, type PayMethod, type Sale } from '../domain/sale';
import type { CartLine } from '../domain/cart';
import { dayKey, dayRange } from '../domain/day';
import { db, getDevice, getMeta, setMeta, type LocalSale } from '../db/db';
import { Api, ApiError } from './api';

/** Start and end (exclusive) of the Malaysian day containing `now`, as ISO strings in UTC. */
export function malaysiaDay(now: Date): { from: string; to: string } {
  return dayRange(dayKey(now));
}

export async function recordSale(input: {
  shopId: string;
  lines: CartLine[];
  discountSen: number;
  method: PayMethod;
  cashReceivedSen: number | null;
  channel?: Sale['channel'];
  now?: Date;
  newId?: () => string;
}): Promise<Sale> {
  const device = await getDevice();
  const sale = await db.transaction('rw', db.meta, db.sales, async () => {
    const seq = ((await getMeta<number>('saleSeq')) ?? 0) + 1;
    const s = buildSale({
      id: (input.newId ?? (() => crypto.randomUUID()))(),
      number: receiptNumber(device.tag, seq),
      deviceId: device.id,
      createdAt: (input.now ?? new Date()).toISOString(),
      channel: input.channel ?? 'counter',
      lines: input.lines,
      discountSen: input.discountSen,
      method: input.method,
      cashReceivedSen: input.cashReceivedSen,
    });
    await setMeta('saleSeq', seq);
    await db.sales.add({ id: s.id, shopId: input.shopId, createdAt: s.createdAt, sale: s, sync: 'pending', syncError: null, sentAt: null, voidPending: false });
    return s;
  });
  void askToKeepData();
  return sale;
}

/**
 * Asks the browser not to clear this site's storage when the phone runs low on space, so unsent sales survive.
 * Browsers decide silently (installed apps are usually granted); asked once.
 */
export async function askToKeepData(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    if (await getMeta<boolean>('persistAsked')) return false;
    await setMeta('persistAsked', true);
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function getLocalSale(id: string): Promise<LocalSale | undefined> {
  return db.sales.get(id);
}

export async function salesBetween(shopId: string, from: string, to: string): Promise<LocalSale[]> {
  const rows = await db.sales.where('[shopId+createdAt]').between([shopId, from], [shopId, to], true, false).toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Sales or voids of this shop not yet on the server. */
export async function pendingCount(shopId: string): Promise<number> {
  const unsent = await db.sales.where('[shopId+sync]').equals([shopId, 'pending']).count();
  const voids = await db.sales.where('[shopId+sync]').equals([shopId, 'sent']).filter((r) => r.voidPending === true).count();
  return unsent + voids;
}

/** For every shop on this phone: how many are waiting, and since when. */
export async function waitingSummary(): Promise<{ count: number; oldest: string | null }> {
  const rows = await db.sales.filter((r) => r.sync === 'pending' || r.voidPending === true).toArray();
  const oldest = rows.reduce<string | null>((o, r) => (o === null || r.createdAt < o ? r.createdAt : o), null);
  return { count: rows.length, oldest };
}

export async function allPendingCount(): Promise<number> {
  return (await waitingSummary()).count;
}

/** Voids a sale made on this phone. Works offline; the server hears about it on the next send. */
export async function voidLocalSale(id: string, reason: string, now: Date = new Date()): Promise<LocalSale> {
  return db.transaction('rw', db.sales, async () => {
    const row = await db.sales.get(id);
    if (!row) throw new Error('not on this phone');
    if (row.sale.status === 'void') return row;
    const sale = voidSale(row.sale, reason, now.toISOString());
    // Not on the server yet: it goes out voided. Already there: a separate void request follows.
    const next: LocalSale = row.sync === 'sent' ? { ...row, sale, voidPending: true } : { ...row, sale, sync: 'pending', syncError: null };
    await db.sales.put(next);
    return next;
  });
}

/** Puts a sale the server refused back in the queue (for example after an update fixed the cause). */
export async function retrySale(id: string): Promise<void> {
  await db.sales.update(id, { sync: 'pending', syncError: null });
}

export type SyncOutcome = 'done' | 'offline' | 'signed_out' | 'server_busy';

let running: Promise<SyncOutcome> | null = null;

/**
 * Sends this shop's waiting sales (oldest first), then waiting voids. Stops at the first sign the server cannot
 * take them now. Only one tab sends at a time (Web Locks where available; the server de-duplicates anyway).
 */
export function syncSales(shopId: string, now: () => Date = () => new Date()): Promise<SyncOutcome> {
  running ??= (async () => {
    try {
      const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
      if (locks?.request) return await locks.request('jl-sync', () => sendAll(shopId, now));
      return await sendAll(shopId, now);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function sendAll(shopId: string, now: () => Date): Promise<SyncOutcome> {
  const pending = (await db.sales.where('[shopId+sync]').equals([shopId, 'pending']).toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const row of pending) {
    try {
      await Api.sendSale(row.sale);
      await db.sales.update(row.id, { sync: 'sent', syncError: null, sentAt: now().toISOString(), voidPending: false });
    } catch (e) {
      const stop = handle(e);
      if (stop) return stop;
      // The server will never accept this one as it is; keep it on the phone and show it, never drop it.
      await db.sales.update(row.id, { sync: 'rejected', syncError: (e as ApiError).code });
    }
  }
  const voids = await db.sales.where('[shopId+sync]').equals([shopId, 'sent']).filter((r) => r.voidPending === true).toArray();
  for (const row of voids) {
    try {
      await Api.voidSale(row.id, row.sale.voidReason ?? '', row.sale.voidedAt);
      await db.sales.update(row.id, { voidPending: false });
    } catch (e) {
      const stop = handle(e);
      if (stop) return stop;
      await db.sales.update(row.id, { voidPending: false, syncError: `void:${(e as ApiError).code}` });
    }
  }
  await setMeta(`lastSync:${shopId}`, now().toISOString());
  return 'done';
}

/** A reason to stop sending now, or null when only this one item failed for good (a 4xx the server will repeat). */
function handle(e: unknown): Exclude<SyncOutcome, 'done'> | null {
  if (!(e instanceof ApiError)) throw e;
  if (e.offline) return 'offline';
  if (e.status === 401 || e.status === 409) return 'signed_out';
  if (e.status === 400 || e.status === 404) return null;
  return 'server_busy';
}

export async function lastSyncAt(shopId: string): Promise<string | null> {
  return (await getMeta<string>(`lastSync:${shopId}`)) ?? null;
}
