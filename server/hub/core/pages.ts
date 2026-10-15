/**
 * smeLab pages, server-rendered (BM + EN). Every bilingual string goes through L(); CSS shows one language at a time,
 * chosen on the page and remembered in the browser. Behaviour lives in /hub.js (no inline scripts: strict CSP).
 */
import { PRIVACY, TERMS, type LegalDoc } from '../../../src/legal/content';
import type { Offer } from './offers';
import type { Account, Entitlement, HubConfig, Item, Order, Product } from './ports';

export type Lang = 'ms' | 'en';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const L = (ms: string, en: string) => `<span lang="ms">${ms}</span><span lang="en">${en}</span>`;
const rm = (sen: number) => `RM${(sen / 100).toFixed(sen % 100 === 0 ? 0 : 2)}`;

// ---------- brand ----------

const flask = (inner: string, color: string, size = 40) =>
  `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#0B1016"/><g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" transform="translate(8 7) scale(0.75)"><path d="M20 6h24" stroke-width="5.5"/><path d="M25 6v18L10.5 49.5Q7 57 15.5 58h33Q57 57 53.5 49.5L39 24V6" stroke-width="5.5"/>${inner}</g></svg>`;

const APP_ICON: Record<string, string> = {
  untunglab: flask('<path d="M32 33v20M37 36.5c-1-2-3-3-5-3-3 0-5 1.6-5 4 0 5.5 10 3 10 8.5 0 2.4-2.2 4-5 4-2.4 0-4.4-1-5.4-3" stroke-width="4"/>', '#75F8E8'),
  jualanlab: flask('<rect x="20.5" y="38" width="23" height="13.5" rx="2.5" stroke-width="4"/>', '#3AB4FF'),
  promolab: flask('<path d="M21 46l15-8v17l-15-8zM21 42v9M38 41l5-2M38 47h5M38 53l5 2" stroke-width="3.8"/>', '#FF8AC2'),
  kiralab: flask('<rect x="22" y="36" width="20" height="18" rx="2.5" stroke-width="3.8"/><path d="M26 42h12M26 47h4M34 47h4M26 51h4M34 51h4" stroke-width="3.2"/>', '#FFC857'),
};

const LOGO_INNER = `<svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#75F8E8"/><stop offset="1" stop-color="#3AB4FF"/></linearGradient></defs><g fill="none" stroke="url(#sg)" stroke-linecap="round" stroke-linejoin="round" transform="translate(8 5) scale(0.78)"><path d="M20 6h24" stroke-width="5.5"/><path d="M25 6v18L10.5 49.5Q7 57 15.5 58h33Q57 57 53.5 49.5L39 24V6" stroke-width="5.5"/><path d="M18 44h28" stroke-width="4"/></g></svg><b>sme<i>Lab</i></b>`;
export const SMELAB_LOGO = `<span class="logo">${LOGO_INNER}</span>`;

// ---------- shell ----------

const CSS = `
:root{--ink:#05070A;--ink2:#0D131B;--line:#1C2632;--muted:#9AA6B5;--mint:#75F8E8;--blue:#3AB4FF;--text:#0B1220;--sub:#4A5668;--bg:#F3F6FA;--card:#fff;--good:#15803D;--bad:#B42318}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}[hidden]{display:none!important}
body{margin:0;font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--text);background:var(--bg);line-height:1.55}
html[data-lang=ms] [lang=en],html[data-lang=en] [lang=ms]{display:none!important}
a{color:inherit}.wrap{max-width:68rem;margin:0 auto;padding:0 20px}
.top{position:sticky;top:0;z-index:20;background:rgba(5,7,10,.92);backdrop-filter:blur(8px);color:#fff}
.top .wrap{display:flex;align-items:center;gap:12px;min-height:62px}
.logo{display:inline-flex;align-items:center;gap:8px;text-decoration:none}.logo b{font-size:1.45rem;font-weight:800;letter-spacing:-.02em;color:#fff}
.logo i{font-style:normal;background:linear-gradient(90deg,var(--mint),var(--blue));-webkit-background-clip:text;background-clip:text;color:transparent}
.own .code{white-space:nowrap;font-size:.95rem;letter-spacing:.12em}
.top .right{margin-left:auto;display:flex;gap:10px;align-items:center}
@media (max-width:440px){.top .right{gap:6px}.top .right .wide-only{display:none}}
.lang{display:inline-flex;border:1.5px solid #2A3644;border-radius:999px;overflow:hidden}
.lang button{border:0;background:transparent;color:#B9C4D2;font:700 .8rem system-ui;padding:7px 11px;cursor:pointer;min-height:34px}
html[data-lang=ms] .lang [data-l=ms],html[data-lang=en] .lang [data-l=en]{background:#fff;color:var(--ink)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 20px;border-radius:14px;border:0;font:800 1rem inherit;font-family:inherit;text-decoration:none;cursor:pointer;background:linear-gradient(90deg,var(--mint),var(--blue));color:var(--ink)}
.btn.sm{min-height:38px;padding:0 14px;font-size:.9rem;border-radius:11px}
.btn.ghost{background:transparent;color:#fff;border:1.5px solid #34414F}
.btn.light{background:#fff;color:var(--ink);border:1.5px solid #D5DDE7}
.btn[disabled]{opacity:.5;cursor:default}
.hero{background:var(--ink);color:#fff;padding:54px 0 64px;overflow:hidden}
.eyebrow{font-size:.8rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--mint)}
h1{font-size:clamp(2rem,5.4vw,3.3rem);line-height:1.08;letter-spacing:-.03em;margin:12px 0 16px;font-weight:800}
h1 em,h2 em{font-style:normal;background:linear-gradient(90deg,var(--mint),var(--blue));-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{font-size:1.12rem;color:#C9D3DF;max-width:40rem}
.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
section{padding:60px 0}section.alt{background:#fff}section.dark{background:var(--ink);color:#fff}
h2{font-size:clamp(1.6rem,3.6vw,2.3rem);line-height:1.15;letter-spacing:-.02em;margin:8px 0 10px;font-weight:800}
.sub{color:var(--sub);max-width:44rem;font-size:1.05rem}section.dark .sub{color:#B9C4D2}
.apps{display:grid;gap:14px;margin-top:30px;grid-template-columns:1fr}
.app{background:var(--ink2);border:1px solid var(--line);border-radius:20px;padding:20px;display:flex;flex-direction:column;gap:10px;color:#fff}
.app .h{display:flex;align-items:center;gap:12px}.app h3{margin:0;font-size:1.25rem;font-weight:800}
.app p{margin:0;color:#B9C4D2;font-size:.96rem}
.pill{display:inline-block;border-radius:999px;padding:4px 10px;font-size:.75rem;font-weight:800;letter-spacing:.02em;width:fit-content}
.pill.on{background:rgba(117,248,232,.14);color:var(--mint)}.pill.soon{background:rgba(58,180,255,.14);color:var(--blue)}.pill.dev{background:#1E2733;color:#C3CDD9}
.price .pill.on,.card .pill.on{background:#DDF7F3;color:#0B6B60}.price .pill.soon,.card .pill.soon{background:#E3F1FF;color:#0B5CB8}
.app .go{margin-top:auto;padding-top:6px;font-weight:800;color:#fff;text-decoration:none}
.notify{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto}.notify input{flex:1 1 150px;min-width:0}.notify .btn{flex:1 1 auto}
input,select{font:inherit;min-height:46px;border-radius:12px;border:1.5px solid #CBD5E1;padding:0 12px;background:#fff;color:var(--text);width:100%}
.app input{border-color:#2A3644;background:#0B1016;color:#fff}
.flow{display:grid;gap:12px;margin-top:26px}
.step{background:#fff;border-radius:16px;padding:18px;border:1px solid #E1E7EF}.step b{display:block;font-size:1.05rem}
.feat{display:grid;gap:22px;align-items:center;padding:26px 0}
.feat .tag{font-size:.78rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.feat h3{font-size:1.45rem;margin:6px 0 8px;font-weight:800;letter-spacing:-.01em}.feat p{color:var(--sub);margin:0}
.ul .tag{color:#0F766E}.jl .tag{color:#0B63CE}
.phone{width:min(270px,70vw);margin:0 auto;border-radius:34px;background:#0B1016;padding:9px;box-shadow:0 24px 60px rgba(5,7,10,.25)}
.phone img{display:block;width:100%;height:auto;border-radius:26px}
.apphead{display:flex;align-items:center;gap:14px;margin-bottom:8px}.apphead h2{margin:0}
.prices{display:grid;gap:14px;margin-top:28px}
.price{background:#fff;border:1.5px solid #E1E7EF;border-radius:22px;padding:22px;display:flex;flex-direction:column;gap:10px}
.price.best{border-color:var(--blue);box-shadow:0 10px 30px rgba(58,180,255,.18)}
.price h3{margin:0;font-size:1.2rem;font-weight:800}.price .amt{font-size:2.3rem;font-weight:800;letter-spacing:-.02em}
.price .amt s{font-size:1.1rem;color:#8A94A6;margin-left:8px;font-weight:600}
.price ul{margin:0;padding-left:1.1rem;color:var(--sub)}.price .note{font-size:.88rem;color:var(--sub)}
.price .owned{font-weight:800;color:var(--good)}
.faq details{background:#fff;border:1px solid #E1E7EF;border-radius:14px;padding:14px 16px;margin-top:10px}
.faq summary{font-weight:800;cursor:pointer}.faq p{margin:10px 0 0;color:var(--sub)}
footer{background:var(--ink);color:#9AA6B5;padding:30px 0;font-size:.92rem}footer a{color:#fff}
.card{background:#fff;border-radius:22px;padding:24px;border:1px solid #E1E7EF;max-width:30rem;margin:0 auto}
.narrow{max-width:32rem;margin:0 auto;padding:40px 20px 60px}
label{display:block;font-weight:700;font-size:.92rem;margin:14px 0 6px}
.msg{min-height:1.2em;font-weight:700;color:var(--bad);margin:10px 0 0}.ok{color:var(--good)}
.muted{color:var(--sub)}.small{font-size:.88rem}
.code{font-family:ui-monospace,Menlo,monospace;font-size:1.25rem;letter-spacing:.08em;font-weight:800;background:#EEF4FB;border-radius:10px;padding:8px 12px;display:inline-block}
.own{display:flex;gap:14px;align-items:center;padding:16px 0;border-top:1px solid #E7ECF2}.own:first-of-type{border-top:0}
.own .t{flex:1}.own b{font-size:1.05rem}
.legal h2{font-size:1.2rem;margin-top:26px}.legal ul{padding-left:1.2rem}
@media(min-width:760px){.apps{grid-template-columns:repeat(2,1fr)}.flow{grid-template-columns:repeat(3,1fr)}.feat{grid-template-columns:1fr 1fr}.feat.rev .t{order:2}.prices{grid-template-columns:repeat(3,1fr)}}
@media(min-width:1000px){.apps{grid-template-columns:repeat(4,1fr)}}
`;

function shell(title: string, body: string, opts: { description?: string; dataAttrs?: Record<string, string> } = {}): string {
  const data = Object.entries(opts.dataAttrs ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<!doctype html><html lang="ms" data-lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(opts.description ?? 'smeLab: aplikasi untuk peniaga makanan. UntungLab, JualanLab dan lagi.')}">
<meta name="theme-color" content="#05070A"><link rel="icon" href="/jualanlab-logo.svg"><style>${CSS}</style><script src="/hub.js" defer></script></head>
<body${data}>${body}</body></html>`;
}

const LANG_SWITCH = `<div class="lang" role="group" aria-label="Language"><button type="button" data-l="ms">BM</button><button type="button" data-l="en">EN</button></div>`;

function topBar(account: Account | null, extra = ''): string {
  const who = account
    ? `<a class="btn sm ghost" href="/akaun">${L('Akaun saya', 'My account')}</a>`
    : `<a class="btn sm ghost" href="/masuk?next=%2Fakaun">${L('Log masuk', 'Sign in')}</a>`;
  return `<header class="top"><div class="wrap"><a href="/" class="logo" aria-label="smeLab">${LOGO_INNER}</a><div class="right">${LANG_SWITCH}${extra}${who}</div></div></header>`;
}

const FOOTER = `<footer><div class="wrap">${L('smeLab oleh Digital Sambal. Aplikasi untuk peniaga makanan.', 'smeLab by Digital Sambal. Apps for food businesses.')}<br>${L('Hubungi kami', 'Contact us')}: <a href="mailto:admin@digitalsambal.space">admin@digitalsambal.space</a> · <a href="/privasi">${L('Notis Privasi', 'Privacy Notice')}</a> · <a href="/terma">${L('Terma Penggunaan', 'Terms of Use')}</a></div></footer>`;

// ---------- sales page ----------

export interface SalesPageInput {
  lang: Lang;
  account: Account | null;
  offers: Record<Item, Offer | string>;
  cfg: HubConfig;
}

const ITEM_NAME: Record<Item, [string, string]> = {
  untunglab: ['UntungLab', 'UntungLab'],
  jualanlab: ['JualanLab POS penuh', 'JualanLab full POS'],
  combo: ['UntungLab + JualanLab', 'UntungLab + JualanLab'],
};

function priceCard(item: Item, offer: Offer | string, cfg: HubConfig): string {
  const name = L(...ITEM_NAME[item]);
  const lists: Record<Item, [string, string][]> = {
    untunglab: [
      ['Kos sebenar setiap menu, termasuk operasi dan masa', 'Real cost of every item, running costs and time included'],
      ['Cadangan harga ikut margin', 'Price suggestions by margin'],
      ['2 peranti, data kekal di telefon', '2 devices, data stays on your phone'],
    ],
    jualanlab: [
      ['Kaunter dengan margin setiap item', 'Counter with every item’s margin'],
      ['Buka dan Tutup Hari, Duit ikut sampul, Mod Bazar', 'Open and Close Day, Money Envelopes, Bazaar Mode'],
      ['Terima harga terus dari UntungLab', 'Prices straight from UntungLab'],
    ],
    combo: [
      ['Kedua-dua aplikasi, satu akaun', 'Both apps, one account'],
      ['Harga dan margin mengalir dari UntungLab ke kaunter', 'Prices and margins flow from UntungLab to the counter'],
      ['Satu bayaran, tiada langganan', 'One payment, no subscription'],
    ],
  };
  const items = `<ul>${lists[item].map(([m, e]) => `<li>${L(m, e)}</li>`).join('')}</ul>`;
  let money = '';
  let action = '';
  if (typeof offer === 'string') {
    if (offer === 'owned') {
      action = `<p class="owned">${L('Sudah dalam akaun anda', 'Already on your account')}</p>`;
    } else if (offer === 'owns_one') {
      action = `<p class="note">${L('Anda sudah ada satu aplikasi. Beli yang satu lagi pada harga pemilik, ' + rm(cfg.prices.secondAppSen) + '.', 'You already own one app. Get the other at the owner price, ' + rm(cfg.prices.secondAppSen) + '.')}</p>`;
    } else {
      money = item === 'untunglab' ? '' : `<div class="amt">${item === 'combo' ? rm(cfg.prices.comboSen) : rm(cfg.prices.jualanlab.earlySen)}</div>`;
      action = `<span class="pill soon">${L('Dilancarkan awal November 2026', 'Launching early November 2026')}</span>`;
    }
  } else {
    const was = offer.fullSen > offer.amountSen ? `<s>${rm(offer.fullSen)}</s>` : '';
    const why =
      offer.kind === 'early'
        ? `<span class="pill on">${L('Harga Early Bird', 'Early Bird price')}</span>`
        : offer.kind === 'second'
          ? `<span class="pill on">${L('Harga pemilik', 'Owner price')}</span>`
          : offer.kind === 'combo'
            ? `<span class="pill on">${L('Jimat ' + rm(offer.fullSen - offer.amountSen), 'Save ' + rm(offer.fullSen - offer.amountSen))}</span>`
            : '';
    // Before JualanLab's launch, buying it (in the combo, or at the owner price) is early access.
    const early = item !== 'untunglab' && !cfg.onSale.jualanlab;
    const earlyNote = early
      ? `<p class="note"><span class="pill on">${L('Akses awal', 'Early access')}</span> ${L('UntungLab dibuka sebaik bayar. JualanLab dibuka pada hari pelancaran, awal November 2026.', 'UntungLab opens as soon as you pay. JualanLab opens on launch day, early November 2026.')}</p>`
      : '';
    money = `${why}<div class="amt">${rm(offer.amountSen)}${was}</div>${earlyNote}`;
    action = `<a class="btn" href="/beli?item=${item}">${L('Beli', 'Buy')} ${rm(offer.amountSen)}</a>`;
  }
  return `<div class="price${item === 'combo' ? ' best' : ''}"><h3>${name}</h3>${money}<p class="note">${L('Bayar sekali. Tiada langganan bulanan.', 'Pay once. No monthly subscription.')}</p>${items}${action}</div>`;
}

const feat = (cls: string, rev: boolean, tagM: string, tagE: string, hM: string, hE: string, pM: string, pE: string, img: string, alt: string) =>
  `<div class="feat ${cls}${rev ? ' rev' : ''}"><div class="t"><div class="tag">${L(tagM, tagE)}</div><h3>${L(hM, hE)}</h3><p>${L(pM, pE)}</p></div><div><div class="phone"><img src="/sales/${img}" alt="${esc(alt)}" loading="lazy" width="540" height="1168"></div></div></div>`;

export function salesPage(p: SalesPageInput): string {
  const { cfg, offers } = p;
  const jlOn = cfg.onSale.jualanlab;
  const app = (id: string, nameM: string, nameE: string, pill: string, dM: string, dE: string, foot: string) =>
    `<div class="app" id="app-${id}"><div class="h">${APP_ICON[id]}<h3>${L(nameM, nameE)}</h3></div>${pill}<p>${L(dM, dE)}</p>${foot}</div>`;
  const notify = (id: string) =>
    `<form class="notify" data-waitlist="${id}"><input type="email" required placeholder="email@contoh.com" aria-label="Email"><button class="btn sm" type="submit">${L('Maklumkan saya', 'Notify me')}</button></form><p class="msg small" data-for="${id}" role="status"></p>`;

  const body = `${topBar(p.account, `<a class="btn sm wide-only" href="#harga">${L('Harga', 'Prices')}</a>`)}
<div class="hero"><div class="wrap">
 <div class="eyebrow">${L('Untuk peniaga makanan rumah dan kecil', 'For home and small food businesses')}</div>
 <h1>${L('Kira kos dengan betul. <em>Jual dengan yakin.</em>', 'Count your costs right. <em>Sell with confidence.</em>')}</h1>
 <p class="lead">${L('smeLab ialah set aplikasi yang saling berhubung untuk perniagaan makanan: dari kos resipi, ke kaunter jualan, hingga promosi dan akaun. Satu akaun untuk semuanya.', 'smeLab is a set of connected apps for food businesses: from recipe costs, to the sales counter, to promotions and books. One account for all of them.')}</p>
 <div class="cta"><a class="btn" href="#harga">${L('Lihat harga', 'See prices')}</a><a class="btn ghost" href="#untunglab">${L('Kenali aplikasi', 'Meet the apps')}</a></div>
 <div class="apps">
  ${app('untunglab', 'UntungLab', 'UntungLab', `<span class="pill on">${L('Tersedia', 'Available')}</span>`, 'Kos sebenar setiap menu dan harga yang patut dijual.', 'The real cost of every item and the price to charge.', `<a class="go" href="#untunglab">${L('Lihat UntungLab', 'See UntungLab')} →</a>`)}
  ${app('jualanlab', 'JualanLab', 'JualanLab', jlOn ? `<span class="pill on">${L('Tersedia', 'Available')}</span>` : `<span class="pill soon">${L('Awal November 2026', 'Early November 2026')}</span>`, 'Kaunter jualan yang tahu untung setiap item.', 'A sales counter that knows the profit on every item.', `<a class="go" href="#jualanlab">${L('Lihat JualanLab', 'See JualanLab')} →</a>`)}
  ${app('promolab', 'PromoLab', 'PromoLab', `<span class="pill dev">${L('Dalam pembangunan', 'In development')}</span>`, 'Promosi dan pelanggan setia, disambung dengan jualan anda.', 'Promotions and loyal customers, linked to your sales.', notify('promolab'))}
  ${app('kiralab', 'KiraLab', 'KiraLab', `<span class="pill dev">${L('Dalam pembangunan', 'In development')}</span>`, 'Buku akaun ringkas, sedia untuk LHDN.', 'Simple bookkeeping, ready for LHDN.', notify('kiralab'))}
 </div>
</div></div>

<section><div class="wrap">
 <div class="eyebrow" style="color:#0B63CE">${L('Saling berhubung', 'Connected')}</div>
 <h2>${L('Satu akaun. <em>Aplikasi yang bercakap antara satu sama lain.</em>', 'One account. <em>Apps that talk to each other.</em>')}</h2>
 <div class="flow">
  <div class="step"><b>1. UntungLab</b><span class="muted">${L('Kira kos sebenar dan tetapkan harga dengan margin yang sihat.', 'Work out real costs and set prices with a healthy margin.')}</span></div>
  <div class="step"><b>2. ${L('Hantar ke JualanLab', 'Send to JualanLab')}</b><span class="muted">${L('Satu ketikan: harga dan margin terus masuk ke kaunter.', 'One tap: prices and margins go straight to the counter.')}</span></div>
  <div class="step"><b>3. JualanLab</b><span class="muted">${L('Jual, nampak untung hari ini, dan asingkan duit modal dan untung.', 'Sell, see today’s profit, and keep capital and profit apart.')}</span></div>
 </div>
</div></section>

<section class="alt ul" id="untunglab"><div class="wrap">
 <div class="apphead">${APP_ICON.untunglab}<h2>UntungLab</h2></div>
 <p class="sub">${L('Jual RM6, untung sebenar berapa? UntungLab kira kos sebenar setiap menu: bahan, pembungkusan, masa dan kos operasi seperti sewa dan api.', 'Selling at RM6, what do you really earn? UntungLab works out the real cost of every item: ingredients, packaging, your time and running costs like rent and power.')}</p>
 ${feat('ul', false, 'Bahan', 'Ingredients', 'Isi harga pek. Kos seunit keluar sendiri.', 'Enter the pack price. Unit cost appears by itself.', 'Beli butter 250 g RM12? UntungLab tahu itu RM48 sekilogram dan kira kosnya dalam resipi anda.', 'Bought 250 g of butter for RM12? UntungLab knows that is RM48 a kilo and works out its cost in your recipe.', 'ul-bahan.jpg', 'UntungLab: bahan')}
 ${feat('ul', true, 'Hasil', 'Results', 'Untung sebenar. Bukan tekaan.', 'Real profit. Not guesswork.', 'Kos sebenar, untung sebiji dan margin, dengan status jelas seperti Margin Sihat atau Menu Ini Rugi.', 'Real cost, profit per piece and margin, with clear statuses like Healthy Margin or This Item Loses Money.', 'ul-hasil.jpg', 'UntungLab: hasil')}
 ${feat('ul', false, 'Cadangan harga', 'Price suggestion', 'Pilih margin. Harga terus keluar.', 'Pick a margin. The price appears.', 'Nak untung 30% atau 40%? Satu ketikan dan UntungLab beritahu harga yang patut dijual.', 'Want 30% or 40%? One tap and UntungLab tells you the price to charge.', 'ul-cadangan.jpg', 'UntungLab: cadangan harga')}
 <p class="muted small">${L('Data resipi dan harga kekal di telefon anda. Boleh digunakan tanpa internet. Cuba percuma di', 'Recipes and prices stay on your phone. Works without internet. Try it free at')} <a href="${esc(cfg.apps.untunglab.tryUrl || cfg.apps.untunglab.url)}">untunglab.space</a>.</p>
</div></section>

<section class="jl" id="jualanlab"><div class="wrap">
 <div class="apphead">${APP_ICON.jualanlab}<h2>JualanLab</h2></div>
 <p class="sub">${L('Kaunter jualan untuk telefon anda, yang tahu untung setiap item kerana harganya datang dari UntungLab.', 'A sales counter on your phone that knows the profit on every item, because its prices come from UntungLab.')}${jlOn ? '' : ` <b>${L('Dilancarkan awal November 2026.', 'Launching early November 2026.')}</b>`}</p>
 ${feat('jl', false, 'Kaunter', 'Counter', 'Jual pantas. Nampak margin setiap item.', 'Sell fast. See every item’s margin.', 'Ketik item, terima tunai dengan baki, QR DuitNow atau e-wallet. Diskaun 5, 10 atau 15% dengan margin baharu dikira terus.', 'Tap items, take cash with change, DuitNow QR or e-wallet. Discounts of 5, 10 or 15% with the new margin worked out on the spot.', 'jl-kaunter.jpg', 'JualanLab: kaunter')}
 ${feat('jl', true, 'Tutup Hari', 'Close Day', 'Duit ikut sampul.', 'Money Envelopes.', 'Buka dan Tutup Hari walaupun lepas tengah malam. Kira tunai, dan asingkan modal untuk beli bahan semula daripada untung anda.', 'Open and Close Day, even past midnight. Count the cash, and set apart the capital to buy ingredients again from your profit.', 'jl-tutup.jpg', 'JualanLab: Tutup Hari')}
 ${feat('jl', false, 'Mod Bazar', 'Bazaar Mode', 'Butang besar untuk bazar dan pasar malam.', 'Big buttons for bazaars and night markets.', 'Satu ketikan untuk setiap item dan bayaran. Berfungsi tanpa internet; jualan dihantar bila talian kembali.', 'One tap per item and per payment. Works without internet; sales are sent when the connection is back.', 'jl-bazar.jpg', 'JualanLab: Mod Bazar')}
 ${feat('jl', true, 'Resit', 'Receipts', 'Resit gambar terus ke WhatsApp.', 'Picture receipts straight to WhatsApp.', 'Kongsi resit yang kemas kepada pelanggan, dan muat turun jualan anda dalam CSV bila-bila masa.', 'Share a tidy receipt with your customer, and download your sales as CSV any time.', 'jl-resit.jpg', 'JualanLab: resit')}
 ${jlOn ? '' : `<div class="card" style="margin-top:10px"><b>${L('Mahu tahu bila JualanLab dilancarkan?', 'Want to know when JualanLab launches?')}</b>${notify('jualanlab').replace('class="notify"', 'class="notify" style="margin-top:10px"').replace(/class="msg small"/, 'class="msg small"')}</div>`}
</div></section>

<section class="alt" id="harga"><div class="wrap">
 <div class="eyebrow" style="color:#0B63CE">${L('Harga', 'Prices')}</div>
 <h2>${L('Beli satu, atau <em>kedua-duanya sekali</em>.', 'Buy one, or <em>both together</em>.')}</h2>
 <p class="sub">${L(`Sudah ada satu aplikasi? Yang kedua hanya ${rm(cfg.prices.secondAppSen)}, terus pada akaun anda.`, `Already own one app? The second is only ${rm(cfg.prices.secondAppSen)}, straight on your account.`)}</p>
 <div class="prices">${priceCard('untunglab', offers.untunglab, cfg)}${priceCard('jualanlab', offers.jualanlab, cfg)}${priceCard('combo', offers.combo, cfg)}</div>
 <p class="muted small" style="margin-top:16px">${L('Bayaran selamat melalui ToyyibPay (FPX). Bayaran balik penuh dalam 7 hari.', 'Secure payment through ToyyibPay (FPX). Full refund within 7 days.')}</p>
</div></section>

<section class="faq"><div class="wrap" style="max-width:46rem">
 <h2>${L('Soalan lazim', 'FAQ')}</h2>
 ${faq('Apa itu akaun smeLab?', 'What is a smeLab account?', 'Satu akaun (emel anda) untuk semua aplikasi smeLab. Log masuk sekali; aplikasi lain terus terbuka. Semua pembelian anda ada pada akaun itu.', 'One account (your email) for every smeLab app. Sign in once; the other apps open straight away. All your purchases sit on that account.')}
 ${faq('Saya sudah beli UntungLab dengan kod lesen. Perlu buat apa?', 'I already bought UntungLab with a licence code. What do I do?', 'Tiada apa-apa. Kod anda terus berfungsi. Jika anda log masuk ke smeLab dengan emel yang sama, lesen anda muncul dalam akaun dan anda layak harga pemilik untuk JualanLab.', 'Nothing. Your code keeps working. If you sign in to smeLab with the same email, your licence shows in your account and you get the owner price for JualanLab.')}
 ${faq('Adakah ada yuran bulanan?', 'Is there a monthly fee?', 'Tidak. Setiap aplikasi dibayar sekali sahaja.', 'No. Each app is paid for once.')}
 ${faq('Bagaimana dengan bayaran balik?', 'What about refunds?', 'Dalam 7 hari selepas pembelian, emel admin@digitalsambal.space atau balas emel resit anda, dan kami pulangkan bayaran penuh.', 'Within 7 days of purchase, email admin@digitalsambal.space or reply to your receipt, and we refund you in full.')}
 ${faq('Perlukah internet?', 'Do I need internet?', 'UntungLab berfungsi tanpa internet selepas dipasang. JualanLab boleh menjual tanpa internet dan menghantar jualan bila talian kembali.', 'UntungLab works without internet once installed. JualanLab can sell without internet and sends sales when the connection is back.')}
</div></section>
${FOOTER}`;
  return shell('smeLab: UntungLab, JualanLab dan lagi', body, { description: 'Aplikasi untuk peniaga makanan: kira kos dengan UntungLab, jual dengan JualanLab. Satu akaun smeLab.' });
}

const faq = (qm: string, qe: string, am: string, ae: string) => `<details><summary>${L(qm, qe)}</summary><p>${L(am, ae)}</p></details>`;

// ---------- sign in ----------

const APP_LABEL: Record<string, string> = { untunglab: 'UntungLab', jualanlab: 'JualanLab' };

export function signInPage(p: { lang: Lang; cfg: HubConfig; app?: string | null; signedInAs?: string | null; error?: 'bad_app' }): string {
  if (p.error) {
    return shell('smeLab', `${topBar(null)}<div class="narrow"><div class="card"><h2>${L('Pautan log masuk tidak sah', 'This sign-in link is not valid')}</h2><p class="muted">${L('Buka semula aplikasi dan cuba lagi.', 'Open the app again and try once more.')}</p><a class="btn" href="/">smeLab</a></div></div>${FOOTER}`);
  }
  const to = p.app ? APP_LABEL[p.app] ?? '' : '';
  const heading = to ? L(`Log masuk untuk teruskan ke ${to}`, `Sign in to continue to ${to}`) : L('Log masuk ke smeLab', 'Sign in to smeLab');
  const signedIn = p.signedInAs
    ? `<div id="as"><p>${L('Anda log masuk sebagai', 'You are signed in as')} <b>${esc(p.signedInAs)}</b>.</p><button class="btn" type="button" id="cont" style="width:100%">${L('Teruskan', 'Continue')}</button><button class="btn light" type="button" id="switch" style="width:100%;margin-top:10px">${L('Log keluar dan guna akaun lain', 'Sign out and use another account')}</button></div>`
    : '';
  const form = `<div id="signin"${p.signedInAs ? ' hidden' : ''}>
  <div id="g"></div>
  <form id="ef"><label for="email">${L('Emel', 'Email')}</label><input id="email" type="email" inputmode="email" autocomplete="email" required placeholder="nama@contoh.com">
   <button class="btn" type="submit" style="width:100%;margin-top:12px" id="send">${L('Hantar kod', 'Send code')}</button>
   <p class="muted small">${L('Tiada kata laluan. Kami hantar kod 6 digit ke emel anda.', 'No password. We send a 6-digit code to your email.')}</p></form>
  <form id="cf" hidden><p class="muted" id="sentto"></p><label for="code">${L('Kod 6 digit', '6-digit code')}</label><input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required style="font-size:1.6rem;letter-spacing:.4em;text-align:center">
   <button class="btn" type="submit" style="width:100%;margin-top:12px" id="verify">${L('Log masuk', 'Sign in')}</button>
   <button class="btn light" type="button" id="back" style="width:100%;margin-top:10px">${L('Guna emel lain', 'Use another email')}</button></form>
  <p class="msg" id="m" role="alert"></p>
 </div>`;
  const body = `${topBar(null)}<div class="narrow"><div class="card">
 <h2 style="margin-top:0">${heading}</h2>
 <p class="muted">${L('Satu akaun untuk UntungLab, JualanLab dan semua aplikasi smeLab.', 'One account for UntungLab, JualanLab and every smeLab app.')}</p>
 ${signedIn}${form}
 <p class="muted small" style="margin-top:18px">${L('Dengan log masuk, anda bersetuju dengan', 'By signing in, you agree to the')} <a href="/terma">${L('Terma Penggunaan', 'Terms of Use')}</a> ${L('dan', 'and the')} <a href="/privasi">${L('Notis Privasi', 'Privacy Notice')}</a>.</p>
</div></div>${FOOTER}`;
  return shell('Log masuk · smeLab', body, { dataAttrs: { page: 'signin', google: p.cfg.googleClientId } });
}

// ---------- account ----------

export function accountPage(p: { lang: Lang; account: Account; products: Product[]; complimentary: boolean; entitlements: Entitlement[]; orders: Order[]; cfg: HubConfig }): string {
  const ul = p.entitlements.find((e) => e.product === 'untunglab' && !e.revokedAt);
  const has = (x: Product) => p.products.includes(x);
  const row = (id: Product, name: string, ownedText: string, extra: string, open: string, buy: string) =>
    `<div class="own">${APP_ICON[id]}<div class="t"><b>${name}</b><br>${has(id) ? `<span class="ok">${ownedText}</span>${extra}` : `<span class="muted">${L('Belum dimiliki', 'Not owned yet')}</span>`}</div>${has(id) ? open : buy}</div>`;
  const ulExtra = ul?.ulCode ? `<br><span class="muted small">${L('Kod lesen', 'Licence code')}:</span> <span class="code">${esc(ul.ulCode)}</span>` : '';
  const orders = p.orders.filter((o) => o.status === 'paid');
  const body = `${topBar(p.account)}<div class="narrow">
 <div class="card">
  <h2 style="margin-top:0">${L('Akaun saya', 'My account')}</h2>
  <p class="muted">${esc(p.account.email)}${p.complimentary ? ` · <span class="ok">${L('Akaun pemilik', 'Owner account')}</span>` : ''}</p>
  ${row('untunglab', 'UntungLab', L('Dimiliki', 'Owned'), ulExtra, `<a class="btn sm" href="${esc(p.cfg.apps.untunglab.url)}">${L('Buka', 'Open')}</a>`, `<a class="btn sm light" href="/beli?item=untunglab">${L('Beli', 'Buy')}</a>`)}
  ${row('jualanlab', 'JualanLab', L('POS penuh', 'Full POS'), p.cfg.onSale.jualanlab ? '' : `<br><span class="muted small">${L('Dibuka pada hari pelancaran, awal November 2026', 'Opens on launch day, early November 2026')}</span>`, p.cfg.onSale.jualanlab ? `<a class="btn sm" href="${esc(p.cfg.apps.jualanlab.url)}">${L('Buka', 'Open')}</a>` : `<span class="pill soon">${L('Awal Nov', 'Early Nov')}</span>`, p.cfg.onSale.jualanlab || (has('untunglab') && p.cfg.onSale.combo) ? `<a class="btn sm light" href="/beli?item=jualanlab">${L('Beli', 'Buy')}</a>` : `<span class="pill soon">${L('Awal Nov', 'Early Nov')}</span>`)}
 </div>
 ${orders.length ? `<div class="card" style="margin-top:14px"><h3 style="margin-top:0">${L('Pembelian', 'Purchases')}</h3>${orders.map((o) => `<p class="small"><b>${L(...ITEM_NAME[o.item])}</b> · ${rm(o.amountSen)} · ${esc((o.paidAt ?? o.createdAt).slice(0, 10))}<br><span class="muted">${L('No. pesanan', 'Order no.')} ${esc(o.id)}</span></p>`).join('')}</div>` : ''}
 <div style="text-align:center;margin-top:18px"><button class="btn light" type="button" id="logout">${L('Log keluar', 'Sign out')}</button></div>
</div>${FOOTER}`;
  return shell('Akaun saya · smeLab', body, { dataAttrs: { page: 'account' } });
}

// ---------- checkout ----------

export function checkoutPage(p: { lang: Lang; account: Account; item: Item; offer: Offer | string; buyingOpen: boolean }): string {
  const name = L(...ITEM_NAME[p.item]);
  let inner: string;
  if (typeof p.offer === 'string' || !p.buyingOpen) {
    const why =
      p.offer === 'owned'
        ? L('Aplikasi ini sudah ada dalam akaun anda.', 'This is already on your account.')
        : p.offer === 'owns_one'
          ? L('Anda sudah memiliki satu aplikasi. Beli yang satu lagi pada harga pemilik.', 'You already own one app. Buy the other at the owner price.')
          : L('Belum boleh dibeli. Cuba sebentar lagi.', 'Not on sale yet. Please check back soon.');
    inner = `<h2 style="margin-top:0">${name}</h2><p>${why}</p><a class="btn" href="/akaun">${L('Akaun saya', 'My account')}</a> <a class="btn light" href="/#harga">${L('Harga', 'Prices')}</a>`;
  } else {
    const o = p.offer;
    const was = o.fullSen > o.amountSen ? ` <s class="muted">${rm(o.fullSen)}</s>` : '';
    inner = `<h2 style="margin-top:0">${name}</h2>
  <p style="font-size:2rem;font-weight:800;margin:6px 0">${rm(o.amountSen)}${was}</p>
  <p class="muted">${L('Untuk akaun', 'For the account')} <b>${esc(p.account.email)}</b>. ${L('Bayar sekali; terus dibuka pada akaun anda.', 'One payment; it opens on your account straight away.')}</p>
  <form id="pay"><label for="n">${L('Nama', 'Name')}</label><input id="n" autocomplete="name" required maxlength="80">
   <label for="p">${L('Nombor telefon', 'Phone number')}</label><input id="p" type="tel" autocomplete="tel" required maxlength="20" placeholder="012-345 6789">
   <button class="btn" type="submit" style="width:100%;margin-top:16px" id="paybtn">${L('Bayar', 'Pay')} ${rm(o.amountSen)}</button><p class="msg" id="m" role="alert"></p></form>
  <p class="muted small">${L('Bayaran selamat melalui ToyyibPay (FPX). Bayaran balik penuh dalam 7 hari.', 'Secure payment through ToyyibPay (FPX). Full refund within 7 days.')}</p>`;
  }
  return shell('Beli · smeLab', `${topBar(p.account)}<div class="narrow"><div class="card">${inner}</div></div>${FOOTER}`, { dataAttrs: { page: 'checkout', item: p.item } });
}

export function donePage(p: { lang: Lang; orderId: string; cfg: HubConfig }): string {
  const body = `${topBar(null)}<div class="narrow"><div class="card" id="done">
 <h2 style="margin-top:0" id="dh">${L('Menunggu pengesahan bayaran…', 'Waiting for payment confirmation…')}</h2>
 <p class="muted" id="dt">${L('Ini biasanya beberapa saat sahaja. Jangan tutup halaman ini.', 'This usually takes a few seconds. Keep this page open.')}</p>
 <div id="ul" hidden><p class="muted small">${L('Kod lesen UntungLab anda (juga dihantar melalui emel)', 'Your UntungLab licence code (also sent by email)')}:</p><p class="code" id="ulcode"></p></div>
 <div id="open" hidden style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
  ${p.cfg.onSale.jualanlab ? `<a class="btn" id="o-jualanlab" href="${esc(p.cfg.apps.jualanlab.url)}" hidden>${L('Buka JualanLab', 'Open JualanLab')}</a>` : `<p class="note" id="o-jualanlab" hidden>${L('JualanLab dibuka pada hari pelancaran, awal November 2026. Kami akan emel anda.', 'JualanLab opens on launch day, early November 2026. We will email you.')}</p>`}
  <a class="btn" id="o-untunglab" href="${esc(p.cfg.apps.untunglab.url)}" hidden>${L('Buka UntungLab', 'Open UntungLab')}</a>
  <a class="btn light" href="/akaun">${L('Akaun saya', 'My account')}</a>
 </div>
</div></div>${FOOTER}`;
  return shell('Terima kasih · smeLab', body, { dataAttrs: { page: 'done', order: /^[0-9a-f]{32}$/.test(p.orderId) ? p.orderId : '' } });
}

// ---------- legal ----------

export function legalPage(p: { lang: Lang; doc: 'privacy' | 'terms' }): string {
  const docs = p.doc === 'privacy' ? PRIVACY : TERMS;
  const one = (d: LegalDoc, lang: Lang) =>
    `<div lang="${lang}"><h1 style="font-size:2rem">${esc(d.title)}</h1><p class="muted">${esc(d.updated)}</p><p>${esc(d.intro)}</p>${d.sections
      .map((s) => `<h2>${esc(s.heading)}</h2>${s.bullets ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}${(s.paragraphs ?? []).map((x) => `<p>${esc(x)}</p>`).join('')}`)
      .join('')}</div>`;
  return shell(`${docs.ms.title} · smeLab`, `${topBar(null)}<div class="narrow legal">${one(docs.ms, 'ms')}${one(docs.en, 'en')}</div>${FOOTER}`);
}

// ---------- page script ----------

export const HUB_JS = `(function(){
var html=document.documentElement,b=document.body;
var l='ms';try{var s=localStorage.getItem('sm-lang');if(s==='en'||s==='ms')l=s;}catch(e){}
if(new URLSearchParams(location.search).get('lang')==='en')l='en';
function setLang(x){html.dataset.lang=x;html.lang=x;try{localStorage.setItem('sm-lang',x);}catch(e){}}
setLang(l);
function T(ms,en){return html.dataset.lang==='en'?en:ms;}
document.addEventListener('DOMContentLoaded',function(){
 b=document.body;
 document.querySelectorAll('.lang button').forEach(function(x){x.addEventListener('click',function(){setLang(x.dataset.l);});});
 function post(u,d){return fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)}).then(function(r){return r.json().catch(function(){return {};}).then(function(j){j._s=r.status;return j;});});}
 function q(id){return document.getElementById(id);}
 // Notify me
 document.querySelectorAll('form[data-waitlist]').forEach(function(f){f.addEventListener('submit',function(ev){ev.preventDefault();
  var app=f.dataset.waitlist,m=document.querySelector('.msg[data-for="'+app+'"]'),i=f.querySelector('input');
  post('/api/waitlist',{email:i.value,app:app}).then(function(j){m.className='msg small'+(j._s===200?' ok':'');m.textContent=j._s===200?T('Terima kasih. Kami akan maklumkan anda.','Thank you. We will let you know.'):T('Semak alamat emel anda.','Please check your email address.');}).catch(function(){m.textContent=T('Tiada sambungan internet.','No internet connection.');});
 });});
 var page=b.dataset.page;
 if(page==='signin'){
  var email='',m=q('m');
  function done(){location.reload();}
  if(q('cont'))q('cont').onclick=function(){var u=new URL(location.href);u.searchParams.delete('pilih');location.href=u.toString();};
  if(q('switch'))q('switch').onclick=function(){post('/api/auth/logout',{}).then(function(){q('as').hidden=true;q('signin').hidden=false;var u=new URL(location.href);u.searchParams.delete('pilih');history.replaceState(null,'',u.toString());});};
  q('ef').addEventListener('submit',function(ev){ev.preventDefault();m.textContent='';email=q('email').value.trim();q('send').disabled=true;
   post('/api/auth/email/start',{email:email,lang:html.dataset.lang}).then(function(j){q('send').disabled=false;
    if(j._s===200){q('ef').hidden=true;q('cf').hidden=false;q('sentto').textContent=T('Kod dihantar ke ','Code sent to ')+email+(j.devCode?' ('+j.devCode+')':'');q('code').focus();}
    else m.textContent=j.error==='bad_email'?T('Alamat emel tidak sah.','That email address is not valid.'):j.error==='too_many_requests'?T('Terlalu banyak cubaan. Cuba sebentar lagi.','Too many tries. Please wait a little.'):T('Kod tidak dapat dihantar. Cuba lagi.','The code could not be sent. Try again.');
   }).catch(function(){q('send').disabled=false;m.textContent=T('Tiada sambungan internet.','No internet connection.');});});
  q('back').onclick=function(){q('cf').hidden=true;q('ef').hidden=false;m.textContent='';};
  q('cf').addEventListener('submit',function(ev){ev.preventDefault();m.textContent='';q('verify').disabled=true;
   post('/api/auth/email/verify',{email:email,code:q('code').value}).then(function(j){q('verify').disabled=false;
    if(j._s===200)return done();
    m.textContent=j.error==='wrong_code'?T('Kod salah. Cubaan tinggal: ','Wrong code. Tries left: ')+j.attemptsLeft:j.error==='code_expired'?T('Kod sudah tamat. Minta kod baharu.','The code has expired. Ask for a new one.'):T('Tidak dapat log masuk. Cuba lagi.','Could not sign in. Try again.');
   }).catch(function(){q('verify').disabled=false;m.textContent=T('Tiada sambungan internet.','No internet connection.');});});
  var gid=b.dataset.google;
  if(gid){var sc=document.createElement('script');sc.src='https://accounts.google.com/gsi/client';sc.async=true;sc.onload=function(){
   google.accounts.id.initialize({client_id:gid,ux_mode:'popup',callback:function(r){post('/api/auth/google',{credential:r.credential}).then(function(j){if(j._s===200)done();else m.textContent=T('Google tidak dapat mengesahkan akaun ini.','Google could not confirm this account.');});}});
   google.accounts.id.renderButton(q('g'),{theme:'outline',size:'large',shape:'pill',text:'continue_with',width:320});};document.head.appendChild(sc);}
 }
 if(page==='account'){q('logout').onclick=function(){post('/api/auth/logout',{}).then(function(){location.href='/';});};}
 if(page==='checkout'&&q('pay')){var pm=q('m');q('pay').addEventListener('submit',function(ev){ev.preventDefault();pm.textContent='';q('paybtn').disabled=true;
  post('/api/checkout',{item:b.dataset.item,name:q('n').value,phone:q('p').value}).then(function(j){
   if(j._s===200&&j.payUrl){location.href=j.payUrl;return;}q('paybtn').disabled=false;
   pm.textContent=j.error==='bad_phone'?T('Semak nombor telefon anda, contoh 012-345 6789.','Check your phone number, e.g. 012-345 6789.'):j.error==='bad_name'?T('Masukkan nama anda.','Enter your name.'):j.error==='owned'||j.error==='owns_one'?T('Harga sudah berubah untuk akaun anda. Muat semula halaman.','The price changed for your account. Reload the page.'):T('Bayaran tidak dapat dimulakan sekarang. Cuba sebentar lagi.','Payment cannot be started right now. Try again shortly.');
  }).catch(function(){q('paybtn').disabled=false;pm.textContent=T('Tiada sambungan internet.','No internet connection.');});});}
 if(page==='done'&&b.dataset.order){var n=0;(function poll(){fetch('/api/orders/'+b.dataset.order).then(function(r){return r.json();}).then(function(j){
   if(j.status==='paid'){q('dh').textContent=T('Terima kasih! Bayaran diterima.','Thank you! Payment received.');q('dt').textContent=T('Aplikasi sudah dibuka pada akaun smeLab anda. Resit dihantar ke emel anda.','The app is now open on your smeLab account. A receipt is on its way to your email.');
    q('open').hidden=false;if(j.item!=='untunglab')q('o-jualanlab').hidden=false;if(j.item!=='jualanlab')q('o-untunglab').hidden=false;if(j.ulCode){q('ul').hidden=false;q('ulcode').textContent=j.ulCode;}return;}
   if(++n<40)setTimeout(poll,3000);else q('dt').textContent=T('Belum disahkan lagi. Jika anda sudah membayar, ia akan muncul dalam Akaun saya sebentar lagi.','Not confirmed yet. If you have paid, it will appear in My account shortly.');
  }).catch(function(){if(++n<40)setTimeout(poll,3000);});})();}
});
})();`;
