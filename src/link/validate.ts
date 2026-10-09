/** Small field checks shared by both payload validators. Every failure names its JSON path. */
import type { LinkError } from './types';

export class Invalid extends Error {
  constructor(public readonly error: LinkError) {
    super(error.code + (error.path ? ' at ' + error.path : ''));
  }
}

export const fail = (path: string, detail: string): never => {
  throw new Invalid({ code: 'invalid', path, detail });
};

export const MAX_NAME = 120;
export const MAX_CATEGORY = 60;
export const MAX_ITEMS = 500;

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// Control characters (C0, DEL, C1) are never valid in a name.
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function object(v: unknown, path: string): Record<string, unknown> {
  if (!isObject(v)) fail(path, 'must be an object');
  return v as Record<string, unknown>;
}

export function array(v: unknown, path: string, min: number, max: number): unknown[] {
  if (!Array.isArray(v)) fail(path, 'must be an array');
  const a = v as unknown[];
  if (a.length < min) fail(path, `needs at least ${min} entr${min === 1 ? 'y' : 'ies'}`);
  if (a.length > max) fail(path, `at most ${max} entries`);
  return a;
}

export function id(v: unknown, path: string): string {
  if (typeof v !== 'string' || !ID.test(v)) fail(path, 'must be 1-64 characters of A-Z a-z 0-9 _ -');
  return v as string;
}

export function text(v: unknown, path: string, max: number): string {
  if (typeof v !== 'string') fail(path, 'must be text');
  const t = (v as string).trim().replace(/\s+/g, ' ');
  if (t.length === 0) fail(path, 'must not be blank');
  if (t.length > max) fail(path, `at most ${max} characters`);
  if (CONTROL.test(t)) fail(path, 'contains control characters');
  return t;
}

export function optionalText(v: unknown, path: string, max: number): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return text(v, path, max);
}

export function int(v: unknown, path: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) fail(path, 'must be a whole number');
  const n = v as number;
  if (n < min || n > max) fail(path, `must be between ${min} and ${max}`);
  return n;
}

export function dateTime(v: unknown, path: string): string {
  if (typeof v !== 'string' || !ISO_DATETIME.test(v) || !Number.isFinite(Date.parse(v))) {
    fail(path, 'must be an ISO 8601 date-time with a time zone');
  }
  return v as string;
}

export function date(v: unknown, path: string): string {
  const m = typeof v === 'string' ? ISO_DATE.exec(v) : null;
  if (!m) fail(path, 'must be YYYY-MM-DD');
  const [y, mo, d] = [Number(m![1]), Number(m![2]), Number(m![3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) fail(path, 'is not a real date');
  return v as string;
}

/**
 * Checks app, kind and format in that order, so a payload from the wrong app or a newer
 * app version gets a clear message instead of a field error.
 */
export function header(obj: Record<string, unknown>, app: string, kind: string, supportedFormat: number): void {
  if (obj.app !== app) throw new Invalid({ code: 'wrong_app', path: 'app', detail: `expected ${app}` });
  if (obj.kind !== kind) throw new Invalid({ code: 'wrong_kind', path: 'kind', detail: `expected ${kind}` });
  const f = obj.format;
  if (typeof f !== 'number' || !Number.isInteger(f) || f < 1) fail('format', 'must be a whole number from 1');
  if ((f as number) > supportedFormat) {
    throw new Invalid({ code: 'newer_format', path: 'format', detail: `format ${f} is newer than ${supportedFormat}` });
  }
}
