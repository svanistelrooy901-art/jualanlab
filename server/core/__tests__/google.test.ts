import { describe, expect, it } from 'vitest';
import { base64url } from '../crypto';
import { createGoogleVerifier } from '../google';

const CLIENT = 'client-123.apps.googleusercontent.com';
const NOW = new Date('2026-10-10T01:00:00Z');
const t = Math.floor(NOW.getTime() / 1000);

async function keyPair(kid: string) {
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid };
  return { kp, jwk };
}

async function token(privateKey: CryptoKey, kid: string, payload: Record<string, unknown>, alg = 'RS256') {
  const enc = (o: unknown) => base64url(new TextEncoder().encode(JSON.stringify(o)));
  const head = `${enc({ alg, kid, typ: 'JWT' })}.${enc(payload)}`;
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(head)));
  return `${head}.${base64url(sig)}`;
}

const good = { iss: 'https://accounts.google.com', aud: CLIENT, sub: '1077', email: 'Mak.Long@Gmail.com', email_verified: true, name: 'Mak Long', iat: t - 10, exp: t + 3600 };

describe('Google ID token', () => {
  it('accepts a valid token and reads the identity', async () => {
    const { kp, jwk } = await keyPair('k1');
    const v = createGoogleVerifier({ clientId: CLIENT, fetchKeys: async () => [jwk], now: () => NOW });
    expect(await v.verify(await token(kp.privateKey, 'k1', good))).toEqual({ sub: '1077', email: 'mak.long@gmail.com', emailVerified: true, name: 'Mak Long' });
  });
  it.each([
    ['another app', { aud: 'other-app' }],
    ['another issuer', { iss: 'https://evil.example' }],
    ['expired', { exp: t - 3600 }],
    ['issued in the future', { iat: t + 3600 }],
    ['no email', { email: undefined }],
  ])('rejects a token for %s', async (_n, over) => {
    const { kp, jwk } = await keyPair('k1');
    const v = createGoogleVerifier({ clientId: CLIENT, fetchKeys: async () => [jwk], now: () => NOW });
    expect(await v.verify(await token(kp.privateKey, 'k1', { ...good, ...over }))).toBeNull();
  });
  it('rejects a token signed by another key, a tampered payload and junk', async () => {
    const { jwk } = await keyPair('k1');
    const other = await keyPair('k1');
    const v = createGoogleVerifier({ clientId: CLIENT, fetchKeys: async () => [jwk], now: () => NOW });
    expect(await v.verify(await token(other.kp.privateKey, 'k1', good))).toBeNull();
    const { kp: kp2, jwk: jwk2 } = await keyPair('k2');
    const v2 = createGoogleVerifier({ clientId: CLIENT, fetchKeys: async () => [jwk2], now: () => NOW });
    const real = await token(kp2.privateKey, 'k2', good);
    const [h, , s] = real.split('.');
    const forged = `${h}.${base64url(new TextEncoder().encode(JSON.stringify({ ...good, email: 'boss@gmail.com' })))}.${s}`;
    expect(await v2.verify(forged)).toBeNull();
    expect(await v2.verify('not.a.jwt')).toBeNull();
    expect(await v2.verify('x')).toBeNull();
  });
  it('fetches new keys once when Google rotates them', async () => {
    const a = await keyPair('old');
    const b = await keyPair('new');
    let calls = 0;
    const v = createGoogleVerifier({ clientId: CLIENT, fetchKeys: async () => (++calls === 1 ? [a.jwk] : [a.jwk, b.jwk]), now: () => NOW });
    expect(await v.verify(await token(a.kp.privateKey, 'old', good))).not.toBeNull();
    expect(await v.verify(await token(b.kp.privateKey, 'new', good))).not.toBeNull();
    expect(calls).toBe(2);
  });
  it('is off without a client id', async () => {
    const { kp, jwk } = await keyPair('k1');
    const v = createGoogleVerifier({ clientId: '', fetchKeys: async () => [jwk], now: () => NOW });
    expect(await v.verify(await token(kp.privateKey, 'k1', good))).toBeNull();
  });
});
