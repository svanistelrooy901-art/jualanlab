/**
 * One business day as the seller should see it: every phone's sales from the server when online, plus this phone's
 * sales and voids the server has not heard about yet. Offline, this phone's sales only (and the screen says so).
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import { dayRange } from '../domain/day';
import type { Sale } from '../domain/sale';
import type { LocalSale } from '../db/db';
import { Api, ApiError, type DayClose } from './api';
import { salesBetween } from './sales';
import { useSession } from './session';

export interface DaySale {
  sale: Sale;
  /** This phone's copy, when the sale was made here (sync state, waiting void). */
  local: LocalSale | null;
}

export interface DayView {
  sales: DaySale[];
  closes: DayClose[];
  /** 'server': all phones. 'phone': this phone only (offline, or not loaded yet). */
  source: 'server' | 'phone';
  loading: boolean;
  /** This phone has sales or voids for this day the server does not have yet. */
  waitingHere: number;
  refresh: () => Promise<void>;
}

export function mergeDay(server: Sale[] | null, local: LocalSale[]): DaySale[] {
  const byId = new Map<string, DaySale>();
  for (const s of server ?? []) byId.set(s.id, { sale: s, local: null });
  for (const l of local) {
    const onServer = byId.get(l.id);
    // The phone's copy wins while it has news the server lacks (a sale not sent, or a void not sent).
    const phoneNewer = l.sync !== 'sent' || l.voidPending === true || !onServer;
    byId.set(l.id, { sale: phoneNewer ? l.sale : onServer!.sale, local: l });
  }
  return [...byId.values()].sort((a, b) => b.sale.createdAt.localeCompare(a.sale.createdAt));
}

export function useDay(shopId: string, day: string): DayView {
  const { online, syncTick } = useSession();
  const local = useLiveQuery(() => {
    const { from, to } = dayRange(day);
    return salesBetween(shopId, from, to);
  }, [shopId, day]);
  const [server, setServer] = useState<{ day: string; sales: Sale[]; closes: DayClose[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await Api.day(day);
      setServer({ day, sales: r.sales, closes: r.closes });
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      // Offline or signed out: keep showing what we have.
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    if (online) void refresh();
  }, [online, syncTick, refresh]);

  const current = server && server.day === day ? server : null;
  const rows = local ?? [];
  return {
    sales: mergeDay(current?.sales ?? null, rows),
    closes: current?.closes ?? [],
    source: current ? 'server' : 'phone',
    loading: loading || local === undefined,
    waitingHere: rows.filter((r) => r.sync === 'pending' || r.voidPending === true).length,
    refresh,
  };
}
