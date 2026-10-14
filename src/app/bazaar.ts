/** Bazaar Mode settings for this phone: which items get big buttons, the float, screen and sound. */
import { getMeta, setMeta } from '../db/db';
import { dayKey } from '../domain/day';

export const MAX_BAZAAR_BUTTONS = 8;

export interface BazaarSettings {
  itemIds: string[];
  floatSen: number;
  keepAwake: boolean;
  sound: boolean;
  /** Day the bazaar was started (Malaysia time); null when not running. */
  runningDay: string | null;
}

export const DEFAULT_BAZAAR: BazaarSettings = { itemIds: [], floatSen: 0, keepAwake: true, sound: true, runningDay: null };

export async function loadBazaar(shopId: string): Promise<BazaarSettings> {
  return { ...DEFAULT_BAZAAR, ...((await getMeta<BazaarSettings>(`bazaar:${shopId}`)) ?? {}) };
}

export async function saveBazaar(shopId: string, s: BazaarSettings): Promise<void> {
  await setMeta(`bazaar:${shopId}`, s);
}

/** Starts the bazaar today and offers the float to Close Day. */
export async function startBazaar(shopId: string, s: BazaarSettings, now = new Date()): Promise<BazaarSettings> {
  const day = dayKey(now);
  const next = { ...s, itemIds: s.itemIds.slice(0, MAX_BAZAAR_BUTTONS), runningDay: day };
  await saveBazaar(shopId, next);
  await setMeta(`float:${shopId}:${day}`, s.floatSen);
  return next;
}

export async function endBazaar(shopId: string): Promise<void> {
  await saveBazaar(shopId, { ...(await loadBazaar(shopId)), runningDay: null });
}

/** A short click so the seller hears the tap over bazaar noise. Silent when audio is not allowed. */
let audio: AudioContext | null = null;
export function tapSound(): void {
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.08);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.09);
  } catch {
    /* no sound available */
  }
}

/** Keeps the screen on while selling (Screen Wake Lock), re-asked when the app comes back to the front. */
export function keepScreenOn(): () => void {
  let lock: { release(): Promise<void> } | null = null;
  let stopped = false;
  const ask = async () => {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
      if (!wl || document.visibilityState !== 'visible' || stopped) return;
      lock = await wl.request('screen');
    } catch {
      /* battery saver or unsupported: the screen may dim */
    }
  };
  const onVisible = () => void ask();
  document.addEventListener('visibilitychange', onVisible);
  void ask();
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    void lock?.release().catch(() => undefined);
  };
}
