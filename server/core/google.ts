/**
 * Verifies a Google Identity Services ID token (the `credential` from "Sign in with Google") without a library:
 * RS256 signature against Google's published keys, then issuer, audience and expiry.
 */
import { fromBase64url } from './crypto';
import type { GoogleIdentity, GoogleVerifier } from './ports';

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const SKEW_S = 60;

interface Jwk extends JsonWebKey { kid?: string }

export function createGoogleVerifier(opts: {
  clientId: string;
  /** Fetches Google's key set; cached for an hour. */
  fetchKeys?: () => Promise<Jwk[]>;
  now?: () => Date;
}): GoogleVerifier {
  const now = opts.now ?? (() => new Date());
  const fetchKeys = opts.fetchKeys ?? (async () => {
    const r = await fetch(GOOGLE_JWKS_URL, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`Google keys: ${r.status}`);
    return ((await r.json()) as { keys: Jwk[] }).keys;
  });
  let cache: { keys: Jwk[]; at: number } | null = null;

  async function keyFor(kid: string, refresh = false): Promise<Jwk | undefined> {
    if (!cache || refresh || now().getTime() - cache.at > 3600_000) cache = { keys: await fetchKeys(), at: now().getTime() };
    return cache.keys.find((k) => k.kid === kid);
  }

  return {
    async verify(idToken: string): Promise<GoogleIdentity | null> {
      if (!opts.clientId) return null;
      const parts = idToken.split('.');
      if (parts.length !== 3) return null;
      let header: { alg?: string; kid?: string };
      let payload: Record<string, unknown>;
      try {
        header = JSON.parse(new TextDecoder().decode(fromBase64url(parts[0]!)));
        payload = JSON.parse(new TextDecoder().decode(fromBase64url(parts[1]!)));
      } catch {
        return null;
      }
      if (header.alg !== 'RS256' || !header.kid) return null;
      const jwk = (await keyFor(header.kid)) ?? (await keyFor(header.kid, true));
      if (!jwk) return null;
      const key = await crypto.subtle.importKey('jwk', { ...jwk, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64url(parts[2]!), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
      if (!ok) return null;
      const t = Math.floor(now().getTime() / 1000);
      if (!ISSUERS.includes(payload.iss as string)) return null;
      const aud = payload.aud;
      if (Array.isArray(aud) ? !aud.includes(opts.clientId) : aud !== opts.clientId) return null;
      if (typeof payload.exp !== 'number' || payload.exp < t - SKEW_S) return null;
      if (typeof payload.iat === 'number' && payload.iat > t + SKEW_S) return null;
      if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
      return {
        sub: payload.sub,
        email: payload.email.trim().toLowerCase(),
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        name: typeof payload.name === 'string' ? payload.name : null,
      };
    },
  };
}
