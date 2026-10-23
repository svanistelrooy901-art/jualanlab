/**
 * Pre-launch waiting list: jualan.untunglab.space/waitinglist. A plain HTML form that works without JavaScript and
 * without an account, open while PRELAUNCH locks sign-up. BM first, EN with ?lang=en.
 */
import type { Store } from './ports';

export const WAITLIST_BUSINESSES = [
  { id: 'bakery', ms: 'Bakeri', en: 'Bakery' },
  { id: 'packed_food', ms: 'Makanan berbungkus', en: 'Packed food' },
  { id: 'street_food', ms: 'Makanan jalanan', en: 'Street food' },
  { id: 'fashion', ms: 'Fesyen dan pakaian', en: 'Fashion and apparel' },
  { id: 'hobbies', ms: 'Hobi', en: 'Hobbies' },
  { id: 'others', ms: 'Lain-lain', en: 'Others' },
] as const;

export const businessLabel = (id: string, lang: 'ms' | 'en' = 'en') => WAITLIST_BUSINESSES.find((b) => b.id === id)?.[lang] ?? id;

type Lang = 'ms' | 'en';
type Form = { name: string; email: string; business: string };
type Errors = Partial<Record<keyof Form, true>>;

const T = {
  ms: {
    title: 'Senarai menunggu JualanLab',
    desc: 'POS kaunter dan kedai online untuk peniaga kecil. Daftar untuk tahu sebaik sahaja JualanLab dibuka.',
    eyebrow: 'Dilancarkan Ahad, 25 Oktober',
    h1: 'Jadi antara yang terawal guna JualanLab',
    lead: 'POS kaunter dan kedai online untuk peniaga kecil. Daftar sekarang, kami emel anda sebaik sahaja dibuka.',
    points: ['Jual di kaunter, walaupun tiada internet', 'Kedai online dengan pautan dan QR anda sendiri', 'Laporan jualan dan untung harian'],
    name: 'Nama', email: 'Emel', business: 'Jenis perniagaan', pick: 'Pilih satu',
    submit: 'Sertai senarai menunggu',
    privacy: 'Kami guna emel ini untuk berita pelancaran JualanLab sahaja. Tiada spam.',
    errName: 'Tulis nama anda.', errEmail: 'Semak emel ini.', errBusiness: 'Pilih jenis perniagaan.',
    doneH: 'Anda dalam senarai!', doneP: 'Terima kasih. Kami akan emel anda sebaik sahaja JualanLab dibuka.',
    back: 'Daftar emel lain', other: 'English', otherLang: 'en',
  },
  en: {
    title: 'JualanLab waiting list',
    desc: 'Counter POS and online store for small sellers. Sign up to hear the moment JualanLab opens.',
    eyebrow: 'Launching Sunday 25 October',
    h1: 'Be one of the first to use JualanLab',
    lead: 'Counter POS and online store for small sellers. Sign up now and we will email you the moment it opens.',
    points: ['Sell at the counter, even without internet', 'An online store with your own link and QR', 'Daily sales and profit reports'],
    name: 'Name', email: 'Email', business: 'Type of business', pick: 'Choose one',
    submit: 'Join the waiting list',
    privacy: 'We only use this email for JualanLab launch news. No spam.',
    errName: 'Enter your name.', errEmail: 'Check this email.', errBusiness: 'Choose your type of business.',
    doneH: "You're on the list!", doneP: 'Thank you. We will email you the moment JualanLab opens.',
    back: 'Add another email', other: 'Bahasa Melayu', otherLang: 'ms',
  },
} as const;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateWaitlist(f: Form): Errors {
  const e: Errors = {};
  if (f.name.length < 1 || f.name.length > 80) e.name = true;
  if (f.email.length > 200 || !EMAIL.test(f.email)) e.email = true;
  if (!WAITLIST_BUSINESSES.some((b) => b.id === f.business)) e.business = true;
  return e;
}

const LOGO = '<img src="/pwa-192.png" width="40" height="40" alt="" style="display:block">';
const TICK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

const CSS = `*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;background:#F3F6FA;color:#111827;font:16px/1.5 'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif}
.wrap{max-width:460px;margin:0 auto;padding:20px 16px 40px}
.top{display:flex;align-items:center;gap:10px;margin-bottom:20px}.top b{font-size:17px;font-weight:800;flex:1}
.lg{height:40px;padding:0 12px;border-radius:12px;border:1px solid #DCE4EE;background:#fff;color:#111827;font-weight:700;font-size:13px;display:flex;align-items:center;text-decoration:none}
.hero{background:#05070A;color:#fff;border-radius:22px;padding:24px 20px;position:relative;overflow:hidden}
.hero:after{content:'';position:absolute;right:-60px;top:-60px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(58,180,255,.35),transparent 70%)}
.ey{display:inline-block;padding:4px 10px;border-radius:99px;background:rgba(58,180,255,.16);color:#7FD0FF;font-size:12px;font-weight:800;letter-spacing:.02em}
h1{margin:12px 0 0;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-.01em}
.lead{margin:10px 0 0;color:#C9D3DF;font-size:15px}
.pts{list-style:none;margin:16px 0 0;padding:0;display:grid;gap:8px;font-size:14px;color:#E6ECF3}
.pts li{display:flex;gap:10px;align-items:flex-start}.pts svg{color:#3AB4FF;flex:none;margin-top:2px}
.card{margin-top:14px;background:#fff;border:1px solid #DCE4EE;border-radius:20px;padding:20px}
label{display:block;font-size:14px;font-weight:700;margin-bottom:6px}
.f{margin-bottom:14px}
input,select{width:100%;height:50px;padding:0 14px;border-radius:14px;border:1px solid #CBD5E1;background:#fff;color:#111827;font:inherit;font-size:16px}
select{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:40px}
input:focus,select:focus{outline:3px solid #3AB4FF;outline-offset:1px;border-color:#05070A}
.bad input,.bad select{border-color:#B42318}.err{display:block;color:#B42318;font-size:13px;font-weight:600;margin-top:5px}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
button{width:100%;height:54px;border:0;border-radius:14px;background:#05070A;color:#fff;font:inherit;font-weight:800;font-size:16px;cursor:pointer;margin-top:4px}
button:hover{background:#1B2A3D}button:focus-visible,.lg:focus-visible,a:focus-visible{outline:3px solid #3AB4FF;outline-offset:2px}
.note{margin:12px 0 0;font-size:13px;color:#475569;text-align:center}
.done{text-align:center;padding:28px 20px}.ok{width:60px;height:60px;border-radius:50%;background:#E6F6EC;color:#15803D;display:flex;align-items:center;justify-content:center;margin:0 auto}
.ok svg{width:28px;height:28px}.done h2{margin:14px 0 0;font-size:22px;font-weight:800}.done p{margin:8px 0 0;color:#475569}
.done a{display:inline-block;margin-top:16px;color:#05070A;font-weight:700;font-size:14px}
.ft{text-align:center;font-size:12.5px;color:#64748B;margin-top:22px}.ft a{color:#475569}`;

export function waitlistPage(o: { lang: Lang; joined?: boolean; form?: Form; errors?: Errors }): string {
  const t = T[o.lang];
  const f = o.form ?? { name: '', email: '', business: '' };
  const e = o.errors ?? {};
  const q = (lang: Lang) => (lang === 'en' ? '/waitinglist?lang=en' : '/waitinglist');
  const field = (k: keyof Form, inner: string, msg: string) =>
    `<div class="f${e[k] ? ' bad' : ''}"><label for="${k}">${t[k]}</label>${inner}${e[k] ? `<span class="err" id="${k}-err">${msg}</span>` : ''}</div>`;
  const aria = (k: keyof Form) => (e[k] ? ` aria-invalid="true" aria-describedby="${k}-err"` : '');
  const firstBad = (['name', 'email', 'business'] as const).find((k) => e[k]);
  const af = (k: keyof Form) => (firstBad === k ? ' autofocus' : '');
  const body = o.joined
    ? `<div class="card done" role="status"><div class="ok">${TICK}</div><h2>${t.doneH}</h2><p>${t.doneP}</p><a href="${q(o.lang)}">${t.back}</a></div>`
    : `<form class="card" method="post" action="${q(o.lang)}" novalidate>
${field('name', `<input id="name" name="name" autocomplete="name" maxlength="80" required value="${esc(f.name)}"${aria('name')}${af('name')}>`, t.errName)}
${field('email', `<input id="email" name="email" type="email" inputmode="email" autocomplete="email" maxlength="200" required value="${esc(f.email)}"${aria('email')}${af('email')}>`, t.errEmail)}
${field('business', `<select id="business" name="business" required${aria('business')}${af('business')}><option value=""${f.business ? '' : ' selected'} disabled>${t.pick}</option>${WAITLIST_BUSINESSES.map((b) => `<option value="${b.id}"${f.business === b.id ? ' selected' : ''}>${b[o.lang]}</option>`).join('')}</select>`, t.errBusiness)}
<div class="hp" aria-hidden="true"><label for="website">Website</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
<button type="submit">${t.submit}</button>
<p class="note">${t.privacy}</p>
</form>`;
  return `<!doctype html><html lang="${o.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${t.title}</title><meta name="description" content="${t.desc}"><meta property="og:title" content="${t.title}"><meta property="og:description" content="${t.desc}">
<meta name="theme-color" content="#F3F6FA"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap"><style>${CSS}</style></head>
<body><main class="wrap">
<div class="top">${LOGO}<b>JualanLab</b><a class="lg" href="${q(t.otherLang as Lang)}" hreflang="${t.otherLang}">${t.other}</a></div>
<section class="hero"><span class="ey">${t.eyebrow}</span><h1>${t.h1}</h1><p class="lead">${t.lead}</p>
<ul class="pts">${t.points.map((p) => `<li>${TICK}<span>${p}</span></li>`).join('')}</ul></section>
${body}
<p class="ft">JualanLab · Digital Sambal · <a href="https://smelab.untunglab.space">smeLab</a></p>
</main></body></html>`;
}

const HEADERS = {
  'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

export function createWaitlistHandler(d: { store: Pick<Store, 'joinWaitlist'>; now: () => Date }) {
  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const lang: Lang = url.searchParams.get('lang') === 'en' ? 'en' : 'ms';
    const html = (status: number, page: string) => new Response(req.method === 'HEAD' ? null : page, { status, headers: HEADERS });
    if (req.method === 'GET' || req.method === 'HEAD') return html(200, waitlistPage({ lang, joined: url.searchParams.get('joined') === '1' }));
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, POST' } });
    // Only this page may post here (a light guard against forms on other sites).
    const origin = req.headers.get('origin');
    if (origin && origin !== url.origin) return new Response('Forbidden', { status: 403 });
    let data: FormData;
    try {
      data = await req.formData();
    } catch {
      return html(400, waitlistPage({ lang }));
    }
    const s = (k: string) => (typeof data.get(k) === 'string' ? (data.get(k) as string) : '');
    const form: Form = { name: s('name').trim().replace(/\s+/g, ' '), email: s('email').trim().toLowerCase(), business: s('business') };
    const done = new Response(null, { status: 303, headers: { location: `/waitinglist?${lang === 'en' ? 'lang=en&' : ''}joined=1`, 'cache-control': 'no-store' } });
    // Bots fill the hidden field: they see success, nothing is saved.
    if (s('website')) return done;
    const errors = validateWaitlist(form);
    if (Object.keys(errors).length) return html(400, waitlistPage({ lang, form, errors }));
    await d.store.joinWaitlist({ ...form, lang, createdAt: d.now().toISOString() });
    return done;
  };
}
