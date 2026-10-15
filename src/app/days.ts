/**
 * Business days on the phone (DECISIONS T-07). A day is opened and closed by hand for the whole shop and may run
 * past midnight. Opening works without internet: the day is kept here and sent before any of its sales. The
 * server keeps one open day per shop; when two phones opened offline, it joins them and this phone follows.
 */
import { db, getDevice, type LocalDay } from '../db/db';
import type { BizDay } from '../domain/bizday';
import { Api, ApiError } from './api';

export class NoOpenDay extends Error {
  constructor() {
    super('no open day');
  }
}

/** The shop's open day as this phone knows it, or null. */
export async function currentDay(shopId: string): Promise<LocalDay | null> {
  const rows = await db.days.where('[shopId+openedAt]').between([shopId, ''], [shopId, '￿']).reverse().toArray();
  return rows.find((d) => d.closedAt === null) ?? null;
}

/** Days this phone knows, newest first. */
export async function knownDays(shopId: string): Promise<LocalDay[]> {
  return db.days.where('[shopId+openedAt]').between([shopId, ''], [shopId, '￿']).reverse().toArray();
}

/** Opens a day here (or returns the one already open). Sent to the server on the next sync. */
export async function openDayHere(shopId: string, floatSen: number, now: Date = new Date(), newId: () => string = () => crypto.randomUUID()): Promise<LocalDay> {
  return db.transaction('rw', db.days, async () => {
    const open = await currentDay(shopId);
    if (open) return open;
    const latest = (await knownDays(shopId))[0] ?? null;
    const day: LocalDay = {
      id: newId().replace(/[^A-Za-z0-9_-]/g, ''), shopId, openedAt: now.toISOString(), closedAt: null, floatSen: Math.max(0, Math.round(floatSen)),
      counted: false, sync: 'pending', lastSeenDayId: latest?.id ?? null,
    };
    await db.days.add(day);
    return day;
  });
}

/** Stores a day the server reported; a day joined into another is replaced by that one, sales and all. */
export async function applyServerDay(shopId: string, day: BizDay, localId: string = day.id): Promise<void> {
  await db.transaction('rw', db.days, db.sales, async () => {
    if (localId !== day.id) {
      await db.days.delete(localId);
      await moveLocalSales(shopId, localId, day.id);
    }
    const prev = await db.days.get(day.id);
    await db.days.put({ ...day, shopId, sync: 'sent', lastSeenDayId: prev?.lastSeenDayId ?? null });
  });
}

async function moveLocalSales(shopId: string, from: string, to: string): Promise<void> {
  await db.sales
    .where('[shopId+dayId]')
    .equals([shopId, from])
    .modify((r) => {
      r.dayId = to;
      r.sale = { ...r.sale, dayId: to };
    });
}

/** The server put a sale in another day (the phone's day was joined to it): follow it. */
export async function followSaleDay(saleId: string, dayId: string): Promise<void> {
  await db.sales
    .where('id')
    .equals(saleId)
    .modify((r) => {
      if (r.dayId === dayId) return;
      r.dayId = dayId;
      r.sale = { ...r.sale, dayId };
    });
}

/** Sends days opened here. Returns an ApiError that should stop the sync, or null. */
export async function sendDays(shopId: string): Promise<ApiError | null> {
  const pending = (await db.days.where('shopId').equals(shopId).filter((d) => d.sync === 'pending').toArray()).sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  const device = await getDevice();
  for (const d of pending) {
    try {
      const r = await Api.openDay({ id: d.id, openedAt: d.openedAt, floatSen: d.floatSen, deviceId: device.id, lastSeenDayId: d.lastSeenDayId });
      await applyServerDay(shopId, r.day, d.id);
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      if (e.offline || e.status === 401 || e.status === 409 || e.status >= 500) return e;
      // Refused for good (should not happen): keep it, so its sales stay on the phone and visible.
    }
  }
  return null;
}

/**
 * Brings this phone's days up to date: every recent day from the server, and a day this phone thought was open
 * that the server has closed (on another phone) or joined to another.
 */
export async function pullDays(shopId: string): Promise<void> {
  const r = await Api.days();
  for (const d of r.days) await applyServerDay(shopId, d);
  const listed = new Set(r.days.map((d) => d.id));
  const stale = await db.days.where('shopId').equals(shopId).filter((d) => d.sync === 'sent' && d.closedAt === null && !listed.has(d.id)).toArray();
  for (const d of stale) {
    try {
      const one = await Api.day(d.id);
      await applyServerDay(shopId, one.day, d.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) await db.days.delete(d.id);
      else throw e;
    }
  }
}

/** Opening needs no internet. When online, a day already opened on another phone is used instead of a new one. */
export async function openDay(shopId: string, floatSen: number): Promise<{ day: LocalDay; alreadyOpen: boolean }> {
  try {
    await pullDays(shopId);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }
  const open = await currentDay(shopId);
  if (open) return { day: open, alreadyOpen: true };
  return { day: await openDayHere(shopId, floatSen), alreadyOpen: false };
}
