/**
 * Web Push without a payload (RFC 8030 + VAPID, RFC 8292): the push only wakes the app's service worker, which then
 * asks the API what is new. No payload means no message encryption; the request carries a VAPID token signed with
 * the server's P-256 key (ES256) so the push service knows it comes from us.
 */
import { base64url } from './crypto';
import type { Store } from './ports';

export interface PushConfig {
  /** Uncompressed P-256 public key (65 bytes) as base64url: what the app passes to pushManager.subscribe. */
  publicKey: string;
  /** The private key's "d" as base64url. */
  privateKey: string;
  /** Contact for push services, e.g. mailto:hello@digitalsambal.space */
  subject: string;
}

export type PushResult = 'sent' | 'gone' | 'failed';

/** Push services we send to; anything else is refused when a phone subscribes. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export function isPushEndpoint(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 1000) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && PUSH_HOSTS.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}

const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const enc = new TextEncoder();

export function createPusher(cfg: PushConfig, fetchFn: typeof fetch = fetch, nowSec = () => Math.floor(Date.now() / 1000)) {
  let key: Promise<CryptoKey> | null = null;
  function signingKey() {
    const pub = fromB64url(cfg.publicKey);
    key ??= crypto.subtle.importKey(
      'jwk',
      { kty: 'EC', crv: 'P-256', d: cfg.privateKey, x: base64url(pub.slice(1, 33)), y: base64url(pub.slice(33, 65)), ext: true },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
    return key;
  }

  async function token(audience: string) {
    const head = base64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const body = base64url(enc.encode(JSON.stringify({ aud: audience, exp: nowSec() + 12 * 3600, sub: cfg.subject })));
    const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await signingKey(), enc.encode(`${head}.${body}`)));
    return `${head}.${body}.${base64url(sig)}`;
  }

  return async function send(endpoint: string): Promise<PushResult> {
    try {
      const res = await fetchFn(endpoint, {
        method: 'POST',
        headers: { TTL: '3600', Urgency: 'high', 'Content-Length': '0', Authorization: `vapid t=${await token(new URL(endpoint).origin)}, k=${cfg.publicKey}` },
      });
      if (res.status === 404 || res.status === 410) return 'gone';
      return res.ok ? 'sent' : 'failed';
    } catch {
      return 'failed';
    }
  };
}

/** Wakes every phone of the shop that asked for alerts; forgets phones whose subscription is gone. */
export async function notifyShop(store: Store, send: (endpoint: string) => Promise<PushResult>, shopId: string): Promise<number> {
  let sent = 0;
  for (const endpoint of await store.listPushSubs(shopId)) {
    const r = await send(endpoint);
    if (r === 'gone') await store.deletePushSub(endpoint);
    if (r === 'sent') sent++;
  }
  return sent;
}

/**
 * The server's VAPID key pair, derived from an existing server secret (HKDF), so no extra secret has to be kept.
 * Changing that secret changes the key: phones then simply turn notifications on again.
 */
export async function deriveVapid(seed: string, subject: string): Promise<PushConfig> {
  const base = await crypto.subtle.importKey('raw', enc.encode(seed), 'HKDF', false, ['deriveBits']);
  const d = new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('jualanlab-vapid'), info: enc.encode('p256-v1') }, base, 256));
  // PKCS#8 for a P-256 private key without its public half; the runtime works the public point out on import.
  const der = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01,
    0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20, ...d,
  ]);
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const jwk = await crypto.subtle.exportKey('jwk', key);
  const pub = new Uint8Array([4, ...fromB64url(jwk.x!), ...fromB64url(jwk.y!)]);
  return { publicKey: base64url(pub), privateKey: jwk.d!, subject };
}
