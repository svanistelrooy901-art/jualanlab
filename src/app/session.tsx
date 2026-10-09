/**
 * Who is signed in, their shop, the cached catalogue and the sales waiting to be sent.
 * Opens from the phone's copy first (works with no internet), then checks with the server.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Item } from '../domain/items';
import { cacheMe, cachedMe, listItems, putItem, replaceItems } from '../db/db';
import { Api, ApiError, type Me } from './api';
import { clearCart } from './cart';
import { allPendingCount, syncSales } from './sales';

export type SessionStatus = 'loading' | 'signedOut' | 'needsShop' | 'ready';

interface Session {
  status: SessionStatus;
  me: Me | null;
  items: Item[];
  online: boolean;
  /** Sales on this phone not yet on the server (all shops). */
  pending: number;
  signedIn(me: Me): Promise<void>;
  signOut(): Promise<void>;
  refreshItems(): Promise<void>;
  setItems(items: Item[]): Promise<void>;
  saveItem(item: Item): Promise<void>;
  setLastImport(me: Me['lastImport']): Promise<void>;
  syncNow(): Promise<void>;
  /** Called after a sale is recorded on the phone. */
  saleRecorded(): void;
}

const Ctx = createContext<Session | null>(null);

const SYNC_EVERY_MS = 30_000;

function statusFor(me: Me | null): SessionStatus {
  if (!me) return 'signedOut';
  return me.shop ? 'ready' : 'needsShop';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [items, setItemsState] = useState<Item[]>([]);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [pending, setPending] = useState(0);
  const meRef = useRef<Me | null>(null);
  meRef.current = me;

  const updatePending = useCallback(async () => setPending(await allPendingCount()), []);

  const apply = useCallback(async (next: Me | null) => {
    await cacheMe(next);
    setMe(next);
    setStatus(statusFor(next));
    setItemsState(next?.shop ? await listItems(next.shop.id) : []);
  }, []);

  const handleSignedOut = useCallback(async () => {
    // Sales stay on the phone; they are sent after the owner of that shop signs in again.
    await apply(null);
  }, [apply]);

  const refreshItems = useCallback(async () => {
    const shop = meRef.current?.shop;
    if (!shop) return;
    try {
      const r = await Api.items();
      await replaceItems(shop.id, r.items);
      setItemsState(r.items);
      setOnline(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await handleSignedOut();
      else if (e instanceof ApiError && e.offline) setOnline(false);
    }
  }, [handleSignedOut]);

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
  }, [apply, handleSignedOut, updatePending]);

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
      if (document.visibilityState === 'visible') void syncNow();
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
      online,
      pending,
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
    [status, me, items, online, pending, apply, refreshItems, syncNow, updatePending],
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
