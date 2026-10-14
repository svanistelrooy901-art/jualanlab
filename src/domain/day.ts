/** Business days in Malaysia time (UTC+8, no daylight saving). A day key is "YYYY-MM-DD". */
const MYT_MS = 8 * 3600_000;
const DAY_MS = 86400_000;
const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dayKey(at: Date): string {
  return new Date(at.getTime() + MYT_MS).toISOString().slice(0, 10);
}

export function isDayKey(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = KEY.exec(s);
  if (!m) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Start and end (exclusive) of the day as UTC ISO strings. */
export function dayRange(key: string): { from: string; to: string } {
  if (!isDayKey(key)) throw new Error('bad day key');
  const start = Date.parse(`${key}T00:00:00Z`) - MYT_MS;
  return { from: new Date(start).toISOString(), to: new Date(start + DAY_MS).toISOString() };
}

export function addDays(key: string, n: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}
