/**
 * What an account can buy and for how much (DECISIONS A-06): one app, both apps together, or the second app at the
 * owner price. Worked out here, on the server, never by the page.
 */
import type { HubConfig, Item, PriceKind, Product } from './ports';

export interface Offer {
  item: Item;
  products: Product[];
  amountSen: number;
  kind: PriceKind;
  /** Price without any reduction, to show what was saved. */
  fullSen: number;
}

export type OfferRefusal = 'owned' | 'owns_one' | 'not_on_sale';

export const ITEMS: readonly Item[] = ['untunglab', 'jualanlab', 'combo'];

export function productsOf(item: Item): Product[] {
  return item === 'combo' ? ['untunglab', 'jualanlab'] : [item];
}

export function offerFor(item: Item, owned: ReadonlySet<Product>, earlyUsed: Record<Product, number>, cfg: Pick<HubConfig, 'prices' | 'onSale'>): Offer | OfferRefusal {
  const products = productsOf(item);
  // Before JualanLab's launch, an UntungLab owner may take JualanLab at the owner price as early access, like the combo.
  const earlyAccess = item === 'jualanlab' && owned.has('untunglab') && cfg.onSale.combo;
  if (!cfg.onSale[item] && !earlyAccess) return 'not_on_sale';
  if (products.every((p) => owned.has(p))) return 'owned';
  const full = (p: Product) => cfg.prices[p].normalSen;
  if (item === 'combo') {
    // Owning one already: buy the other at the owner price instead (cheaper than the combo).
    if (products.some((p) => owned.has(p))) return 'owns_one';
    return { item, products, amountSen: cfg.prices.comboSen, kind: 'combo', fullSen: full('untunglab') + full('jualanlab') };
  }
  const p = item;
  const other: Product = p === 'untunglab' ? 'jualanlab' : 'untunglab';
  if (owned.has(other)) return { item, products, amountSen: cfg.prices.secondAppSen, kind: 'second', fullSen: full(p) };
  const price = cfg.prices[p];
  if (earlyUsed[p] < price.earlySlots) return { item, products, amountSen: price.earlySen, kind: 'early', fullSen: full(p) };
  return { item, products, amountSen: price.normalSen, kind: 'normal', fullSen: full(p) };
}
