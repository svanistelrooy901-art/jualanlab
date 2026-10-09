import { useSyncExternalStore } from 'react';
import { en } from './en';
import { ms } from './ms';

export type Lang = 'ms' | 'en';
export type Dict = typeof en;

/** Bahasa Melayu is the default until the person picks English. */
const KEY = 'jl-lang';

function readStored(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'en' || v === 'ms') return v;
  } catch {
    /* storage blocked: default, still switchable for this visit */
  }
  return 'ms';
}

let lang: Lang = typeof window === 'undefined' ? 'ms' : readStored();
const listeners = new Set<() => void>();

function apply() {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
apply();

export const getLang = (): Lang => lang;

export function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  apply();
  listeners.forEach((l) => l());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => lang,
  );
}

export function dictFor(l: Lang): Dict {
  return l === 'en' ? en : (ms as unknown as Dict);
}

export function useT(): Dict {
  return dictFor(useLang());
}

/** Fills {placeholders}. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Short date and time in Malaysia, in the chosen language. */
export function formatWhen(iso: string, l: Lang, withTime = true): string {
  return new Date(iso).toLocaleString(l === 'ms' ? 'ms-MY' : 'en-MY', {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    timeZone: 'Asia/Kuala_Lumpur',
  });
}
