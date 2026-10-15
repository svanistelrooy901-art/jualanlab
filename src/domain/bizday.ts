/**
 * Business days (DECISIONS T-07). A day is opened and closed by hand, for the whole shop, and may run past
 * midnight. Every sale carries the id of the day that was open on the phone that made it.
 */
import { dayKey } from './day';

export interface BizDay {
  id: string;
  openedAt: string;
  /** Null while the day is open. */
  closedAt: string | null;
  /** Cash put in the drawer at opening (can be corrected when closing). */
  floatSen: number;
  /** True once the cash has been counted at least once (a close record exists). */
  counted: boolean;
}

/** After this long open, the app asks whether the seller forgot to close. Nothing closes by itself. */
export const LONG_OPEN_HOURS = 20;

export const DAY_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function isDayId(v: unknown): v is string {
  return typeof v === 'string' && DAY_ID.test(v);
}

/** Malaysian calendar date the day was opened on, "YYYY-MM-DD" (for names and CSV file names). */
export function openedDate(d: Pick<BizDay, 'openedAt'>): string {
  return dayKey(new Date(d.openedAt));
}

export function openTooLong(d: Pick<BizDay, 'openedAt' | 'closedAt'>, now: Date): boolean {
  return d.closedAt === null && now.getTime() - Date.parse(d.openedAt) >= LONG_OPEN_HOURS * 3600_000;
}

/** True when the day ends (or, still open, has reached) a later Malaysian date than it started on. */
export function crossesMidnight(d: Pick<BizDay, 'openedAt' | 'closedAt'>, now: Date): boolean {
  return dayKey(d.closedAt ? new Date(d.closedAt) : now) !== openedDate(d);
}
