import { describe, expect, it } from 'vitest';
import { createPusher, deriveVapid, isPushEndpoint } from '../webpush';
import { makeWorld } from './world';

describe('new-order notifications', () => {
  it('derives a stable key pair and signs a VAPID token the push service can check', async () => {
    const c = await deriveVapid('pepper', 'mailto:hello@digitalsambal.space');
    expect((await deriveVapid('pepper', 'x')).publicKey).toBe(c.publicKey);
    expect((await deriveVapid('other', 'x')).publicKey).not.toBe(c.publicKey);
    let seen: { url: string; headers: Record<string, string> } | null = null;
    const send = createPusher(c, (async (url: string, init: RequestInit) => {
      seen = { url, headers: init.headers as Record<string, string> };
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch);
    expect(await send('https://fcm.googleapis.com/fcm/send/abc')).toBe('sent');
    const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(seen!.headers.Authorization!)!;
    expect(k).toBe(c.publicKey);
    const [h, b, s] = t!.split('.');
    const pub = await crypto.subtle.importKey('raw', Buffer.from(c.publicKey, 'base64url'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, Buffer.from(s!, 'base64url'), new TextEncoder().encode(`${h}.${b}`))).toBe(true);
    expect(JSON.parse(Buffer.from(b!, 'base64url').toString())).toMatchObject({ aud: 'https://fcm.googleapis.com', sub: 'mailto:hello@digitalsambal.space' });
    expect(seen!.headers.TTL).toBe('3600');
  });

  it('only accepts real push services', () => {
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/x')).toBe(true);
    expect(isPushEndpoint('https://web.push.apple.com/abc')).toBe(true);
    expect(isPushEndpoint('https://evil.example/fcm.googleapis.com')).toBe(false);
    expect(isPushEndpoint('http://fcm.googleapis.com/x')).toBe(false);
  });

  it('a new store order rings every subscribed phone of that shop, and forgets phones that are gone', async () => {
    const rang: string[] = [];
    const push = async (e: string) => (rang.push(e), e.endsWith('/gone') ? ('gone' as const) : ('sent' as const));
    const w = await makeWorld({ pushPublicKey: 'BPUB' }, { push });
    await w.signIn();
    await w.call('POST', '/api/shop', { name: 'Dapur Mak Long' });
    expect((await w.call('GET', '/api/config')).body.pushKey).toBe('BPUB');
    expect((await w.call('POST', '/api/push', { endpoint: 'https://evil.example/x' })).body.error).toBe('bad_endpoint');
    await w.call('POST', '/api/push', { endpoint: 'https://fcm.googleapis.com/fcm/send/one' });
    await w.call('POST', '/api/push', { endpoint: 'https://fcm.googleapis.com/fcm/send/gone' });
    expect((await w.call('POST', '/api/push/test')).body.sent).toBe(1);
    expect(rang).toEqual(['https://fcm.googleapis.com/fcm/send/one', 'https://fcm.googleapis.com/fcm/send/gone']);
    rang.length = 0;
    expect((await w.call('POST', '/api/push/test')).body.sent).toBe(1);
    expect(rang).toEqual(['https://fcm.googleapis.com/fcm/send/one']);
    await w.call('DELETE', '/api/push', { endpoint: 'https://fcm.googleapis.com/fcm/send/one' });
    expect((await w.call('POST', '/api/push/test')).body.sent).toBe(0);
  });
});

describe('new-order notifications from the store', () => {
  it('an order placed on the store rings the shop, and the summary names the newest order', async () => {
    const { readFileSync } = await import('node:fs');
    const { defaultSettings } = await import('../../../src/domain/kedai');
    const price = JSON.parse(readFileSync(new URL('../../../spec/fixtures/price-list.valid.json', import.meta.url), 'utf8'));
    const rang: string[] = [];
    const w = await makeWorld({ pushPublicKey: 'BPUB' }, { push: async (e) => (rang.push(e), 'sent' as const) });
    await w.signIn();
    const shopId = (await w.call('POST', '/api/shop', { name: 'Dapur Mak Long' })).body.shop.id as string;
    await w.store.setShopPlan(shopId, 'pos', '2026-10-01T00:00:00.000Z');
    await w.store.setShopKedai(shopId, '9999-12-31T00:00:00.000Z');
    const items = (await w.call('POST', '/api/items/import', { priceList: price })).body.items as { id: string }[];
    await w.call('PUT', '/api/kedai', { ...defaultSettings('dapur-mak-long'), published: true, pickup: { on: true, address: 'BM', mapUrl: '', hours: '' } });
    await w.call('POST', '/api/push', { endpoint: 'https://fcm.googleapis.com/fcm/send/one' });
    expect((await w.call('GET', '/api/kedai/summary')).body.latest).toBeNull();
    const r = await w.kcall('POST', '/dapur-mak-long/pesan', { lines: [{ itemId: items[0]!.id, quantity: 1, note: '' }], name: 'Aina', phone: '0123456789', fulfilment: 'pickup', area: '', address: '', note: '', pay: 'qr' });
    expect(r.status).toBe(201);
    expect(rang).toEqual(['https://fcm.googleapis.com/fcm/send/one']);
    expect((await w.call('GET', '/api/kedai/summary')).body.latest).toMatchObject({ number: 'K-0001', customerName: 'Aina' });
  });
});
