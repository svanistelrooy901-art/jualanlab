/**
 * New-order alerts (Kedai). While the app is open: a two-note chime, a vibration and a banner (session.tsx and
 * Layout). While it is closed: a phone notification through web push (public/push-sw.js), which this file turns
 * on and off for this phone.
 */
import { Api } from './api';

let audio: AudioContext | null = null;

/** Two bright notes, twice: loud enough to hear across a kitchen. Silent when the phone does not allow sound yet. */
export function chime(): void {
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const now = audio.currentTime;
    [0, 0.18, 0.6, 0.78].forEach((at, n) => {
      const o = audio!.createOscillator();
      const g = audio!.createGain();
      o.type = 'triangle';
      o.frequency.value = n % 2 === 0 ? 988 : 1319;
      g.gain.setValueAtTime(0.0001, now + at);
      g.gain.exponentialRampToValueAtTime(0.35, now + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.3);
      o.connect(g).connect(audio!.destination);
      o.start(now + at);
      o.stop(now + at + 0.32);
    });
  } catch {
    /* no sound available */
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* no vibration */
  }
}

export type PushState = 'unsupported' | 'needs-install' | 'off' | 'on' | 'blocked';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

function supported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function pushState(): Promise<PushState> {
  // iPhones only allow notifications for apps added to the Home Screen.
  if (isIos() && !standalone()) return 'needs-install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Asks the phone for permission, subscribes, and tells the server. Returns the new state. */
export async function turnOnPush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const { pushKey } = await Api.config();
  if (!pushKey) return 'unsupported';
  if ((await Notification.requestPermission()) !== 'granted') return Notification.permission === 'denied' ? 'blocked' : 'off';
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with another key (after the server key changed) cannot be used: start again.
  const key = sub?.options.applicationServerKey;
  if (sub && key && btoa(String.fromCharCode(...new Uint8Array(key))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== pushKey) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(pushKey) });
  await Api.pushSubscribe(sub.endpoint);
  return 'on';
}

export async function turnOffPush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await Api.pushUnsubscribe(sub.endpoint).catch(() => undefined);
    await sub.unsubscribe();
  }
  return 'off';
}
