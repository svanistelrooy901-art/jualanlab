/** An online order becomes a sale once paid, so it counts in Jualan, Profit Today and Close Day (K-01 plan). */
import type { Order } from '../../src/domain/kedai';
import type { PayMethod, Sale, SaleLine } from '../../src/domain/sale';

/** Item id of the delivery-fee line: takings, but no margin, so it stays out of profit (as items without a cost). */
export const DELIVERY_ITEM_ID = 'kedai-delivery';

export function orderToSale(o: Order, p: { id: string; method: PayMethod; at: string }): Sale {
  const lines: SaleLine[] = o.lines.map((l) => ({
    itemId: l.itemId, name: l.name, unitPriceSen: l.unitPriceSen, quantity: l.quantity, marginPct: l.marginPct, note: l.note,
    unitCostSen: l.unitCostSen ?? null, listPriceSen: l.listPriceSen ?? null, discountPct: l.discountPct ?? null, promoId: l.promoId ?? null, promoName: l.promoName ?? null,
  }));
  if (o.deliverySen > 0) {
    lines.push({ itemId: DELIVERY_ITEM_ID, name: o.area ? `Penghantaran (${o.area})` : 'Penghantaran', unitPriceSen: o.deliverySen, quantity: 1, marginPct: null, note: '', unitCostSen: null, listPriceSen: null, discountPct: null, promoId: null, promoName: null });
  }
  return {
    id: p.id, number: o.number, deviceId: 'kedai', createdAt: p.at, channel: 'online', lines,
    subtotalSen: o.totalSen, discountSen: 0, totalSen: o.totalSen, method: p.method,
    cashReceivedSen: p.method === 'cash' ? o.totalSen : null, changeSen: p.method === 'cash' ? 0 : null,
    status: 'done', voidReason: null, voidedAt: null, dayId: null,
  };
}
