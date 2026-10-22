import { describe, expect, it } from 'vitest';
import { createWaitlistHandler, validateWaitlist } from '../waitlist';
import { makeWorld, ORIGIN } from './world';

async function setup() {
  const w = await makeWorld({ complimentaryEmails: ['mamu@example.com'] });
  const page = createWaitlistHandler({ store: w.store, now: () => new Date('2026-10-22T05:00:00.000Z') });
  const post = (fields: Record<string, string>, query = '', origin: string | null = ORIGIN) =>
    page(new Request(`${ORIGIN}/waitinglist${query}`, { method: 'POST', body: new URLSearchParams(fields), headers: origin ? { origin } : {} }));
  return { w, page, post };
}

describe('waiting list', () => {
  it('shows the form in BM, and EN with ?lang=en', async () => {
    const { page } = await setup();
    const ms = await (await page(new Request(`${ORIGIN}/waitinglist`))).text();
    expect(ms).toContain('Sertai senarai menunggu');
    expect(ms).toContain('<option value="street_food">Makanan jalanan</option>');
    const en = await (await page(new Request(`${ORIGIN}/waitinglist?lang=en`))).text();
    expect(en).toContain('Join the waiting list');
    expect(en).toContain('Fashion and apparel');
  });

  it('saves a sign-up, then shows thanks; signing up again updates the row', async () => {
    const { w, post, page } = await setup();
    const res = await post({ name: '  Aina  Zainal ', email: 'Aina@Example.com', business: 'bakery' });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/waitinglist?joined=1');
    expect(await (await page(new Request(`${ORIGIN}${res.headers.get('location')}`))).text()).toContain('Anda dalam senarai!');
    await post({ name: 'Aina Z', email: 'aina@example.com', business: 'others' }, '?lang=en');
    expect(await w.store.listWaitlist()).toEqual([{ email: 'aina@example.com', name: 'Aina Z', business: 'others', lang: 'en', createdAt: '2026-10-22T05:00:00.000Z' }]);
  });

  it('shows errors and keeps what was typed', async () => {
    const { w, post } = await setup();
    const res = await post({ name: 'Aina', email: 'not-an-email', business: 'cars' });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain('Semak emel ini.');
    expect(html).toContain('Pilih jenis perniagaan.');
    expect(html).toContain('value="Aina"');
    expect(await w.store.listWaitlist()).toEqual([]);
    expect(validateWaitlist({ name: '', email: 'a@b.co', business: 'hobbies' })).toEqual({ name: true });
  });

  it('ignores bots and other sites', async () => {
    const { w, post } = await setup();
    expect((await post({ name: 'Bot', email: 'bot@example.com', business: 'bakery', website: 'http://spam' })).status).toBe(303);
    expect((await post({ name: 'X', email: 'x@example.com', business: 'bakery' }, '', 'https://evil.example')).status).toBe(403);
    expect(await w.store.listWaitlist()).toEqual([]);
  });

  it('owner accounts download the list as CSV; others cannot', async () => {
    const { w, post } = await setup();
    await post({ name: 'Kak Ros', email: 'ros@example.com', business: 'street_food' });
    await w.signIn('someone@example.com');
    expect((await w.call('GET', '/api/admin/waitlist.csv')).status).toBe(403);
    await w.signIn('mamu@example.com');
    const csv = await w.call('GET', '/api/admin/waitlist.csv');
    expect(csv.status).toBe(200);
    expect(csv.body).toContain('Kak Ros,ros@example.com,Street food,ms');
  });
});
