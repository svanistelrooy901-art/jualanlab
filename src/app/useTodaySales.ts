import { useLiveQuery } from 'dexie-react-hooks';
import type { LocalSale } from '../db/db';
import { malaysiaDay, salesBetween } from './sales';

/** Today's sales on this phone, live (updates when a sale is added or sent). */
export function useTodaySales(shopId: string): LocalSale[] | undefined {
  return useLiveQuery(() => {
    const { from, to } = malaysiaDay(new Date());
    return salesBetween(shopId, from, to);
  }, [shopId]);
}
