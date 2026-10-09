/**
 * What receiving an UntungLab price list does to a catalogue (spec/LINK-FORMAT.md §2, "What JualanLab does with it").
 * The preview screen and the server use this same function, so what the user previews is exactly what is saved.
 */
import type { PriceList, PriceListMenu } from '../link/types';
import type { Item } from './items';

export type ChangedField = 'name' | 'category' | 'priceSen' | 'ulPriceSen' | 'marginPct' | 'status' | 'baseUlMenuId' | 'active';

export interface ItemChange {
  before: Item;
  after: Item;
  fields: ChangedField[];
  /** UntungLab sent a new price but the hand-typed counter price was kept. */
  keptOwnPrice: boolean;
}

export interface ImportPlan {
  add: Item[];
  change: ItemChange[];
  same: Item[];
  /** UntungLab items no longer in the list: marked inactive, never deleted (sales refer to them). */
  deactivate: ItemChange[];
}

const FIELDS: ChangedField[] = ['name', 'category', 'priceSen', 'ulPriceSen', 'marginPct', 'status', 'baseUlMenuId', 'active'];

export function planImport(existing: Item[], list: PriceList, opts: { now: string; newId: () => string }): ImportPlan {
  const byUl = new Map(existing.filter((i) => i.source === 'untunglab' && i.ulMenuId).map((i) => [i.ulMenuId as string, i]));
  const seen = new Set<string>();
  const plan: ImportPlan = { add: [], change: [], same: [], deactivate: [] };

  for (const m of list.menus) {
    seen.add(m.id);
    const before = byUl.get(m.id);
    if (!before) {
      plan.add.push(fromMenu(m, opts.newId(), opts.now));
      continue;
    }
    const overridden = before.ulPriceSen !== null && before.priceSen !== before.ulPriceSen;
    const after: Item = {
      ...before,
      name: m.name,
      category: m.category,
      ulPriceSen: m.priceSen,
      priceSen: overridden ? before.priceSen : m.priceSen,
      marginPct: m.marginPct,
      status: m.status,
      baseUlMenuId: m.baseMenuId,
      active: true,
    };
    const fields = FIELDS.filter((f) => before[f] !== after[f]);
    if (fields.length === 0) {
      plan.same.push(before);
    } else {
      plan.change.push({ before, after: { ...after, updatedAt: opts.now }, fields, keptOwnPrice: overridden && fields.includes('ulPriceSen') });
    }
  }

  for (const before of byUl.values()) {
    if (seen.has(before.ulMenuId as string) || !before.active) continue;
    plan.deactivate.push({ before, after: { ...before, active: false, updatedAt: opts.now }, fields: ['active'], keptOwnPrice: false });
  }
  return plan;
}

function fromMenu(m: PriceListMenu, id: string, now: string): Item {
  return {
    id,
    source: 'untunglab',
    ulMenuId: m.id,
    name: m.name,
    category: m.category,
    priceSen: m.priceSen,
    ulPriceSen: m.priceSen,
    marginPct: m.marginPct,
    status: m.status,
    baseUlMenuId: m.baseMenuId,
    active: true,
    updatedAt: now,
  };
}

/** Every item the plan writes, in one list. */
export function planWrites(plan: ImportPlan): Item[] {
  return [...plan.add, ...plan.change.map((c) => c.after), ...plan.deactivate.map((c) => c.after)];
}

export function planIsEmpty(plan: ImportPlan): boolean {
  return plan.add.length === 0 && plan.change.length === 0 && plan.deactivate.length === 0;
}
