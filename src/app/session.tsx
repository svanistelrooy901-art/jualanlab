/**
 * Who is signed in, their shop, the cached catalogue and the sales waiting to be sent.
 * Opens from the phone's copy first (works with no internet), then checks with the server.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Item } from '../domain/items';
import { DEFAULT_PRESETS, type Promo } from '../domain/promo';
import { cacheMe, cachedMe, cachedPromos, cachePromos, listItems, putItem, replaceItems } from '../db/db';
import { Api, ApiError, type KedaiSummary, type Me } from './api';
import { clearCart } from './cart';
import { syncSales, waitingSummary } from './sales';

export type SessionStatus = 'loading' | 'signedOut' | 'needsShop' | 'ready';

interface Session {
  status: SessionStatus;
  me: Me | null;
  items: Item[];
  /** Promotions and the three quick discount buttons (Diskaun & Promosi), from the phone's copy until the server answers. */
  promos: Promo[];
  presets: number[];
  /** The online store, for the bottom bar's Pesanan tab and its count; null until known. */
  kedai: KedaiSummary | null;
  refreshKedai(): Promise<void>;
  online: boolean;
  /** Sales (or voids) on this phone not yet on the server (all shops). */
  pending: number;
  /** When the oldest waiting sale was made; the banner gets firmer after 24 hours. */
  oldestPending: string | null;
  /** Goes up after every send, so screens showing server data can refresh. */
  syncTick: number;
  signedIn(me: Me): Promise<void>;
  signOut(): Promise<void>;
  refreshItems(): Promise<void>;
  setItems(items: Item[]): Promise<void>;
  saveItem(item: Item): Promise<void>;
  /** After a change made on this phone and accepted by the server. */
  setPromos(promos: Promo[], presets?: number[]): Promise<void>;
  setLastImport(me: Me['lastImport']): Promise<void>;
  syncNow(): Promise<void>;
  /** Called after a sale is recorded on the phone. */
  saleRecorded(): void;
}

const Ctx = createContext<Session | null>(null);

const SYNC_EVERY_MS = 30_000;
const PROMOS_EVERY_MS = 5 * 60_000;

function statusFor(me: Me | null): SessionStatus {
  if (!me) return 'signedOut';
  return me.shop ? 'ready' : 'needsShop';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [items, setItemsState] = useState<Item[]>([]);
  const [promos, setPromosState] = useState<Promo[]>([]);
  const [presets, setPresetsState] = useState<number[]>([...DEFAULT_PRESETS]);
  const [kedai, setKedai] = useState<KedaiSummary | null>(null);
  const refreshKedai = useCallback(async () => {
    if (!meRef.current?.shop) return;
    try {
      setKedai(await Api.kedaiSummary());
    } catch {
      /* keep what we had */
    }
  }, []);
  const presetsRef = useRef(presets);
  presetsRef.current = presets;
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [pending, setPending] = useState(0);
  const [oldestPending, setOldestPending] = useState<string | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  const meRef = useRef<Me | null>(null);
  meRef.current = me;

  const updatePending = useCallback(async () => {
    const w = await waitingSummary();
    setPending(w.count);
    setOldestPending(w.oldest);
  }, []);

  const apply = useCallback(async (next: Me | null) => {
    await cacheMe(next);
    setMe(next);
    setStatus(statusFor(next));
    setItemsState(next?.shop ? await listItems(next.shop.id) : []);
    const cachedP = next?.shop ? await cachedPromos(next.shop.id) : undefined;
    setPromosState(cachedP?.promos ?? []);
    setPresetsState(cachedP?.presets ?? [...DEFAULT_PRESETS]);
  }, []);

  const handleSignedOut = useCallback(async () => {
    // Sales stay on the phone; they are sent after the owner of that shop signs in again.
    await apply(null);
  }, [apply]);

  // Promotions changed on another phone reach this one when it opens, comes back to the front, or every 5 minutes.
  const promosFetchedAt = useRef(0);
  const refreshPromos = useCallback(async () => {
    const shop = meRef.current?.shop;
    if (!shop) return;
    promosFetchedAt.current = Date.now();
    try {
      const p = await Api.promos();
      if (meRef.current?.shop?.id !== shop.id) return;
      await cachePromos(shop.id, p);
      setPromosState(p.promos);
      setPresetsState(p.presets);
    } catch {
      /* keep the phone's copy */
    }
    await refreshKedai();
  }, [refreshKedai]);

  const refreshItems = useCallback(async () => {
    const shop = meRef.current?.shop;
    if (!shop) return;
    try {
      const r = await Api.items();
      await replaceItems(shop.id, r.items);
      setItemsState(r.items);
      setOnline(true);
      await refreshPromos();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await handleSignedOut();
      else if (e instanceof ApiError && e.offline) setOnline(false);
    }
  }, [handleSignedOut, refreshPromos]);

  const syncNow = useCallback(async () => {
    const shop = meRef.current?.shop;
    if (shop) {
      const outcome = await syncSales(shop.id);
      if (outcome === 'offline') setOnline(false);
      else if (outcome === 'done') setOnline(true);
      else if (outcome === 'signed_out') {
        // Check before acting: a 409 or 401 on a sale means the session or shop changed.
        try {
          await apply(await Api.me());
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) await handleSignedOut();
        }
      }
    }
    await updatePending();
    setSyncTick((n) => n + 1);
    if (shop && Date.now() - promosFetchedAt.current > PROMOS_EVERY_MS) await refreshPromos();
  }, [apply, handleSignedOut, updatePending, refreshPromos]);

  // Start: the phone's copy first, then the server.
  useEffect(() => {
    let stop = false;
    void (async () => {
      const cached = (await cachedMe()) ?? null;
      if (stop) return;
      if (cached) await apply(cached);
      await updatePending();
      try {
        const fresh = await Api.me();
        if (stop) return;
        await apply(fresh);
        setOnline(true);
        await refreshItems();
        await syncNow();
      } catch (e) {
        if (stop) return;
        if (e instanceof ApiError && e.status === 401) await handleSignedOut();
        else {
          if (e instanceof ApiError && e.offline) setOnline(false);
          if (!cached) setStatus('signedOut');
        }
      }
    })();
    return () => {
      stop = true;
    };
  }, []);

  // Keep sending: on reconnect, when the app comes back to the front, and every 30 seconds.
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const goOffline = () => setOnline(false);
    const visible = () => {
      if (document.visibilityState === 'visible') {
        promosFetchedAt.current = 0;
        void syncNow();
      }
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    document.addEventListener('visibilitychange', visible);
    const t = window.setInterval(() => void syncNow(), SYNC_EVERY_MS);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', visible);
      window.clearInterval(t);
    };
  }, [syncNow]);

  const value = useMemo<Session>(
    () => ({
      status,
      me,
      items,
      promos,
      presets,
      kedai,
      refreshKedai,
      online,
      pending,
      oldestPending,
      syncTick,
      async signedIn(next) {
        await apply(next);
        setOnline(true);
        if (next.shop) {
          await refreshItems();
          await syncNow();
        }
      },
      async signOut() {
        try {
          await Api.logout();
        } catch {
          /* signed out locally either way */
        }
        clearCart();
        await apply(null);
      },
      refreshItems,
      async setItems(next) {
        const shop = meRef.current?.shop;
        if (!shop) return;
        await replaceItems(shop.id, next);
        setItemsState(next);
      },
      async saveItem(item) {
        const shop = meRef.current?.shop;
        if (!shop) return;
        await putItem(shop.id, item);
        setItemsState((prev) => (prev.some((i) => i.id === item.id) ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item]));
      },
      async setPromos(nextPromos, nextPresets) {
        const shop = meRef.current?.shop;
        if (!shop) return;
        const p = { promos: nextPromos, presets: nextPresets ?? presetsRef.current };
        await cachePromos(shop.id, p);
        setPromosState(p.promos);
        setPresetsState(p.presets);
      },
      async setLastImport(lastImport) {
        const cur = meRef.current;
        if (!cur) return;
        const next = { ...cur, lastImport };
        await cacheMe(next);
        setMe(next);
      },
      syncNow,
      saleRecorded() {
        void updatePending().then(() => syncNow());
      },
    }),
    [status, me, items, promos, presets, kedai, refreshKedai, online, pending, oldestPending, syncTick, apply, refreshItems, syncNow, updatePending],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}

/** For pages that only render with a shop (the router guarantees it). */
export function useShop() {
  const s = useSession();
  if (!s.me?.shop) throw new Error('no shop');
  return { ...s, shop: s.me.shop, me: s.me };
}
