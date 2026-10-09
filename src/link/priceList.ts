/** Price list v1: UntungLab -> JualanLab. Spec: spec/LINK-FORMAT.md, section "Price list". */
import { encodePayload, decodePayload } from './envelope';
import type { DecodeResult, LinkWarning, MenuStatus, PriceList, PriceListMenu } from './types';
import { MENU_STATUSES } from './types';
import * as v from './validate';

export const PRICE_LIST_FORMAT = 1;
export const MAX_PRICE_SEN = 10_000_000; // RM100,000.00

function status(x: unknown, path: string): MenuStatus | null {
  if (x === null || x === undefined) return null;
  if (typeof x !== 'string' || !(MENU_STATUSES as readonly string[]).includes(x)) {
    v.fail(path, 'must be loss, low, watch, healthy or null');
  }
  return x as MenuStatus;
}

function margin(x: unknown, path: string): number | null {
  if (x === null || x === undefined) return null;
  if (typeof x !== 'number' || !Number.isFinite(x)) v.fail(path, 'must be a number or null');
  if ((x as number) > 100) v.fail(path, 'cannot be above 100');
  return x as number;
}

/** Checks a decoded JSON value and returns a clean copy (trimmed text, unknown fields dropped). */
export function validatePriceList(json: unknown): DecodeResult<PriceList> {
  try {
    const o = v.object(json, '');
    v.header(o, 'untunglab', 'price-list', PRICE_LIST_FORMAT);
    const sentAt = v.dateTime(o.sentAt, 'sentAt');
    if (o.currency !== 'MYR') v.fail('currency', 'must be MYR');
    const raw = v.array(o.menus, 'menus', 1, v.MAX_ITEMS);

    const seen = new Set<string>();
    const menus: PriceListMenu[] = raw.map((m, i) => {
      const p = `menus[${i}]`;
      const r = v.object(m, p);
      const menuId = v.id(r.id, `${p}.id`);
      if (seen.has(menuId)) v.fail(`${p}.id`, 'appears twice');
      seen.add(menuId);
      const priceSen = v.int(r.priceSen, `${p}.priceSen`, 0, MAX_PRICE_SEN);
      const marginPct = margin(r.marginPct, `${p}.marginPct`);
      const st = status(r.status, `${p}.status`);
      if ((marginPct === null) !== (st === null)) v.fail(`${p}.status`, 'must be null exactly when marginPct is null');
      if (priceSen === 0 && marginPct !== null) v.fail(`${p}.marginPct`, 'must be null when the price is 0');
      const base = r.baseMenuId === null || r.baseMenuId === undefined ? null : v.id(r.baseMenuId, `${p}.baseMenuId`);
      if (base === menuId) v.fail(`${p}.baseMenuId`, 'cannot point to itself');
      return {
        id: menuId,
        name: v.text(r.name, `${p}.name`, v.MAX_NAME),
        category: v.optionalText(r.category, `${p}.category`, v.MAX_CATEGORY),
        priceSen,
        marginPct,
        status: st,
        baseMenuId: base,
      };
    });

    const warnings: LinkWarning[] = [];
    const byId = new Map(menus.map((m) => [m.id, m]));
    menus.forEach((m, i) => {
      if (m.baseMenuId === null) return;
      const base = byId.get(m.baseMenuId);
      if (!base) {
        warnings.push({ code: 'base_missing', path: `menus[${i}].baseMenuId` });
      } else if (base.baseMenuId !== null) {
        v.fail(`menus[${i}].baseMenuId`, 'a variation cannot have a variation as its base');
      }
    });

    return { ok: true, value: { app: 'untunglab', kind: 'price-list', format: 1, sentAt, currency: 'MYR', menus }, warnings };
  } catch (e) {
    if (e instanceof v.Invalid) return { ok: false, error: e.error };
    throw e;
  }
}

export function encodePriceList(list: PriceList): string {
  const checked = validatePriceList(list);
  if (!checked.ok) throw new Error(`refusing to send an invalid price list: ${checked.error.path ?? ''} ${checked.error.detail ?? checked.error.code}`);
  return encodePayload(checked.value);
}

export function decodePriceList(payload: string): DecodeResult<PriceList> {
  const d = decodePayload(payload);
  return d.ok ? validatePriceList(d.json) : d;
}

/** UntungLab stores the selling price in ringgit; the format carries sen. */
export function ringgitToSen(rm: number): number {
  return Math.round(rm * 100 + Number.EPSILON * Math.sign(rm));
}

/** Margin as sent: rounded to 2 decimals, null stays null. */
export function roundMargin(pct: number | null): number | null {
  return pct === null ? null : Math.round(pct * 100) / 100;
}
