/** JualanLab signs in through the smeLab account and takes its plan from it (DECISIONS A-01, A-05). */
import { describe, expect, it } from 'vitest';
import type { SmeLabLink } from '../api';
import { makeWorld } from './world';

const SMELAB = 'https://smelab.untunglab.space';
const CALLBACK = 'https://jualan.untunglab.space/api/auth/smelab/callback';

/** A fake smeLab: codes it has handed out, and what each account owns. */
function fakeSmeLab() {
  const codes = new Map<string, { id: string; email: string; name: string | null }>();
  const owns = new Map<string, string[]>();
  const link: SmeLabLink = {
    async redeem(code, app, redirectUri) {
      const a = codes.get(code);
      codes.delete(code);
      if (!a || app !== 'jualanlab' || redirectUri !== CALLBACK) return null;
      return { account: a, products: owns.get(a.id) ?? [] };
    },
    async productsOf(id) {
      return owns.get(id) ?? [];
    },
  };
  return { link, codes, owns };
}

async function world(over = {}) {
  const sm = fakeSmeLab();
  const w = await makeWorld({ smelab: { url: SMELAB, callbackUrl: CALLBACK }, ...over }, { smelab: sm.link });
  /** Goes through smeLab sign-in as this account; returns the callback response. */
  async function signInAs(account: { id: string; email: string; name?: string | null }, opts: { state?: string } = {}) {
    const start = await w.call('GET', '/api/auth/smelab/start');
    const to = new URL(start.location!);
    const state = to.searchParams.get('state')!;
    const stateCookie = start.setCookies.find((c: string) => c.startsWith('jl_sso='))!.split(';')[0]!;
    const code = `code-${Math.random().toString(36).slice(2)}-xxxxxxxxxxxx`;
    sm.codes.set(code, { id: account.id, email: account.email, name: account.name ?? null });
    return w.call('GET', `/api/auth/smelab/callback?code=${code}&state=${opts.state ?? state}`, undefined, { cookie: stateCookie });
  }
  return { w, sm, signInAs };
}

describe('sign in with the smeLab account', () => {
  it('start sends the person to smeLab for JualanLab, with a state only this browser holds', async () => {
    const { w } = await world();
    const start = await w.call('GET', '/api/auth/smelab/start');
    expect(start.status).toBe(302);
    const to = new URL(start.location!);
    expect(`${to.origin}${to.pathname}`).toBe(`${SMELAB}/masuk`);
    expect(to.searchParams.get('app')).toBe('jualanlab');
    expect(to.searchParams.get('redirect_uri')).toBe(CALLBACK);
    expect(start.setCookies.find((c: string) => c.startsWith('jl_sso='))).toContain('HttpOnly');
    expect((await w.call('GET', '/api/config')).body.smelab).toEqual({ url: SMELAB });
    // JualanLab's own email codes are off: smeLab is the one place to sign in.
    expect((await w.call('POST', '/api/auth/email/start', { email: 'a@b.co' })).status).toBe(404);
  });

  it('back from smeLab: a new user, signed in, then the shop is set up as before', async () => {
    const { w, signInAs } = await world();
    const back = await signInAs({ id: 'sm-1', email: 'Kak.Ros@example.com', name: 'Kak Ros' });
    expect(back).toMatchObject({ status: 302, location: '/' });
    const me = await w.call('GET', '/api/me');
    expect(me.body.user).toMatchObject({ email: 'kak.ros@example.com', name: 'Kak Ros' });
    expect((await w.call('POST', '/api/shop', { name: 'Kedai Ros' })).body.shop.plan).toBe('free');
  });

  it('the plan follows smeLab: bought there opens the full POS here; a refund there moves it back', async () => {
    const { w, sm, signInAs } = await world();
    await signInAs({ id: 'sm-2', email: 'beli@example.com' });
    await w.call('POST', '/api/shop', { name: 'Kedai Beli' });
    sm.owns.set('sm-2', ['untunglab', 'jualanlab']);
    expect((await w.call('GET', '/api/billing')).body).toMatchObject({ plan: 'pos', buyUrl: `${SMELAB}/beli?item=jualanlab` });
    sm.owns.set('sm-2', ['untunglab']);
    expect((await w.call('GET', '/api/me')).body.shop.plan).toBe('free');
  });

  it('an account from before smeLab with the same email is linked, shop and sales kept', async () => {
    const sm = fakeSmeLab();
    const w2 = await makeWorld({ smelab: { url: SMELAB, callbackUrl: CALLBACK } }, { smelab: sm.link });
    // An account made with JualanLab's own sign-in, before smeLab.
    await w2.store.createUser({ id: 'old-user', email: 'lama@example.com', name: null, googleSub: null, createdAt: '2026-10-01T00:00:00.000Z' });
    await w2.store.createShop({ id: 'old-shop', ownerId: 'old-user', name: 'Kedai Lama', createdAt: '2026-10-01T00:00:00.000Z' });
    const start = await w2.call('GET', '/api/auth/smelab/start');
    const state = new URL(start.location!).searchParams.get('state')!;
    const stateCookie = start.setCookies.find((c: string) => c.startsWith('jl_sso='))!.split(';')[0]!;
    sm.codes.set('code-lama-xxxxxxxxxxxxxxxx', { id: 'sm-lama', email: 'lama@example.com', name: 'Lama' });
    await w2.call('GET', `/api/auth/smelab/callback?code=code-lama-xxxxxxxxxxxxxxxx&state=${state}`, undefined, { cookie: stateCookie });
    expect((await w2.call('GET', '/api/me')).body).toMatchObject({ user: { id: 'old-user' }, shop: { id: 'old-shop', name: 'Kedai Lama' } });
    expect((await w2.store.getUserBySmelabId('sm-lama'))?.id).toBe('old-user');
  });

  it('refuses a callback without this browser\'s state, or with a code smeLab does not know', async () => {
    const { w, signInAs } = await world();
    expect((await signInAs({ id: 'sm-3', email: 'x@example.com' }, { state: 'not-the-state-123' })).location).toBe('/?masuk=gagal');
    expect((await w.call('GET', '/api/auth/smelab/callback?code=nope-nope-nope-nope-nope&state=abc')).location).toBe('/?masuk=gagal');
    expect((await w.call('GET', '/api/me')).status).toBe(401);
  });

  it('before launch, a new smeLab account cannot open JualanLab unless listed; listed testers can', async () => {
    const { w, signInAs } = await world({ prelaunch: true, testerEmails: ['uji@example.com'] });
    expect((await signInAs({ id: 'sm-4', email: 'orang@example.com' })).location).toBe('/?masuk=belum');
    expect((await w.call('GET', '/api/me')).status).toBe(401);
    expect((await signInAs({ id: 'sm-5', email: 'uji@example.com' })).location).toBe('/');
  });
});
