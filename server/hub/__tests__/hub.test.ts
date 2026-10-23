/** smeLab account service: one account for every app (DECISIONS A-01 to A-06). */
import { describe, expect, it } from 'vitest';
import { md5 } from '../../core/md5';
import { offerFor } from '../core/offers';
import { CONFIG, HUB, JL_CALLBACK, makeHub, UL_CALLBACK } from './world';

const STATE = 'state-abcdef123456';
const masuk = (app = 'jualanlab', redirect = JL_CALLBACK, extra = '') =>
  `/masuk?app=${app}&redirect_uri=${encodeURIComponent(redirect)}&state=${STATE}${extra}`;
const codeOf = (location: string | null) => new URL(location!).searchParams.get('code')!;

describe('sign in once, every app opens signed in', () => {
  it('signed out: the sign-in page; after signing in, straight back to the app with a one-time code', async () => {
    const w = await makeHub();
    const page = await w.call('GET', masuk());
    expect(page.status).toBe(200);
    expect(page.body).toContain('JualanLab');
    expect(page.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect((await w.signIn()).status).toBe(200);
    const back = await w.call('GET', masuk());
    expect(back.status).toBe(302);
    const to = new URL(back.location!);
    expect(`${to.origin}${to.pathname}`).toBe(JL_CALLBACK);
    expect(to.searchParams.get('state')).toBe(STATE);
    const got = await w.hub.redeem(codeOf(back.location), 'jualanlab', JL_CALLBACK);
    expect(got).toMatchObject({ account: { email: 'kak.ros@example.com' }, products: [] });
    // Single use.
    expect(await w.hub.redeem(codeOf(back.location), 'jualanlab', JL_CALLBACK)).toBeNull();
  });

  it('a second app opens without a new code: the same account, one tap', async () => {
    const w = await makeHub();
    await w.signIn();
    const jl = await w.hub.redeem(codeOf((await w.call('GET', masuk())).location), 'jualanlab', JL_CALLBACK);
    const ul = await w.hub.redeem(codeOf((await w.call('GET', masuk('untunglab', UL_CALLBACK))).location), 'untunglab', UL_CALLBACK);
    expect(ul!.account.id).toBe(jl!.account.id);
    expect(w.codes).toHaveLength(1);
  });

  it('a code only works for the app and address it was made for, and only for 2 minutes', async () => {
    const w = await makeHub();
    await w.signIn();
    expect(await w.hub.redeem(codeOf((await w.call('GET', masuk())).location), 'untunglab', JL_CALLBACK)).toBeNull();
    expect(await w.hub.redeem(codeOf((await w.call('GET', masuk())).location), 'jualanlab', 'https://evil.example/cb')).toBeNull();
    const late = codeOf((await w.call('GET', masuk())).location);
    w.advance(121_000);
    expect(await w.hub.redeem(late, 'jualanlab', JL_CALLBACK)).toBeNull();
    expect(await w.hub.redeem('nonsense', 'jualanlab', JL_CALLBACK)).toBeNull();
  });

  it('never sends a signed-in account to an address it does not know', async () => {
    const w = await makeHub();
    await w.signIn();
    const bad = await w.call('GET', masuk('jualanlab', 'https://evil.example/cb'));
    expect(bad.status).toBe(200);
    expect(bad.location).toBeNull();
    expect((await w.call('GET', masuk('promolab'))).location).toBeNull();
    expect((await w.call('GET', `/masuk?app=jualanlab&redirect_uri=${encodeURIComponent(JL_CALLBACK)}&state=x`)).location).toBeNull();
    // Without an app: only paths on smeLab itself.
    expect((await w.call('GET', '/masuk?next=//evil.example')).location).toBe('/akaun');
    expect((await w.call('GET', '/masuk?next=/beli?item=combo')).location).toBe('/beli?item=combo');
  });

  it('"use another account" shows the choice instead of going straight back', async () => {
    const w = await makeHub();
    await w.signIn();
    const page = await w.call('GET', masuk('jualanlab', JL_CALLBACK, '&pilih=1'));
    expect(page.status).toBe(200);
    expect(page.body).toContain('kak.ros@example.com');
    await w.call('POST', '/api/auth/logout', {});
    expect((await w.call('GET', masuk())).status).toBe(200);
  });

  it('Google sign-in reaches the same account as the email', async () => {
    const w = await makeHub();
    await w.signIn('kak.ros@example.com');
    const first = (await w.hub.redeem(codeOf((await w.call('GET', masuk())).location), 'jualanlab', JL_CALLBACK))!;
    w.cookie = '';
    w.googleTokens.set('g', { sub: 'g-1', email: 'Kak.Ros@example.com', emailVerified: true, name: 'Kak Ros' });
    expect((await w.call('POST', '/api/auth/google', { credential: 'g' })).status).toBe(200);
    const again = (await w.hub.redeem(codeOf((await w.call('GET', masuk())).location), 'jualanlab', JL_CALLBACK))!;
    expect(again.account.id).toBe(first.account.id);
  });

  it('email codes: wrong code, expiry, limits, and changes only from smeLab pages', async () => {
    const w = await makeHub();
    await w.call('POST', '/api/auth/email/start', { email: 'a@example.com' });
    expect((await w.call('POST', '/api/auth/email/verify', { email: 'a@example.com', code: '000000' })).body).toMatchObject({ error: 'wrong_code', attemptsLeft: 4 });
    w.advance(11 * 60_000);
    expect((await w.call('POST', '/api/auth/email/verify', { email: 'a@example.com', code: w.codes[0]!.code })).body.error).toBe('code_expired');
    for (let i = 0; i < 4; i++) await w.call('POST', '/api/auth/email/start', { email: 'a@example.com' });
    expect((await w.call('POST', '/api/auth/email/start', { email: 'a@example.com' })).status).toBe(429);
    expect((await w.call('POST', '/api/auth/email/start', { email: 'b@example.com' }, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await w.call('POST', '/api/auth/email/start', { email: 'nope' })).body.error).toBe('bad_email');
  });
});

describe('what an account owns', () => {
  it('an UntungLab licence bought with the same email before smeLab belongs to the account', async () => {
    const w = await makeHub();
    await w.signIn('lama@example.com');
    const got = (await w.hub.redeem(codeOf((await w.call('GET', masuk())).location), 'jualanlab', JL_CALLBACK))!;
    expect(got.products).toEqual(['untunglab']);
    expect(await w.hub.untungLabCodeOf(got.account.id)).toBe('UL-ABCD-EFGH-JKMN');
    // So JualanLab is offered at the owner price.
    const page = await w.call('GET', '/');
    expect(page.body).toContain('Owner price');
    expect(page.body).toContain('/beli?item=jualanlab">');
  });

  it('UntungLab unreachable at sign-in: the licence is picked up later', async () => {
    const w = await makeHub();
    w.setUlDown(true);
    await w.signIn('lama@example.com');
    const id = (await w.hub.redeem(codeOf((await w.call('GET', masuk())).location), 'jualanlab', JL_CALLBACK))!.account.id;
    expect(await w.hub.productsOf(id)).toEqual([]);
    w.setUlDown(false);
    expect((await w.call('GET', '/akaun')).body).toContain('UL-ABCD-EFGH-JKMN');
    expect(await w.hub.productsOf(id)).toEqual(['untunglab']);
  });

  it('owner and testers own every app without paying', async () => {
    const w = await makeHub();
    await w.signIn('mamu@example.com');
    const got = (await w.hub.redeem(codeOf((await w.call('GET', masuk())).location), 'jualanlab', JL_CALLBACK))!;
    expect(got.products.sort()).toEqual(['jualanlab', 'kedai', 'untunglab']);
  });

  it('Kedai Online (KS-01): early buyers for life, a paid period until it ends, nothing otherwise', async () => {
    const w = await makeHub();
    await w.signIn('aina@example.com');
    const id = (await w.store.getAccountByEmail('aina@example.com'))!.id;
    expect(await w.hub.productsOf(id)).toEqual([]);
    await w.d1.prepare("INSERT INTO kedai_access (account_id, until, source, updated_at) VALUES (?, NULL, 'early_buyer', ?)").bind(id, '2026-10-23T16:00:00.000Z').run();
    expect(await w.hub.productsOf(id)).toEqual(['kedai']);
    await w.d1.prepare("UPDATE kedai_access SET until = '2099-01-01T00:00:00.000Z', source = 'subscription' WHERE account_id = ?").bind(id).run();
    expect(await w.hub.productsOf(id)).toEqual(['kedai:2099-01-01T00:00:00.000Z']);
    await w.d1.prepare("UPDATE kedai_access SET until = '2020-01-01T00:00:00.000Z' WHERE account_id = ?").bind(id).run();
    expect(await w.hub.productsOf(id)).toEqual([]);
  });
});

describe('buying one app, the second app, or both', () => {
  it('prices: early bird while places last, owner price for the second app, combo only when owning neither', () => {
    const none = new Set<'untunglab' | 'jualanlab'>();
    const used = { untunglab: 0, jualanlab: 0 };
    expect(offerFor('untunglab', none, used, CONFIG)).toMatchObject({ amountSen: 3900, kind: 'early', fullSen: 4900 });
    expect(offerFor('untunglab', none, { ...used, untunglab: 1 }, CONFIG)).toMatchObject({ amountSen: 4900, kind: 'normal' });
    expect(offerFor('jualanlab', new Set(['untunglab']), used, CONFIG)).toMatchObject({ amountSen: 2900, kind: 'second' });
    expect(offerFor('combo', none, used, CONFIG)).toMatchObject({ amountSen: 7500, kind: 'combo', fullSen: 9800, products: ['untunglab', 'jualanlab'] });
    expect(offerFor('combo', new Set(['untunglab']), used, CONFIG)).toBe('owns_one');
    expect(offerFor('untunglab', new Set(['untunglab']), used, CONFIG)).toBe('owned');
    // Before JualanLab's launch: the combo is early access; JualanLab alone waits, except at the owner price.
    const early = { ...CONFIG, onSale: { untunglab: true, jualanlab: false, combo: true } };
    expect(offerFor('jualanlab', none, used, early)).toBe('not_on_sale');
    expect(offerFor('combo', none, used, early)).toMatchObject({ amountSen: 7500, kind: 'combo' });
    expect(offerFor('jualanlab', new Set(['untunglab']), used, early)).toMatchObject({ amountSen: 2900, kind: 'second' });
    expect(offerFor('combo', none, used, { ...early, onSale: { untunglab: true, jualanlab: false, combo: false } })).toBe('not_on_sale');
  });

  it('the combo: pay, ToyyibPay confirms, both apps open, an UntungLab licence is issued, one receipt', async () => {
    const w = await makeHub();
    await w.signIn();
    expect((await w.call('GET', '/beli?item=combo')).body).toContain('RM75');
    const c = await w.call('POST', '/api/checkout', { item: 'combo', name: 'Kak Ros', phone: '012-345 6789' });
    expect(c.body).toMatchObject({ payUrl: 'https://toyyibpay.test/bill1', amountSen: 7500 });
    // Not paid yet: nothing opens.
    expect((await w.call('GET', `/api/orders/${c.body.orderId}`)).body.status).toBe('pending');
    w.pay(c.body.orderId);
    const done = await w.call('GET', `/api/orders/${c.body.orderId}`);
    expect(done.body).toMatchObject({ status: 'paid', item: 'combo', ulCode: 'UL-NEW0-AAAA-BBBB' });
    expect(w.ulIssued).toEqual([{ name: 'Kak Ros', email: 'kak.ros@example.com', code: 'UL-NEW0-AAAA-BBBB' }]);
    await w.call('GET', `/api/orders/${c.body.orderId}`);
    expect(w.receipts).toEqual([{ to: 'kak.ros@example.com', item: 'combo', amountSen: 7500, ulCode: 'UL-NEW0-AAAA-BBBB' }]);
    const id = (await w.hub.redeem(codeOf((await w.call('GET', masuk())).location), 'jualanlab', JL_CALLBACK))!.account.id;
    expect((await w.hub.productsOf(id))!.sort()).toEqual(['jualanlab', 'untunglab']);
    expect(await w.hub.untungLabCodeOf(id)).toBe('UL-NEW0-AAAA-BBBB');
    // Owned now: buying again is refused.
    expect((await w.call('POST', '/api/checkout', { item: 'jualanlab', name: 'Kak Ros', phone: '0123456789' })).body.error).toBe('owned');
  });

  it('the second app at the owner price; JualanLab alone issues no UntungLab licence', async () => {
    const w = await makeHub();
    await w.signIn('lama@example.com');
    const c = await w.call('POST', '/api/checkout', { item: 'jualanlab', name: 'Lama', phone: '0123456789' });
    expect(c.body.amountSen).toBe(2900);
    w.pay(c.body.orderId);
    expect((await w.call('GET', `/api/orders/${c.body.orderId}`)).body).toMatchObject({ status: 'paid', ulCode: null });
    expect(w.ulIssued).toEqual([]);
  });

  it('the ToyyibPay callback: checked hash, and still asks ToyyibPay before opening anything', async () => {
    const w = await makeHub();
    await w.signIn();
    const c = await w.call('POST', '/api/checkout', { item: 'untunglab', name: 'Kak Ros', phone: '0123456789' });
    const form = (hash: string) => new URLSearchParams({ status: '1', order_id: c.body.orderId, refno: 'R1', hash }).toString();
    const post = (b: string) => w.hub.fetch(new Request(`${HUB}/api/toyyib/callback`, { method: 'POST', body: b, headers: { 'content-type': 'application/x-www-form-urlencoded' } }));
    expect((await post(form('bad'))).status).toBe(400);
    const good = form(md5(`${CONFIG.toyyibSecret}1${c.body.orderId}R1ok`));
    expect((await post(good)).status).toBe(500); // ToyyibPay has no payment yet
    w.pay(c.body.orderId);
    expect((await post(good)).status).toBe(200);
    expect(w.receipts).toHaveLength(1);
  });

  it('UntungLab down when paid: the account still gets the app, the licence follows on the next check', async () => {
    const w = await makeHub();
    await w.signIn();
    const c = await w.call('POST', '/api/checkout', { item: 'untunglab', name: 'Kak Ros', phone: '0123456789' });
    w.pay(c.body.orderId);
    w.setUlDown(true);
    expect((await w.call('GET', `/api/orders/${c.body.orderId}`)).body).toMatchObject({ status: 'paid', ulCode: null });
    w.setUlDown(false);
    // A check at the same moment (the callback and the buyer's page together) does not issue a second licence.
    expect((await w.call('GET', `/api/orders/${c.body.orderId}`)).body.ulCode).toBeNull();
    w.advance(61_000);
    expect((await w.call('GET', `/api/orders/${c.body.orderId}`)).body.ulCode).toBe('UL-NEW0-AAAA-BBBB');
    await w.call('GET', `/api/orders/${c.body.orderId}`);
    expect(w.ulIssued).toHaveLength(1);
  });

  it('early access: the combo before JualanLab launches gives UntungLab now and JualanLab on the account for launch day', async () => {
    const w = await makeHub({ onSale: { untunglab: true, jualanlab: false, combo: true } });
    await w.signIn();
    const c = await w.call('POST', '/api/checkout', { item: 'combo', name: 'Kak Ros', phone: '0123456789' });
    expect(c.body.amountSen).toBe(7500);
    w.pay(c.body.orderId);
    expect((await w.call('GET', `/api/orders/${c.body.orderId}`)).body).toMatchObject({ status: 'paid', ulCode: 'UL-NEW0-AAAA-BBBB' });
    expect((await w.call('GET', '/akaun')).body).toContain('Opens on launch day, Sunday 25 October 2026');
    expect((await w.call('POST', '/api/checkout', { item: 'jualanlab', name: 'Kak Ros', phone: '0123456789' })).body.error).toBe('owned');
  });

  it('checks the name and phone, and needs a signed-in account', async () => {
    const w = await makeHub();
    expect((await w.call('POST', '/api/checkout', { item: 'untunglab', name: 'A B', phone: '0123456789' })).status).toBe(401);
    expect((await w.call('GET', '/beli?item=untunglab')).location).toBe('/masuk?next=%2Fbeli%3Fitem%3Duntunglab');
    await w.signIn();
    expect((await w.call('POST', '/api/checkout', { item: 'untunglab', name: 'A', phone: '0123456789' })).body.error).toBe('bad_name');
    expect((await w.call('POST', '/api/checkout', { item: 'untunglab', name: 'Ali', phone: '12' })).body.error).toBe('bad_phone');
    expect((await w.call('POST', '/api/checkout', { item: 'everything', name: 'Ali', phone: '0123456789' })).body.error).toBe('bad_item');
  });
});

describe('claiming an UntungLab licence by its code (A-13)', () => {
  it('a licence bought under another email joins this account once, and unlocks the owner price', async () => {
    const w = await makeHub();
    await w.signIn('baru@example.com');
    expect((await w.call('GET', '/akaun')).body).toContain('id="claim"');
    expect((await w.call('POST', '/api/untunglab/claim', { code: 'nonsense' })).body.error).toBe('bad_code');
    expect((await w.call('POST', '/api/untunglab/claim', { code: 'UL-ZZZZ-ZZZZ-ZZZZ' })).body.error).toBe('code_not_found');
    w.setUlDown(true);
    expect((await w.call('POST', '/api/untunglab/claim', { code: 'UL-ABCD-EFGH-JKMN' })).body.error).toBe('untunglab_unavailable');
    w.setUlDown(false);
    // Typed loosely: lower case and spaces are fine.
    expect(await w.call('POST', '/api/untunglab/claim', { code: ' ul-abcd-efgh-jkmn ' })).toMatchObject({ status: 200, body: { ulCode: 'UL-ABCD-EFGH-JKMN' } });
    const page = (await w.call('GET', '/akaun')).body as string;
    expect(page).not.toContain('id="claim"');
    expect(page).toContain('UL-ABCD-EFGH-JKMN');
    expect((await w.call('GET', '/')).body).toContain('/beli?item=jualanlab'); // owner price on offer
    expect((await w.call('POST', '/api/untunglab/claim', { code: 'UL-ABCD-EFGH-JKMN' })).body.error).toBe('already_yours');

    // The same code cannot go on a second account, not even the one with the buyer's own email.
    w.cookie = '';
    await w.signIn('another@example.com');
    expect((await w.call('POST', '/api/untunglab/claim', { code: 'UL-ABCD-EFGH-JKMN' })).body.error).toBe('code_taken');
    w.cookie = '';
    await w.signIn('lama@example.com');
    expect((await w.call('GET', '/akaun')).body).toContain('id="claim"');
  });

  it('needs a signed-in account and is rate limited', async () => {
    const w = await makeHub();
    expect((await w.call('POST', '/api/untunglab/claim', { code: 'UL-ZZZZ-ZZZZ-ZZZZ' })).status).toBe(401);
    await w.signIn('baru@example.com');
    for (let i = 0; i < 10; i++) await w.call('POST', '/api/untunglab/claim', { code: 'UL-ZZZZ-ZZZZ-ZZZZ' });
    expect((await w.call('POST', '/api/untunglab/claim', { code: 'UL-ABCD-EFGH-JKMN' })).body.error).toBe('too_many_requests');
  });
});

describe('real-payment test price (A-14)', () => {
  it('only a tester can buy JualanLab alone at the test price, before launch too', async () => {
    const w = await makeHub({ onSale: { untunglab: true, jualanlab: false, combo: true }, testers: { emails: ['uji@example.com'], jualanlabSen: 100 } });
    await w.signIn('orang@example.com');
    expect((await w.call('POST', '/api/checkout', { item: 'jualanlab', name: 'Orang', phone: '0123456789' })).body.error).toBe('not_on_sale');
    w.cookie = '';
    await w.signIn('uji@example.com');
    const c = await w.call('POST', '/api/checkout', { item: 'jualanlab', name: 'Uji', phone: '0123456789' });
    expect(c.body).toMatchObject({ amountSen: 100 });
    w.pay(c.body.orderId);
    expect((await w.call('GET', `/api/orders/${c.body.orderId}`)).body).toMatchObject({ status: 'paid', amountSen: 100 });
    expect((await w.store.listEntitlements((await w.store.getAccountByEmail('uji@example.com'))!.id)).map((e) => e.product)).toEqual(['jualanlab']);
  });
});

describe('pages', () => {
  it('the sales page lists four apps, two in development with notify-me, and prices for the two available', async () => {
    const w = await makeHub({ onSale: { untunglab: true, jualanlab: false, combo: true } });
    const page = (await w.call('GET', '/')).body as string;
    for (const name of ['UntungLab', 'JualanLab', 'PromoLab', 'KiraLab']) expect(page).toContain(name);
    expect(page).toContain('data-waitlist="promolab"');
    expect(page).toContain('data-waitlist="kiralab"');
    expect(page).toContain('/beli?item=untunglab');
    expect(page).not.toContain('/beli?item=jualanlab');
    // The combo is on sale now as early access.
    expect(page).toContain('/beli?item=combo');
    expect(page).toContain('Early access');
    expect(page).toContain('Launching Sunday 25 October 2026');
    expect((await w.call('POST', '/api/waitlist', { email: 'Minat@Example.com', app: 'promolab' })).status).toBe(200);
    expect(await w.d1.prepare('SELECT email, app FROM waitlist').all()).toMatchObject({ results: [{ email: 'minat@example.com', app: 'promolab' }] });
  });

  it('"Mula Percuma": UntungLab through its click counter; JualanLab only once it is launched', async () => {
    const startFree = (page: string) => [...page.matchAll(/<a class="btn(?: sm)?" href="([^"]+)"><span lang="ms">Mula Percuma<\/span>/g)].map((m) => m[1]);
    const before = await makeHub({
      onSale: { untunglab: true, jualanlab: false, combo: true },
      apps: { ...CONFIG.apps, untunglab: { ...CONFIG.apps.untunglab, tryUrl: 'https://beli.untunglab.space/mula' } },
    });
    // Card and section for UntungLab; nothing for JualanLab before launch.
    expect(startFree((await before.call('GET', '/')).body)).toEqual(['https://beli.untunglab.space/mula', 'https://beli.untunglab.space/mula']);
    const after = await makeHub();
    expect(startFree((await after.call('GET', '/')).body)).toEqual([
      'https://untunglab.space', 'https://jualan.untunglab.space', 'https://untunglab.space', 'https://jualan.untunglab.space',
    ]);
  });

  it('hero is the free-month offer: waiting list before launch, start link after', async () => {
    const before = (await (await makeHub({ onSale: { untunglab: true, jualanlab: false, combo: true } })).call('GET', '/')).body;
    const hero = (page: string) => page.slice(page.indexOf('id="percuma"'), page.indexOf('class="apps"'));
    expect(hero(before)).toContain('percuma sebulan.');
    expect(hero(before)).toContain('data-waitlist="jualanlab"');
    expect(hero(before)).not.toContain('Mula percuma 1 bulan');
    const after = (await (await makeHub()).call('GET', '/')).body;
    expect(hero(after)).toContain('<a class="btn" href="https://jualan.untunglab.space"><span lang="ms">Mula percuma 1 bulan</span>');
    expect(hero(after)).not.toContain('data-waitlist');
  });

  it('privacy and terms are public, and the page script is served', async () => {
    const w = await makeHub();
    expect((await w.call('GET', '/privasi')).body).toContain('Akta Perlindungan Data Peribadi 2010');
    expect((await w.call('GET', '/terma')).body).toContain('Terms of Use');
    expect((await w.call('GET', '/hub.js')).status).toBe(200);
    expect((await w.call('GET', '/akaun')).location).toBe('/masuk?next=%2Fakaun');
  });
});
