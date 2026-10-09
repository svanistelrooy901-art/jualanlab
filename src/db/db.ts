/**
 * What lives on the phone: the catalogue (so the counter works without internet), every sale made here
 * (saved here first, then sent to the server), and a few settings. The server stays the source of truth for
 * the catalogue; the phone is the source of truth for a sale until the server has it.
 */
import Dexie, { type Table } from 'dexie';
import type { Item } from '../domain/items';
import type { Sale } from '../domain/sale';
import type { Me } from '../app/api';

export type SyncState = 'pending' | 'sent' | 'rejected';

export interface LocalSale {
  id: string;
  shopId: string;
  createdAt: string;
  sale: Sale;
  sync: SyncState;
  /** Server error code when the server refused the sale (sync = 'rejected'). Kept, never deleted. */
  syncError: string | null;
  sentAt: string | null;
}

export interface LocalItem extends Item {
  shopId: string;
}

interface Meta {
  key: string;
  value: unknown;
}

export class JualanDb extends Dexie {
  items!: Table<LocalItem, string>;
  sales!: Table<LocalSale, string>;
  meta!: Table<Meta, string>;

  constructor(name = 'jualanlab') {
    super(name);
    this.version(1).stores({
      items: 'id, shopId',
      sales: 'id, createdAt, sync, [shopId+sync], [shopId+createdAt]',
      meta: 'key',
    });
  }
}

export let db = new JualanDb();

/** Tests use a fresh database each time. */
export function useDatabase(next: JualanDb): void {
  db = next;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function deleteMeta(key: string): Promise<void> {
  await db.meta.delete(key);
}

// ---- session cache (so the app opens signed in without internet) ----

export const cachedMe = () => getMeta<Me>('me');
export const cacheMe = (me: Me | null) => (me ? setMeta('me', me) : deleteMeta('me'));

// ---- catalogue cache ----

export async function replaceItems(shopId: string, items: Item[]): Promise<void> {
  await db.transaction('rw', db.items, async () => {
    await db.items.where('shopId').equals(shopId).delete();
    await db.items.bulkPut(items.map((i) => ({ ...i, shopId })));
  });
}

export async function putItem(shopId: string, item: Item): Promise<void> {
  await db.items.put({ ...item, shopId });
}

export async function listItems(shopId: string): Promise<Item[]> {
  const rows = await db.items.where('shopId').equals(shopId).toArray();
  return rows.map(({ shopId: _s, ...i }) => i);
}

// ---- this phone ----

const TAG_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface Device {
  id: string;
  /** Two characters at the start of receipt numbers, so two phones never print the same number. */
  tag: string;
}

export async function getDevice(random: () => number = Math.random, newId: () => string = () => crypto.randomUUID()): Promise<Device> {
  return db.transaction('rw', db.meta, async () => {
    const d = await getMeta<Device>('device');
    if (d) return d;
    const tag = Array.from({ length: 2 }, () => TAG_CHARS[Math.floor(random() * TAG_CHARS.length)]).join('');
    const created = { id: newId().replace(/[^A-Za-z0-9_-]/g, ''), tag };
    await setMeta('device', created);
    return created;
  });
}
