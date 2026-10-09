/**
 * The cart being rung up. Kept outside React so moving between the counter and payment keeps it,
 * and copied to localStorage so an accidental reload does not lose a half-taken order.
 */
import { useSyncExternalStore } from 'react';
import type { CartLine } from '../domain/cart';

export interface Cart {
  lines: CartLine[];
  discountSen: number;
}

const KEY = 'jl-cart';
const EMPTY: Cart = { lines: [], discountSen: 0 };

function load(): Cart {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as Cart;
    if (Array.isArray(v.lines) && typeof v.discountSen === 'number') return v;
  } catch {
    /* storage blocked or damaged: start empty */
  }
  return EMPTY;
}

let cart: Cart = typeof window === 'undefined' ? EMPTY : load();
const listeners = new Set<() => void>();

export function getCart(): Cart {
  return cart;
}

export function setCart(next: Cart): void {
  cart = next.lines.length === 0 ? { lines: [], discountSen: 0 } : next;
  try {
    if (cart.lines.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(cart));
  } catch {
    /* in memory only */
  }
  listeners.forEach((l) => l());
}

export function updateCart(fn: (c: Cart) => Cart): void {
  setCart(fn(cart));
}

export function clearCart(): void {
  setCart(EMPTY);
}

export function useCart(): Cart {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => cart,
  );
}
