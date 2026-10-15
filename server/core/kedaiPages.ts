/**
 * Kedai storefront pages (DECISIONS K-12, direction B "Warung Moden"): drawn on the server so they arrive ready on
 * cheap phones and give proper link previews. One small script (KEDAI_JS) runs the cart, the item sheet and checkout.
 * Everything a seller or customer typed is escaped; data for the script is embedded as JSON with "<" escaped.
 */
import type { Order, StoreSettings } from '../../src/domain/kedai';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const rm = (sen: number) => `RM${(sen / 100).toFixed(2)}`;
const L = (ms: string, en: string) => `<span lang="ms">${ms}</span><span lang="en">${en}</span>`;
const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

export interface StoreItemView {
  id: string;
  name: string;
  description: string;
  category: string | null;
  priceSen: number;
  /** Price after the running promotion, when one applies. */
  promo: { name: string; priceSen: number; label: string } | null;
  badge: 'baru' | 'pedas' | 'laris' | null;
  featured: boolean;
  /** Link to the item's photo, when the seller added one. */
  photo: string | null;
  /** How many are left; null = not counted. 0 = shown as "Habis" and cannot be ordered. */
  stock: number | null;
}

export interface StoreView {
  shopName: string;
  base: string; // "/dapur-mak-long"
  settings: StoreSettings;
  brand: string; // readable brand colour
  items: StoreItemView[];
  /** Links to the shop's logo and header photo, when the seller added them. */
  logo: string | null;
  cover: string | null;
  origin: string; // for the link-preview image, which must be a full address
}

const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@400;500;600;700;800&display=swap';

function css(brand: string): string {
  return `:root{--b:${brand};--ink:#1E1512;--mut:#75685F;--bg:#F6F3EF;--card:#FFFFFF;--soft:#F0EBE6;--sun:#FFD23F;--sun2:#FFE8A3}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--ink);font-family:Figtree,system-ui,sans-serif;font-size:15px;line-height:1.45}
html[data-lang=ms] [lang=en],html[data-lang=en] [lang=ms]{display:none}
a{color:inherit;text-decoration:none}button,input,select,textarea{font:inherit;color:inherit}
.wrap{max-width:560px;margin:0 auto;min-height:100vh;position:relative;padding-bottom:110px}
.h{font-family:'Bricolage Grotesque',Figtree,sans-serif;font-weight:800;letter-spacing:-.02em}
.top{background:var(--b);color:#fff;padding:18px 20px 24px;border-radius:0 0 28px 28px}
.row{display:flex;align-items:center;gap:10px}.sp{justify-content:space-between}
.logo{width:52px;height:52px;border-radius:16px;background:#fff;color:var(--b);display:flex;align-items:center;justify-content:center;font-size:20px;overflow:hidden;flex:none}.logo img{width:100%;height:100%;object-fit:cover;display:block}
.top.cov{background:linear-gradient(180deg,rgba(18,10,6,.30) 0%,rgba(18,10,6,.18) 35%,rgba(18,10,6,.78) 100%),var(--cv) center/cover no-repeat,var(--b)}.top.cov h1{margin-top:92px;text-shadow:0 2px 14px rgba(0,0,0,.35)}.top.cov p{text-shadow:0 1px 8px rgba(0,0,0,.4)}.top.cov .facts div{background:rgba(255,255,255,.16);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.logo.bd{box-shadow:0 4px 16px rgba(0,0,0,.18)}
.pill{border:0;border-radius:999px;padding:8px 12px;background:rgba(255,255,255,.18);color:#fff;font-weight:700;font-size:13px;cursor:pointer;min-height:36px}
.top h1{margin:16px 0 6px;font-size:38px;line-height:1}.top p{margin:0;opacity:.92}
.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:16px}.facts div{background:rgba(255,255,255,.14);border-radius:14px;padding:9px 10px}
.facts small{display:block;font-size:11.5px;opacity:.85}.facts b{font-size:14px}
.ann{margin:14px 16px 0;padding:13px 16px;border-radius:18px;background:var(--sun2);font-size:14.5px}
.closed{margin:14px 16px 0;padding:13px 16px;border-radius:18px;background:#1E1512;color:#fff;font-size:14.5px}
.cats{display:flex;gap:8px;padding:16px 16px 4px;overflow-x:auto;scrollbar-width:none;position:sticky;top:0;background:var(--bg);z-index:5}
.cats a{flex:none;padding:10px 16px;border-radius:999px;background:#fff;font-weight:700;font-size:14px}.cats a.on{background:var(--ink);color:#fff}
h2{margin:22px 20px 10px;font-size:24px}
.list{display:grid;gap:10px;padding:0 16px}
.it{display:flex;gap:12px;align-items:center;padding:10px;border-radius:20px;background:var(--card);cursor:pointer;width:100%;border:0;text-align:left}
.ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.ph{position:relative;overflow:hidden;width:92px;height:92px;border-radius:16px;background:color-mix(in srgb,var(--b) 14%,#fff);color:var(--b);display:flex;align-items:center;justify-content:center;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:30px}
.it .t{flex:1;min-width:0}.it .n{font-weight:800;font-size:16px}.it .d{font-size:13px;color:var(--mut);margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pr{margin-top:6px;font-weight:800;font-size:15px}.pr s{color:var(--mut);font-weight:500;margin-left:4px}
.tag{display:inline-block;padding:3px 8px;border-radius:8px;font-size:11.5px;font-weight:800;background:var(--ink);color:#fff}
.tag.p{background:var(--sun);color:var(--ink)}.tag.s{background:var(--sun2);color:var(--ink)}
.it.out .ph,.it.out .t,.feat.out .ph{opacity:.5;filter:grayscale(.6)}.tag.o{background:#5B524C;color:#fff}.stk{display:block;font-size:12px;font-weight:700;color:var(--mut);margin-top:2px}.stk.low{color:var(--b)}
.add{flex:none;width:44px;height:44px;border-radius:999px;background:var(--b);color:#fff;border:0;font-size:24px;font-weight:700;cursor:pointer}
.feat{margin:14px 16px 0;border-radius:24px;overflow:hidden;background:var(--card);cursor:pointer;display:block;width:calc(100% - 32px);border:0;padding:0;text-align:left}
.feat .ph{width:100%;height:170px;border-radius:0;font-size:56px;position:relative}
.sticker{position:absolute;top:14px;left:14px;padding:8px 12px;border-radius:12px;background:var(--sun);color:var(--ink);font-size:15px;transform:rotate(-3deg)}
.feat .in{padding:14px 16px 16px;display:flex;align-items:center;gap:12px}
.foot{padding:28px 20px 10px;text-align:center;font-size:12.5px;color:var(--mut)}.foot a{text-decoration:underline}
.bar{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;width:min(528px,calc(100% - 32px));height:60px;border-radius:999px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 8px 0 22px;z-index:20;box-shadow:0 10px 30px rgba(30,21,18,.25)}
.bar[hidden]{display:none}.bar .go{height:46px;padding:0 20px;border-radius:999px;background:var(--b);display:inline-flex;align-items:center;font-weight:800}
.bump{animation:bump .25s}@keyframes bump{50%{transform:translateX(-50%) scale(1.04)}}
dialog{border:0;padding:0;width:100%;max-width:560px;margin:auto auto 0;border-radius:28px 28px 0 0;background:var(--bg);max-height:92vh}
dialog::backdrop{background:rgba(30,21,18,.55)}
.sh .ph{width:100%;height:220px;border-radius:0;font-size:64px}
.sh .bd{padding:18px 20px 24px}.sh h3{margin:0 0 6px;font-size:28px;line-height:1.05}
.x{position:absolute;top:12px;right:12px;width:44px;height:44px;border-radius:999px;background:#fff;border:0;cursor:pointer;font-size:20px}
label.f{display:block;margin:14px 2px 6px;font-size:13.5px;font-weight:700}
.in1{width:100%;height:48px;border-radius:16px;border:0;background:#fff;padding:0 14px;font-size:15px}
textarea.in1{height:auto;padding:12px 14px;resize:none}
.qty{display:flex;align-items:center;background:#fff;border-radius:999px;height:54px;padding:0 4px}.qty button{width:46px;height:46px;border-radius:999px;border:0;background:var(--soft);font-size:22px;font-weight:700;cursor:pointer}.qty span{width:34px;text-align:center;font-weight:800;font-size:18px}
.big{flex:1;height:54px;border-radius:999px;border:0;background:var(--b);color:#fff;font-weight:800;font-size:16px;cursor:pointer}
.big[disabled]{opacity:.5}
.box{margin:12px 16px 0;padding:16px;border-radius:24px;background:#fff}
.box h3{margin:0 0 10px;font-size:19px}
.seg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.opt{display:block;padding:13px;border-radius:16px;background:var(--soft);cursor:pointer;font-weight:800}
.opt small{display:block;font-weight:600;color:var(--mut);font-size:12.5px}
input[type=radio]{position:absolute;opacity:0}input[type=radio]:checked+.opt{background:color-mix(in srgb,var(--b) 10%,#fff);outline:2px solid var(--b)}
input[type=radio]:focus-visible+.opt{outline:3px solid var(--ink)}
.ln{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--soft)}.ln:last-child{border:0}
.sm{width:34px;height:34px;border-radius:999px;border:0;background:var(--soft);font-weight:800;cursor:pointer}
.tot{margin:12px 16px 0;padding:16px;border-radius:24px;background:var(--ink);color:#fff}
.err{margin:12px 16px 0;padding:12px 14px;border-radius:16px;background:#FDE2DD;color:#8A1C0A;font-weight:700}
.err:empty{display:none}
.mut{color:var(--mut)}
.qr{margin:16px auto 0;width:220px;height:220px;border-radius:20px;background:var(--bg);padding:12px}.qr img{width:100%;height:100%;object-fit:contain;border-radius:8px;background:#fff}
.steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin-top:16px}.steps i{height:6px;border-radius:99px;background:rgba(255,255,255,.25)}.steps i.on{background:#fff}
:focus-visible{outline:3px solid var(--ink);outline-offset:2px}`;
}

function shell(title: string, brand: string, body: string, opts: { description?: string; noindex?: boolean; image?: string } = {}): string {
  return `<!doctype html><html lang="ms" data-lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>${opts.description ? `<meta name="description" content="${esc(opts.description)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(opts.description)}">` : ''}
${opts.image ? `<meta property="og:image" content="${esc(opts.image)}"><meta name="twitter:card" content="summary_large_image">` : ''}${opts.noindex ? '<meta name="robots" content="noindex">' : ''}<meta name="theme-color" content="${brand}">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${FONTS}"><style>${css(brand)}</style></head>
<body>${body}<script src="/_k/app.js" defer></script></body></html>`;
}

const initials = (name: string) => esc(name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join(''));
/** The item's photo when it has one (lazy below the fold), its initials otherwise. */
const photoInner = (i: StoreItemView) => (i.photo ? `<img src="${esc(i.photo)}" alt="" loading="lazy" decoding="async">` : initials(i.name));
/** The shop's logo when it has one, its initials otherwise. */
const logoInner = (logo: string | null, shopName: string) => (logo ? `<img src="${esc(logo)}" alt="${esc(shopName)}">` : initials(shopName));

const langSwitch = `<button class="pill" type="button" data-lang-switch>${L('EN', 'BM')}</button>`;

function priceHtml(i: StoreItemView): string {
  return i.promo ? `${rm(i.promo.priceSen)}<s>${rm(i.priceSen)}</s>` : rm(i.priceSen);
}

/** "Stok 12" under the price; "Tinggal 3" in the brand colour when few are left. */
function stockHtml(i: StoreItemView): string {
  if (i.stock === null || i.stock === 0) return '';
  return i.stock <= 5 ? `<span class="stk low">${L(`Tinggal ${i.stock}`, `Only ${i.stock} left`)}</span>` : `<span class="stk">${L(`Stok ${i.stock}`, `${i.stock} in stock`)}</span>`;
}

function badgeHtml(i: StoreItemView): string {
  if (i.stock === 0) return `<span class="tag o">${L('Habis', 'Sold out')}</span>`;
  if (i.promo) return `<span class="tag p">${esc(i.promo.label)}</span>`;
  if (i.badge === 'laris') return `<span class="tag">${L('Laris', 'Best seller')}</span>`;
  if (i.badge === 'baru') return `<span class="tag s">${L('Baru', 'New')}</span>`;
  if (i.badge === 'pedas') return `<span class="tag s">${L('Pedas', 'Spicy')}</span>`;
  return '';
}

export function storePage(v: StoreView): string {
  const s = v.settings;
  const cats = new Map<string, StoreItemView[]>();
  for (const i of v.items) {
    const k = i.category ?? '';
    cats.set(k, [...(cats.get(k) ?? []), i]);
  }
  const catNames = [...cats.keys()];
  const anchor = (_c: string, n: number) => `c${n}`;
  const featured = v.items.find((i) => i.featured) ?? v.items.find((i) => i.promo) ?? null;
  const fulfil = [s.pickup.on ? L('Ambil', 'Pickup') : '', s.delivery.on ? L('Hantar', 'Delivery') : ''].filter(Boolean).join(' · ');
  const minFee = s.delivery.on && s.delivery.areas.length ? Math.min(...s.delivery.areas.map((a) => a.feeSen)) : null;
  const body = `<div class="wrap">
<header class="top${v.cover ? ' cov' : ''}"${v.cover ? ` style="--cv:url('${esc(v.cover)}')"` : ''}>
 <div class="row sp"><div class="logo h${v.cover ? ' bd' : ''}">${logoInner(v.logo, v.shopName)}</div>${langSwitch}</div>
 <h1 class="h">${esc(v.shopName)}</h1>${s.tagline ? `<p>${esc(s.tagline)}</p>` : ''}
 <div class="facts">
  <div><small>${L('Status', 'Status')}</small><b>${s.open ? L('Buka', 'Open') : L('Tutup', 'Closed')}</b></div>
  <div><small>${L('Cara terima', 'Get it by')}</small><b>${fulfil}</b></div>
  <div><small>${minFee !== null ? L('Hantar dari', 'Delivery from') : L('Ambil di', 'Pickup at')}</small><b>${minFee !== null ? rm(minFee) : esc(s.pickup.address.split(',').slice(-1)[0]?.trim() || '—')}</b></div>
 </div>
</header>
${!s.open ? `<div class="closed">${L('Kedai tutup sementara. Anda boleh lihat menu, tetapi belum boleh memesan.', 'The store is closed for now. You can browse, but not order yet.')}</div>` : s.announcement ? `<div class="ann">${esc(s.announcement)}</div>` : ''}
${catNames.length > 1 ? `<nav class="cats" aria-label="${'Kategori'}">${catNames.map((c, n) => `<a href="#${anchor(c, n)}"${n === 0 ? ' class="on"' : ''}>${c ? esc(c) : L('Lain-lain', 'Others')}</a>`).join('')}</nav>` : ''}
${featured ? `<button class="feat${featured.stock === 0 ? ' out' : ''}" type="button" data-open="${esc(featured.id)}"><div class="ph">${photoInner(featured)}${featured.promo ? `<span class="sticker h">${esc(featured.promo.label)}</span>` : ''}</div><div class="in"><div style="flex:1"><div class="h" style="font-size:21px">${esc(featured.name)}</div><div class="pr" style="font-size:16px">${priceHtml(featured)}</div>${featured.stock === 0 ? `<span class="tag o" style="margin-top:6px">${L('Habis', 'Sold out')}</span>` : stockHtml(featured)}</div>${featured.stock === 0 ? '' : '<span class="add" aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center">+</span>'}</div></button>` : ''}
${catNames.map((c, n) => `<section id="${anchor(c, n)}"><h2 class="h">${c ? esc(c) : L('Lain-lain', 'Others')}</h2><div class="list">${(cats.get(c) ?? []).map((i) => `<div class="it${i.stock === 0 ? ' out' : ''}" data-open="${esc(i.id)}" role="button" tabindex="0" aria-label="${esc(i.name)}"><div class="ph">${photoInner(i)}</div><div class="t">${badgeHtml(i)}<div class="n">${esc(i.name)}</div>${i.description ? `<div class="d">${esc(i.description)}</div>` : ''}<div class="pr">${priceHtml(i)}</div>${stockHtml(i)}</div>${s.open && i.stock !== 0 ? `<button class="add" type="button" data-add="${esc(i.id)}" aria-label="${esc(`Tambah ${i.name}`)}">+</button>` : ''}</div>`).join('')}</div></section>`).join('')}
${s.about ? `<div class="box" style="margin-top:22px"><h3 class="h">${L('Tentang kami', 'About us')}</h3><div class="mut" style="white-space:pre-line">${esc(s.about)}</div></div>` : ''}
<div class="foot">${s.pickup.on && s.pickup.address ? `${L('Ambil di', 'Pickup at')} ${esc(s.pickup.address)}${s.pickup.hours ? ` · ${esc(s.pickup.hours)}` : ''}${s.pickup.mapUrl ? ` · <a href="${esc(s.pickup.mapUrl)}" rel="noopener" target="_blank">${L('Peta', 'Map')}</a>` : ''}<br>` : ''}
${s.whatsapp ? `<a href="https://wa.me/${esc(s.whatsapp)}" rel="noopener" target="_blank">WhatsApp</a>` : ''}${s.instagram ? ` · <a href="https://instagram.com/${esc(s.instagram)}" rel="noopener" target="_blank">Instagram</a>` : ''}${s.tiktok ? ` · <a href="https://www.tiktok.com/@${esc(s.tiktok)}" rel="noopener" target="_blank">TikTok</a>` : ''}${s.facebook ? ` · <a href="https://facebook.com/${esc(s.facebook)}" rel="noopener" target="_blank">Facebook</a>` : ''}
<br><br>${L('Dibuat dengan', 'Made with')} <a href="https://smelab.untunglab.space/#jualanlab">JualanLab</a> · smeLab</div>
<a class="bar" id="bar" href="${esc(v.base)}/troli" hidden><span><b id="barN">0</b> item · <b id="barT">RM0.00</b></span><span class="go">${L('Troli', 'Cart')} →</span></a>
<dialog id="sheet" aria-label="Item"><div class="sh" id="sheetBody"></div></dialog>
</div>
<script type="application/json" id="kd">${json({ page: 'store', base: v.base, open: s.open, items: v.items.map((i) => ({ id: i.id, name: i.name, description: i.description, priceSen: i.priceSen, promo: i.promo, photo: i.photo, stock: i.stock })) })}</script>`;
  return shell(`${v.shopName}${s.tagline ? ` · ${s.tagline}` : ''}`, v.brand, body, { description: s.tagline || `Tempah dari ${v.shopName}`, image: v.cover ? v.origin + v.cover : v.logo ? v.origin + v.logo : undefined });
}

export function checkoutPage(v: StoreView): string {
  const s = v.settings;
  const both = s.pickup.on && s.delivery.on;
  const body = `<div class="wrap">
<div class="row" style="padding:16px 16px 6px"><a href="${esc(v.base)}" class="logo" style="width:44px;height:44px;border-radius:999px;font-size:18px" aria-label="${'Kembali ke kedai'}">←</a><h1 class="h" style="margin:0;font-size:28px">${L('Troli', 'Cart')}</h1></div>
<form id="co" novalidate>
<div class="box"><div id="lines"></div><a href="${esc(v.base)}" style="display:block;padding-top:8px;font-weight:700;color:var(--b)">+ ${L('Tambah item lain', 'Add more items')}</a></div>
<div class="box"><h3 class="h">1 · ${both ? L('Ambil atau hantar?', 'Pickup or delivery?') : s.delivery.on ? L('Penghantaran', 'Delivery') : L('Ambil sendiri', 'Pickup')}</h3>
 <div class="seg">
  ${s.pickup.on ? `<label><input type="radio" name="fulfilment" value="pickup"${s.delivery.on ? '' : ' checked'}><span class="opt">${L('Ambil sendiri', 'Pickup')}<small>${esc(s.pickup.address || '')}</small></span></label>` : ''}
  ${s.delivery.on ? `<label><input type="radio" name="fulfilment" value="delivery"${s.pickup.on ? '' : ' checked'}><span class="opt">${L('Hantar', 'Delivery')}<small>${s.delivery.areas.length === 1 ? `${esc(s.delivery.areas[0]!.name)} · ${rm(s.delivery.areas[0]!.feeSen)}` : L('Ikut kawasan', 'By area')}</small></span></label>` : ''}
 </div>
 ${s.delivery.on ? `<div id="dl" hidden>
  <label class="f" for="area">${L('Kawasan', 'Area')}</label><select class="in1" id="area" name="area">${s.delivery.areas.map((a) => `<option value="${esc(a.name)}" data-fee="${a.feeSen}">${esc(a.name)} · ${rm(a.feeSen)}</option>`).join('')}</select>
  <label class="f" for="address">${L('Alamat', 'Address')}</label><textarea class="in1" id="address" name="address" rows="2" maxlength="200" autocomplete="street-address"></textarea>
  ${s.delivery.note ? `<div class="mut" style="font-size:13px;margin-top:6px">${esc(s.delivery.note)}</div>` : ''}
 </div>` : ''}
</div>
<div class="box"><h3 class="h">2 · ${L('Siapa?', 'Your details')}</h3>
 <label class="f" for="name">${L('Nama', 'Name')}</label><input class="in1" id="name" name="name" maxlength="60" autocomplete="name" required>
 <label class="f" for="phone">${L('No. WhatsApp', 'WhatsApp number')}</label><input class="in1" id="phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="012-345 6789" required>
 <label class="f" for="note">${L('Nota untuk kedai (pilihan)', 'Note for the store (optional)')}</label><input class="in1" id="note" name="note" maxlength="200">
 <div class="mut" style="font-size:12.5px;margin-top:8px">${L('Disimpan dalam telefon ini untuk tempahan seterusnya.', 'Kept on this phone for next time.')}</div>
</div>
${s.payAtPickup ? `<div class="box"><h3 class="h">3 · ${L('Cara bayar', 'Payment')}</h3><div class="seg">
 <label><input type="radio" name="pay" value="qr" checked><span class="opt">DuitNow QR<small>${L('Bayar sekarang', 'Pay now')}</small></span></label>
 <label><input type="radio" name="pay" value="at_pickup"><span class="opt">${L('Bayar semasa terima', 'Pay on collection')}<small>${L('Tunai atau QR', 'Cash or QR')}</small></span></label>
</div></div>` : '<input type="hidden" name="pay" value="qr">'}
<div class="tot"><div class="row sp mut" style="color:rgba(255,255,255,.8)"><span>${L('Item', 'Items')}</span><span id="sub">RM0.00</span></div><div class="row sp" id="feeRow" style="color:rgba(255,255,255,.8)" hidden><span>${L('Penghantaran', 'Delivery')}</span><span id="fee">RM0.00</span></div>
 <div class="row sp" style="margin-top:8px"><b>${L('Jumlah', 'Total')}</b><span class="h" style="font-size:30px" id="total">RM0.00</span></div><div id="saved" style="font-size:13px;color:var(--sun)"></div></div>
<p class="err" id="err" role="alert"></p>
<div style="position:sticky;bottom:0;padding:12px 16px 20px;background:var(--bg)"><button class="big" style="width:100%" id="send" type="submit">${L('Hantar pesanan', 'Place order')} →</button>
<div class="mut" style="font-size:12.5px;text-align:center;margin-top:8px">${L('Bayaran terus kepada', 'You pay')} ${esc(v.shopName)}${L('.', ' directly.')}</div></div>
</form></div>
<script type="application/json" id="kd">${json({ page: 'checkout', base: v.base, open: s.open, minOrderSen: s.minOrderSen, items: v.items.map((i) => ({ id: i.id, name: i.name, priceSen: i.priceSen, promo: i.promo, stock: i.stock })) })}</script>`;
  return shell(`Troli · ${v.shopName}`, v.brand, body, { noindex: true });
}

const STATUS_TEXT: Record<Order['status'], [string, string]> = {
  awaiting_payment: ['Menunggu semakan bayaran', 'Waiting for payment check'],
  confirmed: ['Disahkan', 'Confirmed'],
  preparing: ['Sedang disediakan', 'Being prepared'],
  ready: ['Sedia', 'Ready'],
  done: ['Selesai', 'Completed'],
  cancelled: ['Dibatalkan', 'Cancelled'],
};

export function orderPage(p: { shopName: string; base: string; brand: string; settings: StoreSettings; order: Order; hasQr: boolean; logo: string | null; now: Date }): string {
  const o = p.order;
  const s = p.settings;
  const idx = ['awaiting_payment', 'confirmed', 'preparing', 'ready', 'done'].indexOf(o.status);
  const ready = o.status === 'ready' ? (o.fulfilment === 'pickup' ? L('Sedia diambil', 'Ready for pickup') : L('Dalam penghantaran', 'Out for delivery')) : L(...STATUS_TEXT[o.status]);
  const mins = o.expiresAt ? Math.max(0, Math.round((Date.parse(o.expiresAt) - p.now.getTime()) / 60000)) : null;
  const waText = encodeURIComponent(`Salam, saya dah bayar pesanan ${o.number} (${rm(o.totalSen)}). Ini bukti bayaran:`);
  const pay = o.status === 'awaiting_payment' ? `<div class="box" style="margin-top:-48px;position:relative;text-align:center;border-radius:26px">
 <div style="font-size:13px;font-weight:800;color:var(--mut)">${L('BAYAR DENGAN DUITNOW QR', 'PAY BY DUITNOW QR')}</div>
 <div class="h" style="font-size:46px">${rm(o.totalSen)}</div>
 <div style="display:inline-block;margin-top:4px;padding:6px 12px;border-radius:10px;background:var(--sun2);font-weight:700">${L('Rujukan', 'Reference')}: ${esc(o.number)}</div>
 ${p.hasQr ? `<div class="qr"><img src="${esc(p.base)}/qr" alt="DuitNow QR ${esc(p.shopName)}"></div>
 <div class="seg" style="margin-top:12px"><a class="opt" style="text-align:center" href="${esc(p.base)}/qr" download="QR-${esc(p.shopName)}.png">${L('Simpan QR', 'Save QR')}</a><button class="opt" type="button" data-copy="${esc(o.number)}" style="border:0">${L('Salin rujukan', 'Copy reference')}</button></div>` : `<p class="mut">${L('Kedai akan hantar butiran bayaran melalui WhatsApp.', 'The store will send payment details by WhatsApp.')}</p>`}
 ${s.whatsapp ? `<a class="big" style="display:flex;align-items:center;justify-content:center;margin-top:10px" href="https://wa.me/${esc(s.whatsapp)}?text=${waText}" target="_blank" rel="noopener">${L('Dah bayar? Hantar bukti', 'Paid? Send proof')}</a>` : ''}
 ${mins !== null ? `<div class="mut" style="font-size:12.5px;margin-top:10px">${L(`Tiada bayaran dalam ${mins} minit, pesanan dibatalkan sendiri.`, `No payment within ${mins} minutes and the order cancels itself.`)}</div>` : ''}
</div>
<div class="box" style="background:var(--ink);color:#fff;font-size:13.5px">${L('Bayaran terus kepada', 'Payment goes straight to')} <b>${esc(p.shopName)}</b>. ${L('JualanLab tidak memegang wang anda.', 'JualanLab never holds your money.')}</div>` : '';
  const body = `<div class="wrap">
<header class="top" style="padding-bottom:${o.status === 'awaiting_payment' ? 70 : 24}px">
 <div class="row sp"><a href="${esc(p.base)}" class="row" style="font-weight:700"><span class="logo h" style="width:34px;height:34px;border-radius:10px;font-size:13px">${logoInner(p.logo, p.shopName)}</span>${esc(p.shopName)}</a>${langSwitch}</div>
 <div style="margin-top:18px;font-size:13px;font-weight:700;opacity:.85">${L('PESANAN', 'ORDER')}</div>
 <div class="h" style="font-size:52px;line-height:1">${esc(o.number)}</div>
 ${o.status === 'cancelled' ? '' : `<div class="steps">${[0, 1, 2, 3, 4].map((n) => `<i${n <= idx ? ' class="on"' : ''}></i>`).join('')}</div>`}
 <div style="margin-top:8px;font-weight:800;font-size:16px">${ready}</div>
 ${o.status === 'cancelled' && o.cancelReason ? `<div style="font-size:13.5px;opacity:.9">${o.cancelReason === 'expired' ? L('Tiada bayaran dalam masa yang ditetapkan.', 'No payment in time.') : esc(o.cancelReason)}</div>` : ''}
</header>
${pay}
<div class="box"><div class="h" style="font-size:18px;margin-bottom:8px">${o.fulfilment === 'pickup' ? L('Ambil sendiri', 'Pickup') : L('Penghantaran', 'Delivery')}</div>
 <div class="mut">${o.fulfilment === 'pickup' ? `${esc(s.pickup.address)}${s.pickup.hours ? ` · ${esc(s.pickup.hours)}` : ''}${s.pickup.mapUrl ? ` · <a href="${esc(s.pickup.mapUrl)}" target="_blank" rel="noopener" style="text-decoration:underline">${L('Peta', 'Map')}</a>` : ''}` : `${esc(o.address)} · ${esc(o.area)}`}</div>
 <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #E2DAD3">
 ${o.lines.map((l) => `<div class="row sp" style="padding:3px 0"><span>${l.quantity}× ${esc(l.name)}${l.note ? ` <span class="mut">(${esc(l.note)})</span>` : ''}${l.promoName ? `<br><small style="color:var(--b);font-weight:700">${esc(l.promoName)}</small>` : ''}</span><b>${rm(l.unitPriceSen * l.quantity)}</b></div>`).join('')}
 ${o.deliverySen ? `<div class="row sp mut" style="padding:3px 0"><span>${L('Penghantaran', 'Delivery')}</span><span>${rm(o.deliverySen)}</span></div>` : ''}
 <div class="row sp" style="padding-top:6px"><b>${L('Jumlah', 'Total')}</b><b>${rm(o.totalSen)}</b></div>
 ${o.pay === 'at_pickup' ? `<div class="mut" style="font-size:13px;margin-top:6px">${L('Bayar semasa terima.', 'Pay on collection.')}</div>` : ''}
 </div></div>
<div class="foot">${L('Simpan pautan ini untuk semak status pesanan.', 'Keep this link to check your order.')}<br><br>${L('Dibuat dengan', 'Made with')} <a href="https://smelab.untunglab.space/#jualanlab">JualanLab</a></div>
</div>
<script type="application/json" id="kd">${json({ page: 'order', status: o.status, updatedAt: o.updatedAt })}</script>`;
  return shell(`${o.number} · ${p.shopName}`, p.brand, body, { noindex: true });
}

export function notFoundPage(): string {
  return shell('Kedai tidak dijumpai', '#1E1512', `<div class="wrap" style="padding:60px 24px;text-align:center"><h1 class="h" style="font-size:32px">${L('Kedai tidak dijumpai', 'Store not found')}</h1><p class="mut">${L('Semak pautan dengan penjual.', 'Check the link with the seller.')}</p><p><a href="https://smelab.untunglab.space" style="text-decoration:underline">smeLab</a></p></div>`, { noindex: true });
}

/** The storefront script: language, cart (kept on this phone), item sheet, checkout and order refresh. Plain ES2017. */
export const KEDAI_JS = `(function(){
var d=document,h=d.documentElement,data={};try{data=JSON.parse(d.getElementById('kd').textContent)}catch(e){}
function T(ms,en){return h.dataset.lang==='en'?en:ms}
function get(k,def){try{var v=localStorage.getItem(k);return v?JSON.parse(v):def}catch(e){return def}}
function put(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
var lang=get('kedai:lang','ms');h.dataset.lang=lang;h.lang=lang;
d.querySelectorAll('[data-lang-switch]').forEach(function(b){b.onclick=function(){lang=h.dataset.lang==='en'?'ms':'en';h.dataset.lang=lang;h.lang=lang;put('kedai:lang',lang)}});
function rm(s){return 'RM'+(s/100).toFixed(2)}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
var byId={};(data.items||[]).forEach(function(i){byId[i.id]=i});
var key='kedai:cart:'+data.base;
function cart(){return get(key,[]).filter(function(l){return byId[l.itemId]&&l.quantity>0})}
function save(c){put(key,c);bar()}
function price(i){return i.promo?i.promo.priceSen:i.priceSen}
function totals(c){var n=0,t=0,saved=0;c.forEach(function(l){var i=byId[l.itemId];n+=l.quantity;t+=price(i)*l.quantity;if(i.promo)saved+=(i.priceSen-i.promo.priceSen)*l.quantity});return {n:n,t:t,saved:saved}}
function inCart(id,c){var n=0;(c||cart()).forEach(function(l){if(l.itemId===id)n+=l.quantity});return n}
function left(id,c){var i=byId[id];return i&&i.stock!=null?Math.max(0,i.stock-inCart(id,c)):9999}
function toast(m){var t=d.getElementById('toast');if(!t){t=d.createElement('div');t.id='toast';t.setAttribute('role','status');t.style.cssText='position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:#1E1512;color:#fff;padding:10px 16px;border-radius:999px;font-weight:700;font-size:14px;z-index:60;max-width:90vw;text-align:center';d.body.appendChild(t)}t.textContent=m;t.hidden=false;clearTimeout(t._h);t._h=setTimeout(function(){t.hidden=true},2200)}
function add(id,q,note){var c=cart();var room=left(id,c);if(room<=0){toast(T('Stok habis untuk item ini.','No more stock for this item.'));return}q=Math.min(q,room);note=(note||'').trim().slice(0,80);var f=c.filter(function(l){return l.itemId===id&&(l.note||'')===note})[0];if(f)f.quantity=Math.min(9999,f.quantity+q);else c.push({itemId:id,quantity:q,note:note});save(c);var b=d.getElementById('bar');if(b){b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump')}}
function bar(){var b=d.getElementById('bar');if(!b)return;var t=totals(cart());b.hidden=t.n===0;d.getElementById('barN').textContent=t.n;d.getElementById('barT').textContent=rm(t.t)}
if(data.page==='store'){
 bar();
 d.addEventListener('click',function(e){var a=e.target.closest('[data-add]');if(a){e.stopPropagation();add(a.getAttribute('data-add'),1,'');return}var o=e.target.closest('[data-open]');if(o)openSheet(o.getAttribute('data-open'))});
 d.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.matches&&e.target.matches('[data-open]'))openSheet(e.target.getAttribute('data-open'))});
 var sheet=d.getElementById('sheet');
 function openSheet(id){var i=byId[id];if(!i)return;var q=1;var b=d.getElementById('sheetBody');
  b.innerHTML='<div class="ph" style="position:relative">'+(i.photo?'<img src="'+esc(i.photo)+'" alt="">':esc(i.name.split(/\\s+/).slice(0,2).map(function(w){return w[0].toUpperCase()}).join('')))+'<button class="x" type="button" aria-label="'+T('Tutup','Close')+'">×</button></div><div class="bd">'+(i.promo?'<div style="font-size:13px;font-weight:800;color:var(--b)">'+esc(i.promo.name.toUpperCase())+'</div>':'')+'<h3 class="h">'+esc(i.name)+'</h3>'+(i.description?'<p class="mut" style="margin:0;white-space:pre-line">'+esc(i.description)+'</p>':'')+'<div class="pr" style="font-size:18px">'+(i.promo?rm(i.promo.priceSen)+'<s>'+rm(i.priceSen)+'</s>':rm(i.priceSen))+'</div>'+(i.stock===0?'<p style="margin:12px 0 0"><span class="tag o">'+T('Habis','Sold out')+'</span></p>':i.stock!=null?'<p class="mut" style="margin:6px 0 0;font-weight:700">'+(i.stock<=5?T('Tinggal '+i.stock,'Only '+i.stock+' left'):T('Stok '+i.stock,i.stock+' in stock'))+'</p>':'')+(data.open&&i.stock!==0?'<label class="f" for="sn">'+T('Nota (pilihan)','Note (optional)')+'</label><input class="in1" id="sn" maxlength="80" placeholder="'+T('Contoh: kurang manis','e.g. less sweet')+'"><div class="row" style="margin-top:16px"><div class="qty"><button type="button" data-q="-1" aria-label="'+T('Kurang','Fewer')+'">−</button><span id="sq">1</span><button type="button" data-q="1" aria-label="'+T('Tambah','More')+'">+</button></div><button class="big" type="button" id="sa"></button></div>':'')+'</div>';
  function lbl(){var s=d.getElementById('sa');if(s)s.textContent=T('Tambah','Add')+' · '+rm(price(i)*q);var sq=d.getElementById('sq');if(sq)sq.textContent=q}
  lbl();b.querySelector('.x').onclick=function(){sheet.close()};
  b.querySelectorAll('[data-q]').forEach(function(x){x.onclick=function(){q=Math.max(1,Math.min(99,Math.max(1,left(i.id)),q+Number(x.getAttribute('data-q'))));lbl()}});
  var sa=d.getElementById('sa');if(sa)sa.onclick=function(){add(i.id,q,d.getElementById('sn').value);sheet.close()};
  sheet.showModal()}
 if(sheet)sheet.addEventListener('click',function(e){if(e.target===sheet)sheet.close()});
}
if(data.page==='checkout'){
 var form=d.getElementById('co'),err=d.getElementById('err');
 var me=get('kedai:me',{});['name','phone','address'].forEach(function(k){var el=d.getElementById(k);if(el&&me[k])el.value=me[k]});
 function fulfilment(){var r=form.querySelector('input[name=fulfilment]:checked');return r?r.value:''}
 function fee(){if(fulfilment()!=='delivery')return 0;var o=d.getElementById('area');return o?Number(o.selectedOptions[0].getAttribute('data-fee')):0}
 function draw(){var c=cart(),el=d.getElementById('lines');
  el.innerHTML=c.length?c.map(function(l,n){var i=byId[l.itemId];return '<div class="ln"><div style="flex:1;min-width:0"><div style="font-weight:800">'+esc(i.name)+'</div><div class="mut" style="font-size:12.5px">'+(i.promo?'<b style="color:var(--b)">'+esc(i.promo.name)+'</b> ':'')+esc(l.note||'')+'</div></div><button class="sm" type="button" data-d="'+n+'" aria-label="'+T('Kurang','Fewer')+'">−</button><b style="width:22px;text-align:center">'+l.quantity+'</b><button class="sm" type="button" data-i="'+n+'" aria-label="'+T('Tambah','More')+'">+</button><b style="width:76px;text-align:right">'+rm(price(i)*l.quantity)+'</b></div>'}).join(''):'<p class="mut">'+T('Troli kosong.','Your cart is empty.')+'</p>';
  var t=totals(c),f=fee();d.getElementById('sub').textContent=rm(t.t);d.getElementById('fee').textContent=rm(f);d.getElementById('feeRow').hidden=f===0;d.getElementById('total').textContent=rm(t.t+f);
  d.getElementById('saved').textContent=t.saved?T('Jimat ','You save ')+rm(t.saved):'';var dl=d.getElementById('dl');if(dl)dl.hidden=fulfilment()!=='delivery';
  d.getElementById('send').disabled=!c.length||!data.open}
 d.getElementById('lines').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var c=cart(),n=Number(b.getAttribute('data-d')||b.getAttribute('data-i'));if(!c[n])return;if(b.hasAttribute('data-i')){if(left(c[n].itemId,c)<=0){err.textContent=T('Stok '+byId[c[n].itemId].name+' tidak mencukupi.','Not enough stock of '+byId[c[n].itemId].name+'.');return}c[n].quantity+=1}else c[n].quantity-=1;if(c[n].quantity<1)c.splice(n,1);save(c);draw()});
 form.addEventListener('change',draw);draw();
 var MSG={name:['Masukkan nama anda.','Enter your name.'],phone:['Semak nombor WhatsApp, contoh 012-345 6789.','Check your WhatsApp number, e.g. 012-345 6789.'],address:['Isi alamat penghantaran.','Enter the delivery address.'],fulfilment:['Pilih ambil sendiri atau hantar.','Choose pickup or delivery.'],store_closed:['Kedai tidak menerima pesanan sekarang.','The store is not taking orders now.'],unavailable:['Satu item tidak lagi dijual. Semak troli.','An item is no longer sold. Check your cart.'],unknown_item:['Satu item tidak lagi dijual. Semak troli.','An item is no longer sold. Check your cart.'],below_minimum:['Jumlah belum capai minimum pesanan kedai.','Below the store\\'s minimum order.'],bad_area:['Pilih kawasan penghantaran.','Choose a delivery area.'],too_many_requests:['Terlalu banyak pesanan. Cuba sebentar lagi.','Too many orders. Please wait a little.']};
 form.addEventListener('submit',function(e){e.preventDefault();err.textContent='';var c=cart();if(!c.length)return;
  if(!fulfilment()){err.textContent=T(MSG.fulfilment[0],MSG.fulfilment[1]);return}
  var v=function(id){var el=d.getElementById(id);return el?el.value:''};
  var body={lines:c,name:v('name'),phone:v('phone'),fulfilment:fulfilment(),area:fulfilment()==='delivery'?v('area'):'',address:fulfilment()==='delivery'?v('address'):'',note:v('note'),pay:(form.querySelector('input[name=pay]:checked')||form.querySelector('input[name=pay]')).value};
  put('kedai:me',{name:body.name,phone:body.phone,address:body.address});
  var btn=d.getElementById('send');btn.disabled=true;
  fetch(data.base+'/pesan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){return {s:r.status,j:j}})}).then(function(x){
   if(x.s===201&&x.j.url){put(key,[]);location.href=x.j.url;return}
   if(x.j.error==='out_of_stock'){var it=byId[x.j.itemId];if(it){it.stock=x.j.left;var cc=cart();cc.forEach(function(l){if(l.itemId===it.id){var room=Math.max(0,it.stock-inCart(it.id,cc)+l.quantity);l.quantity=Math.min(l.quantity,room)}});save(cc.filter(function(l){return l.quantity>0}));draw()}
    err.textContent=it?(x.j.left>0?T('Stok '+it.name+' tinggal '+x.j.left+'. Troli sudah dikemas kini, semak dan hantar semula.','Only '+x.j.left+' '+it.name+' left. Your cart was updated; check and send again.'):T(it.name+' sudah habis. Troli sudah dikemas kini.',it.name+' is sold out. Your cart was updated.')):T('Satu item sudah habis.','An item is sold out.');btn.disabled=false;return}
   var m=MSG[x.j.detail]||MSG[x.j.error];err.textContent=m?T(m[0],m[1]):T('Pesanan tidak dapat dihantar. Cuba lagi.','The order could not be sent. Try again.');btn.disabled=false
  }).catch(function(){err.textContent=T('Tiada sambungan internet. Cuba lagi.','No internet connection. Try again.');btn.disabled=false})});
}
if(data.page==='order'){
 d.querySelectorAll('[data-copy]').forEach(function(b){b.onclick=function(){try{navigator.clipboard.writeText(b.getAttribute('data-copy'));b.textContent=T('Disalin','Copied')}catch(e){}}});
 if(data.status!=='done'&&data.status!=='cancelled')setInterval(function(){fetch(location.pathname+'.json',{cache:'no-store'}).then(function(r){return r.json()}).then(function(j){if(j.updatedAt&&j.updatedAt!==data.updatedAt)location.reload()}).catch(function(){})},20000);
}
})();`;
