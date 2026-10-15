/** Bazaar Mode settings for this phone: which items get big buttons, the float, screen and sound. */
import { getMeta, setMeta } from '../db/db';

export const MAX_BAZAAR_BUTTONS = 8;

export interface BazaarSettings {
  itemIds: string[];
  /** Cash for change last used; offered when the bazaar opens the business day. */
  floatSen: number;
  keepAwake: boolean;
  sound: boolean;
  /** Business day the bazaar is selling in; null when not running. */
  runningDayId: string | null;
}

export const DEFAULT_BAZAAR: BazaarSettings = { itemIds: [], floatSen: 0, keepAwake: true, sound: true, runningDayId: null };

export async function loadBazaar(shopId: string): Promise<BazaarSettings> {
  return { ...DEFAULT_BAZAAR, ...((await getMeta<BazaarSettings>(`bazaar:${shopId}`)) ?? {}) };
}

export async function saveBazaar(shopId: string, s: BazaarSettings): Promise<void> {
  await setMeta(`bazaar:${shopId}`, s);
}

/** Starts the bazaar in the open business day (the setup screen opens one first if needed). */
export async function startBazaar(shopId: string, s: BazaarSettings, dayId: string): Promise<BazaarSettings> {
  const next = { ...s, itemIds: s.itemIds.slice(0, MAX_BAZAAR_BUTTONS), runningDayId: dayId };
  await saveBazaar(shopId, next);
  return next;
}

export async function endBazaar(shopId: string): Promise<void> {
  await saveBazaar(shopId, { ...(await loadBazaar(shopId)), runningDayId: null });
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
