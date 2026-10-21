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
  /** The days customers can order for now (OM-06), today first; full batches left out. */
  days: DayView[];
  /** Today's closing or last order time ("HH:MM"), when there is one. */
  closesToday: string | null;
  /** Ordering possible now: the store is open and, in pre-order mode, a batch is open. */
  canOrder: boolean;
}

export interface DayView {
  /** '' = today; 'auto-YYYY-MM-DD' = next opening day; else a batch id. */
  id: string;
  kind: 'today' | 'next' | 'batch';
  label: string;
  readyDate: string;
  /** Batches: when orders close. */
  closesAt: string | null;
  /** Batches: places left; null = no limit. */
  left: number | null;
  /** Batches: item id → stock left (null = no limit); null = every item, with the items' own stock. */
  menu: Record<string, number | null> | null;
}

/** "6:00 ptg" for "18:00". */
function hhmmText(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2)), m = hhmm.slice(3, 5);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return L(`${h12}:${m} ${h < 12 ? 'pg' : h < 14 ? 'tgh' : h < 19 ? 'ptg' : 'mlm'}`, `${h12}:${m} ${h < 12 ? 'am' : 'pm'}`);
}

/** The name and the line under it for an order day, both languages. */
function dayParts(d: DayView, closesToday: string | null): { name: string; info: string } {
  if (d.kind === 'today') return { name: L('Hari ini', 'Today'), info: closesToday ? `${L('Pesanan terakhir', 'Last order')} ${hhmmText(closesToday)}` : L('Secepat mungkin', 'As soon as possible') };
  if (d.kind === 'next') return { name: dayText(d.readyDate), info: L('Pra-tempah untuk hari buka seterusnya', 'Pre-order for the next opening day') };
  return {
    name: esc(d.label),
    info: `${L('Siap', 'Ready')} ${dayText(d.readyDate)}${d.closesAt ? ` · ${L('tutup', 'closes')} ${closeText(d.closesAt)}` : ''}${d.left !== null ? ` · ${L(`tinggal ${d.left} tempahan`, `${d.left} orders left`)}` : ''}`,
  };
}

const DAYS_MS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_MS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Khamis 23 Okt, 8:00 mlm" in Malaysian time (UTC+8, no daylight saving). */
export function closeText(iso: string): string {
  const t = new Date(Date.parse(iso) + 8 * 3600_000);
  const h = t.getUTCHours(), mm = String(t.getUTCMinutes()).padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const partMs = h < 12 ? 'pg' : h < 14 ? 'tgh' : h < 19 ? 'ptg' : 'mlm';
  const ms = `${DAYS_MS[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS_MS[t.getUTCMonth()]}, ${h12}:${mm} ${partMs}`;
  const en = `${DAYS_EN[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS_EN[t.getUTCMonth()]}, ${h12}:${mm} ${h < 12 ? 'am' : 'pm'}`;
  return L(esc(ms), esc(en));
}

/** "Sabtu 25 Okt" for a "YYYY-MM-DD" date. */
export function dayText(ymd: string): string {
  const t = new Date(`${ymd}T00:00:00Z`);
  return L(`${DAYS_MS[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS_MS[t.getUTCMonth()]}`, `${DAYS_EN[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS_EN[t.getUTCMonth()]}`);
}

const FONTS = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';

/** Storefront look (redesign 21 Oct, Mamu): white ground, one typeface, the seller's colour only on actions. */
function css(brand: string): string {
  return `:root{--b:${brand};--bt:color-mix(in srgb,${brand} 8%,#fff);--ink:#111418;--mut:#5B6170;--line:#E6E8EC;--soft:#F4F5F7;--tile:#F3EFEA;--bg:#fff;--page:#F7F8FA;--sun:#FFD23F}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--ink);font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.45}
body.pg{background:var(--page)}
html[data-lang=ms] [lang=en],html[data-lang=en] [lang=ms]{display:none}
a{color:inherit;text-decoration:none}button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer}
[hidden]{display:none!important}
.wrap{max-width:560px;margin:0 auto;min-height:100vh;position:relative;padding-bottom:104px}
.row{display:flex;align-items:center;gap:10px}.sp{justify-content:space-between}
.mut{color:var(--mut)}
.top{display:flex;align-items:center;gap:10px;padding:16px 16px 12px}
.logo{width:40px;height:40px;border-radius:12px;background:var(--b);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;overflow:hidden;flex:none}.logo img{width:100%;height:100%;object-fit:cover;display:block;background:#fff}
.shop{flex:1;min-width:0}.shop b{display:block;font-size:16px;font-weight:800;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--mut);margin-top:2px}.st i{width:7px;height:7px;border-radius:99px;background:#16A34A;flex:none}.st i.pre{background:#D97706}.st i.off{background:#9AA0AB}
.ib{height:40px;min-width:40px;padding:0 10px;border-radius:12px;border:1px solid var(--line);background:#fff;font-weight:700;font-size:13px;display:inline-flex;align-items:center;justify-content:center;position:relative;flex:none}
.ib .n{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:99px;background:var(--b);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center}
.srch{display:flex;align-items:center;gap:10px;height:46px;margin:0 16px;padding:0 14px;border-radius:14px;background:var(--soft);color:var(--mut)}.srch input{border:0;background:transparent;outline:none;flex:1;min-width:0;font-size:14.5px;color:var(--ink)}
.hero{margin:14px 16px 0;min-height:150px;border-radius:18px;background:#2B1A14;position:relative;overflow:hidden;display:flex;align-items:flex-end;color:#fff}
.hero.cov{background:linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.62) 100%),var(--cv) center/cover no-repeat,#2B1A14}
.hero.plain{background:var(--b);min-height:0}
.hero .in{padding:16px;position:relative}.hero .k{display:inline-block;padding:3px 8px;border-radius:6px;background:var(--sun);color:var(--ink);font-size:11px;font-weight:800;letter-spacing:.02em}
.hero .t{font-weight:800;font-size:20px;line-height:1.2;margin-top:6px}.hero .s{font-size:13px;opacity:.88;margin-top:2px}
.note{margin:14px 16px 0;padding:12px 14px;border-radius:14px;background:var(--soft);font-size:14px}.note .k,.sect .k{display:block;font-size:11.5px;font-weight:800;letter-spacing:.04em;color:var(--mut)}
.note.dark{background:var(--ink);color:#fff}.note.dark .k{color:#C9CDD4}
.note.br{background:var(--bt);border:1.5px solid var(--b)}.note.br .k{color:var(--b)}
.sect{margin:18px 16px 0}
.days{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:8px -16px 0;padding:0 16px}.days::-webkit-scrollbar{display:none}
.days button{flex:0 0 auto;min-width:118px;max-width:200px;padding:10px 12px;border-radius:14px;border:1px solid var(--line);background:#fff;text-align:left}
.days button b{display:block;font-size:14px;font-weight:800}.days button small{display:block;font-size:11.5px;color:var(--mut);margin-top:1px}
.days button.on{border:1.5px solid var(--b);background:var(--bt)}
.cats{display:flex;gap:8px;padding:16px 16px 6px;overflow-x:auto;scrollbar-width:none;position:sticky;top:0;background:var(--bg);z-index:5}.cats::-webkit-scrollbar{display:none}
.cats a{flex:none;height:38px;padding:0 16px;border-radius:99px;border:1px solid var(--line);font-weight:700;font-size:13.5px;display:flex;align-items:center}.cats a.on{background:var(--ink);border-color:var(--ink);color:#fff}
section[data-cat]{padding:0 16px}
h2{margin:18px 0 10px;font-size:17px;font-weight:800;display:flex;justify-content:space-between;align-items:baseline}h2 small{font-size:12.5px;color:var(--mut);font-weight:600}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 12px}
.it{display:flex;flex-direction:column;cursor:pointer;min-width:0}
.ph{position:relative;aspect-ratio:1;border-radius:16px;background:var(--tile);overflow:hidden;display:flex;align-items:center;justify-content:center}.ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ph svg{width:44px;height:44px}
.bd{position:absolute;top:8px;left:8px;display:flex;gap:4px;flex-wrap:wrap}
.tag{display:inline-block;padding:3px 7px;border-radius:7px;font-size:11px;font-weight:800;background:var(--ink);color:#fff;line-height:1.3}
.tag.p{background:var(--sun);color:var(--ink)}.tag.s{background:#fff;color:var(--ink)}
.tag.hb{display:none}
.so{position:absolute;inset:0;background:rgba(255,255,255,.6);display:none;align-items:center;justify-content:center}.so span{padding:5px 11px;border-radius:99px;background:var(--ink);color:#fff;font-size:12px;font-weight:800}
.out .so{display:flex}.out .add{display:none}.out .ph img{filter:grayscale(.7)}
.add{position:absolute;right:8px;bottom:8px;width:38px;height:38px;border-radius:99px;border:0;background:#fff;box-shadow:0 2px 8px rgba(17,20,24,.14);display:flex;align-items:center;justify-content:center;color:var(--b)}
.it .n{font-weight:700;font-size:14px;line-height:1.3;margin-top:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.it .d{display:none}
.pr{margin-top:3px;font-weight:800;font-size:14.5px}.pr s{color:#6B7280;font-weight:500;font-size:12.5px;margin-left:6px}.pr.pm{color:var(--b)}.pr.pm s{color:#6B7280}
.stk{display:block;font-size:12px;font-weight:700;color:var(--mut);margin-top:1px}.stk.low{color:#B42318}.stk:empty{display:none}
.empty{padding:30px 16px;text-align:center;color:var(--mut)}
.about{margin:24px 16px 0;padding:16px;border-radius:16px;background:var(--soft)}.about b{display:block;margin-bottom:4px}
.foot{padding:28px 20px 10px;text-align:center;font-size:12.5px;color:var(--mut)}.foot a{text-decoration:underline}
.bar{position:fixed;left:0;right:0;bottom:0;z-index:20;background:#fff;border-top:1px solid #EEF0F3;padding:12px 16px calc(14px + env(safe-area-inset-bottom))}
.bar .in{max-width:528px;margin:0 auto;display:flex;align-items:center;gap:12px}.bar small{display:block;font-size:12px;color:var(--mut)}.bar b{font-size:17px;font-weight:800}
.btn{height:48px;padding:0 22px;border-radius:14px;border:0;background:var(--b);color:#fff;font-weight:800;font-size:15px;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.btn.w{width:100%}.btn[disabled]{opacity:.5}.btn.ol{background:#fff;color:var(--ink);border:1px solid var(--line)}
.bump{animation:bump .25s}@keyframes bump{50%{transform:scale(1.03)}}
dialog{border:0;padding:0;width:100%;max-width:560px;margin:auto auto 0;border-radius:24px 24px 0 0;background:#fff;max-height:94vh;overflow:auto}
dialog::backdrop{background:rgba(17,20,24,.5)}
.sh .ph{border-radius:0;aspect-ratio:auto;height:min(390px,46vh)}.sh .ph svg{width:72px;height:72px}
.x{position:absolute;top:14px;left:14px;width:44px;height:44px;border-radius:99px;background:#fff;border:0;box-shadow:0 2px 8px rgba(17,20,24,.12);display:flex;align-items:center;justify-content:center}
.sh .body{padding:18px 16px 8px}.sh h3{margin:8px 0 0;font-size:22px;font-weight:800;line-height:1.25}.sh .pr{font-size:20px;margin-top:6px}.sh p.ds{margin:12px 0 0;color:#3D4250;font-size:14px;line-height:1.6;white-space:pre-line}
.sh .foot2{position:sticky;bottom:0;background:#fff;border-top:1px solid #EEF0F3;padding:12px 16px calc(14px + env(safe-area-inset-bottom));display:flex;gap:12px;align-items:center}
.qty{display:flex;align-items:center;height:48px;border:1px solid var(--line);border-radius:14px;flex:none}.qty button{width:44px;height:46px;border:0;background:transparent;font-size:20px;font-weight:700}.qty span{width:26px;text-align:center;font-weight:800}
label.f{display:block;margin:14px 0 6px;font-size:13.5px;font-weight:700}label.f small{font-weight:500;color:var(--mut)}
.in1{width:100%;height:48px;border-radius:12px;border:1px solid var(--line);background:#fff;padding:0 14px;font-size:15px}
textarea.in1{height:auto;padding:12px 14px;resize:none}
select.in1{appearance:auto}
.bar2{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#fff;border-bottom:1px solid #EEF0F3}.bar2 h1{margin:0;font-size:18px;font-weight:800;flex:1}
.back{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none}
.box{margin:12px 16px 0;padding:16px;border-radius:16px;background:#fff;border:1px solid #EEF0F3}
.box h3{margin:0 0 10px;font-size:15px;font-weight:800}
.seg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.opt{display:block;padding:12px;border-radius:12px;border:1px solid var(--line);background:#fff;cursor:pointer;font-weight:800;font-size:14px;height:100%}
.opt small{display:block;font-weight:500;color:var(--mut);font-size:12px;margin-top:2px}
input[type=radio]{position:absolute;opacity:0}input[type=radio]:checked+.opt{border:1.5px solid var(--b);background:var(--bt)}
input[type=radio]:focus-visible+.opt{outline:3px solid var(--ink)}
.ln{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #F1F2F4}.ln:last-child{border:0}
.th{width:56px;height:56px;border-radius:12px;background:var(--tile);flex:none;overflow:hidden;position:relative}.th img{width:100%;height:100%;object-fit:cover}
.sm{width:34px;height:32px;border:0;background:transparent;font-weight:800;font-size:16px}
.qs{display:flex;align-items:center;height:34px;border:1px solid var(--line);border-radius:10px}.qs b{width:22px;text-align:center;font-size:13.5px}
.sum{display:flex;flex-direction:column;gap:6px;font-size:14px}.sum .t{font-weight:800;font-size:16px;padding-top:8px;border-top:1px solid #EEF0F3;margin-top:4px}.sum .g{color:#15803D}
.err{margin:12px 16px 0;padding:12px 14px;border-radius:12px;background:#FDECEA;color:#912018;font-weight:700;font-size:14px}.err:empty{display:none}
.stick{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #EEF0F3;padding:12px 16px calc(14px + env(safe-area-inset-bottom));z-index:20}.stick .in{max-width:528px;margin:0 auto}
.qr{margin:12px auto 0;width:200px;height:200px;border-radius:12px;border:1px solid var(--line);padding:10px;background:#fff}.qr img{width:100%;height:100%;object-fit:contain}
.ok{width:56px;height:56px;border-radius:99px;background:var(--bt);margin:0 auto;display:flex;align-items:center;justify-content:center;color:var(--b)}
.ok.x2{background:#FDECEA;color:#B42318}
.tl{display:flex;gap:12px}.tl .c{display:flex;flex-direction:column;align-items:center}.tl .dt{width:14px;height:14px;border-radius:99px;background:var(--line);margin-top:3px;flex:none}
.tl .dt.d{background:var(--b)}.tl .dt.n{background:#fff;border:3px solid var(--b)}.tl .ln2{width:2px;flex:1;min-height:20px;background:var(--line);margin:3px 0}
.tl .tx{padding-bottom:14px;font-size:14px;font-weight:800}.tl .tx.l{font-weight:600;color:var(--mut)}
:focus-visible{outline:3px solid var(--ink);outline-offset:2px}`;
}

function shell(title: string, brand: string, body: string, opts: { description?: string; noindex?: boolean; image?: string; page?: boolean } = {}): string {
  return `<!doctype html><html lang="ms" data-lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>${opts.description ? `<meta name="description" content="${esc(opts.description)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(opts.description)}">` : ''}
${opts.image ? `<meta property="og:image" content="${esc(opts.image)}"><meta name="twitter:card" content="summary_large_image">` : ''}${opts.noindex ? '<meta name="robots" content="noindex">' : ''}<meta name="theme-color" content="#ffffff">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${FONTS}"><style>${css(brand)}</style></head>
<body${opts.page ? ' class="pg"' : ''}>${body}<script src="/_k/app.js" defer></script></body></html>`;
}

const initials = (name: string) => esc(name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join(''));
/** A quiet plate for items without a photo (most home sellers start without photos). */
const PLATE = '<svg viewBox="0 0 48 48" fill="none" stroke="#B9AEA3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 30h32"/><path d="M11 30a13 13 0 0 1 26 0"/><path d="M24 14v3"/><path d="M6 34h36"/></svg>';
/** The item's photo when it has one (lazy below the fold), the plate otherwise. */
const photoInner = (i: StoreItemView) => (i.photo ? `<img src="${esc(i.photo)}" alt="" loading="lazy" decoding="async">` : PLATE);
/** The shop's logo when it has one, its initials otherwise. */
const logoInner = (logo: string | null, shopName: string) => (logo ? `<img src="${esc(logo)}" alt="${esc(shopName)}">` : initials(shopName));

const ICON_BAG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>';
const ICON_BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const ICON_PLUS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_SEARCH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';

const langSwitch = `<button class="ib" type="button" data-lang-switch aria-label="Bahasa / Language">${L('EN', 'BM')}</button>`;

function priceHtml(i: StoreItemView): string {
  return i.promo ? `${rm(i.promo.priceSen)}<s>${rm(i.priceSen)}</s>` : rm(i.priceSen);
}

/** "Stok 12" under the price; "Tinggal 3" in red when few are left. */
function stockHtml(i: StoreItemView): string {
  if (i.stock === null || i.stock === 0) return '<span class="stk"></span>';
  return i.stock <= 5 ? `<span class="stk low">${L(`Tinggal ${i.stock}`, `Only ${i.stock} left`)}</span>` : `<span class="stk">${L(`Stok ${i.stock}`, `${i.stock} in stock`)}</span>`;
}

function badgeHtml(i: StoreItemView): string {
  const habis = `<span class="tag o hb">${L('Habis', 'Sold out')}</span>`;
  if (i.promo) return habis + `<span class="tag p">${esc(i.promo.label)}</span>`;
  if (i.badge === 'laris') return habis + `<span class="tag">${L('Laris', 'Best seller')}</span>`;
  if (i.badge === 'baru') return habis + `<span class="tag s">${L('Baru', 'New')}</span>`;
  if (i.badge === 'pedas') return habis + `<span class="tag s">${L('Pedas', 'Spicy')}</span>`;
  return habis;
}

function card(i: StoreItemView, canOrder: boolean): string {
  return `<div class="it${i.stock === 0 ? ' out' : ''}" data-open="${esc(i.id)}" data-item="${esc(i.id)}" data-name="${esc(i.name.toLowerCase())}" role="button" tabindex="0" aria-label="${esc(i.name)}">
<div class="ph">${photoInner(i)}<span class="bd">${badgeHtml(i)}</span><span class="so"><span>${L('Habis', 'Sold out')}</span></span>${canOrder ? `<button class="add" type="button" data-add="${esc(i.id)}" aria-label="${esc(`Tambah ${i.name}`)}">${ICON_PLUS}</button>` : ''}</div>
<div class="n">${esc(i.name)}</div>${i.description ? `<div class="d">${esc(i.description)}</div>` : ''}<div class="pr${i.promo ? ' pm' : ''}">${priceHtml(i)}</div>${stockHtml(i)}</div>`;
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
  const featured = v.items.filter((i) => i.featured).slice(0, 4);
  const promo = v.items.find((i) => i.promo)?.promo ?? null;
  const first = v.days[0];
  // Status line under the shop's name.
  const status = !s.open || !v.canOrder
    ? `<i class="off"></i>${L('Tutup buat masa ini', 'Closed for now')}`
    : first?.kind === 'today'
      ? `<i></i>${L('Buka', 'Open')}${v.closesToday ? ` · ${s.orderMode === 'batch' ? L('pesanan terakhir', 'last order') : L('tutup', 'closes')} ${hhmmText(v.closesToday)}` : ''}`
      : `<i class="pre"></i>${L('Pra-tempah', 'Pre-order')}`;
  // The banner: the seller's cover photo, announcement or running promotion; none of them, no banner.
  const heroText = s.announcement
    ? { k: L('PENGUMUMAN', 'NOTICE'), t: esc(s.announcement), sub: '' }
    : promo
      ? { k: esc(promo.name.toUpperCase()), t: L(`Jimat sehingga ${esc(promo.label)}`, `Save up to ${esc(promo.label)}`), sub: L('Harga promo sudah ditolak dalam menu', 'Promo prices are shown in the menu') }
      : s.tagline
        ? { k: '', t: esc(s.tagline), sub: '' }
        : null;
  const hero = v.cover || heroText
    ? `<div class="hero${v.cover ? ' cov' : heroText ? '' : ''}${!v.cover && !promo && !s.announcement ? ' plain' : ''}"${v.cover ? ` style="--cv:url('${esc(v.cover)}')"` : ''}>${heroText ? `<div class="in">${heroText.k ? `<span class="k">${heroText.k}</span>` : ''}<div class="t">${heroText.t}</div>${heroText.sub ? `<div class="s">${heroText.sub}</div>` : ''}</div>` : ''}</div>`
    : '';
  const notice = !s.open
    ? `<div class="note dark"><span class="k">${L('KEDAI TUTUP', 'STORE CLOSED')}</span>${L('Kedai tutup sementara. Anda boleh lihat menu, tetapi belum boleh memesan.', 'The store is closed for now. You can browse, but not order yet.')}</div>`
    : !v.canOrder
      ? `<div class="note dark"><span class="k">${L('TEMPAHAN DITUTUP', 'ORDERS CLOSED')}</span>${L('Tempahan ditutup buat masa ini. Nantikan tempahan seterusnya.', 'Orders are closed for now. Check back soon.')}</div>`
      : s.orderMode === 'auto'
        ? first!.kind === 'today'
          ? `<div class="note"><span class="k">${L('BUKA HARI INI', 'OPEN TODAY')}</span>${L('Pesanan untuk hari ini', 'Orders are for today')}${v.closesToday ? ` · ${L('sehingga', 'until')} ${hhmmText(v.closesToday)}` : ''}</div>`
          : `<div class="note br"><span class="k">${L('KEDAI TUTUP SEKARANG', 'CLOSED NOW')}</span><b>${L('Pesanan anda untuk', 'Your order is for')} ${dayText(first!.readyDate)}</b> · ${L('pra-tempah', 'pre-order')}</div>`
        : '';
  const days = v.canOrder && s.orderMode === 'batch'
    ? `<div class="sect"><div class="row sp"><span class="k">${L('PILIH HARI DAHULU', 'CHOOSE A DAY FIRST')}</span><small class="mut" style="font-size:12px">${L('1 pesanan untuk 1 hari', 'One order, one day')}</small></div>
<div class="days" role="tablist">${v.days.map((d, n) => { const p = dayParts(d, v.closesToday); return `<button type="button" role="tab" data-day="${esc(d.id)}" aria-selected="${n === 0}"${n === 0 ? ' class="on"' : ''}><b>${p.name}</b><small>${p.info}</small></button>`; }).join('')}</div>
<div class="mut" style="font-size:12px;margin-top:8px">${L('1 pesanan untuk 1 hari. Menu dan stok ikut hari yang dipilih.', 'One order is for one day. The menu and stock follow the day you choose.')}</div></div>`
    : '';
  const body = `<div class="wrap">
<header class="top">
 <div class="logo h">${logoInner(v.logo, v.shopName)}</div>
 <div class="shop"><b>${esc(v.shopName)}</b><div class="st">${status}</div></div>
 ${langSwitch}
 <a class="ib" href="${esc(v.base)}/troli" aria-label="${'Troli'}">${ICON_BAG}<span class="n" id="cartN" hidden>0</span></a>
</header>
${v.items.length > 6 ? `<label class="srch">${ICON_SEARCH}<input id="q" type="search" placeholder="${'Cari menu…'}" aria-label="${'Cari menu'}" autocomplete="off"></label>` : ''}
${hero}
${notice}
${days}
${catNames.length > 1 ? `<nav class="cats" aria-label="${'Kategori'}">${catNames.map((c, n) => `<a href="#${anchor(c, n)}"${n === 0 ? ' class="on"' : ''}>${c ? esc(c) : L('Lain-lain', 'Others')}</a>`).join('')}</nav>` : ''}
${featured.length ? `<section data-cat><h2>${L('Pilihan kedai', 'Shop picks')}</h2><div class="grid">${featured.map((i) => card(i, v.canOrder)).join('')}</div></section>` : ''}
${catNames.map((c, n) => `<section id="${anchor(c, n)}" data-cat><h2>${c ? esc(c) : L('Lain-lain', 'Others')}<small>${(cats.get(c) ?? []).length} item</small></h2><div class="grid">${(cats.get(c) ?? []).map((i) => card(i, v.canOrder)).join('')}</div></section>`).join('')}
<p class="empty" id="none" hidden>${L('Tiada menu sepadan.', 'Nothing matches.')}</p>
${s.about ? `<div class="about"><b>${L('Tentang kami', 'About us')}</b><div class="mut" style="white-space:pre-line;font-size:14px">${esc(s.about)}</div></div>` : ''}
<div class="foot">${s.pickup.on && s.pickup.address ? `${L('Ambil di', 'Pickup at')} ${esc(s.pickup.address)}${s.pickup.hours ? ` · ${esc(s.pickup.hours)}` : ''}${s.pickup.mapUrl ? ` · <a href="${esc(s.pickup.mapUrl)}" rel="noopener" target="_blank">${L('Peta', 'Map')}</a>` : ''}<br>` : ''}
${s.whatsapp ? `<a href="https://wa.me/${esc(s.whatsapp)}" rel="noopener" target="_blank">WhatsApp</a>` : ''}${s.instagram ? ` · <a href="https://instagram.com/${esc(s.instagram)}" rel="noopener" target="_blank">Instagram</a>` : ''}${s.tiktok ? ` · <a href="https://www.tiktok.com/@${esc(s.tiktok)}" rel="noopener" target="_blank">TikTok</a>` : ''}${s.facebook ? ` · <a href="https://facebook.com/${esc(s.facebook)}" rel="noopener" target="_blank">Facebook</a>` : ''}
<br><br>${L('Dibuat dengan', 'Made with')} <a href="https://smelab.untunglab.space/#jualanlab">JualanLab</a> · smeLab</div>
<div class="bar" id="bar" hidden><div class="in"><div style="flex:1"><small><span id="barN">0</span> item</small><b id="barT">RM0.00</b></div><a class="btn" href="${esc(v.base)}/troli">${L('Lihat troli', 'View cart')}</a></div></div>
<dialog id="sheet" aria-label="Item"><div class="sh" id="sheetBody"></div></dialog>
</div>
<script type="application/json" id="kd">${json({ page: 'store', base: v.base, open: v.canOrder, days: v.days.map((d) => ({ id: d.id, kind: d.kind, menu: d.menu })), items: v.items.map((i) => ({ id: i.id, name: i.name, description: i.description, priceSen: i.priceSen, promo: i.promo, photo: i.photo, stock: i.stock })) })}</script>`;
  return shell(`${v.shopName}${s.tagline ? ` · ${s.tagline}` : ''}`, v.brand, body, { description: s.tagline || `Tempah dari ${v.shopName}`, image: v.cover ? v.origin + v.cover : v.logo ? v.origin + v.logo : undefined });
}

export function checkoutPage(v: StoreView): string {
  const s = v.settings;
  const both = s.pickup.on && s.delivery.on;
  const body = `<div class="wrap" style="padding-bottom:120px">
<div class="bar2"><a href="${esc(v.base)}" class="back" aria-label="${'Kembali ke kedai'}">${ICON_BACK}</a><h1>${L('Troli', 'Cart')}</h1><span class="mut" style="font-size:13px"><span id="cnt">0</span> item</span></div>
<form id="co" novalidate>
${v.canOrder && s.orderMode !== 'normal' ? `<div class="box row" style="gap:12px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--b);flex:none" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg><div style="flex:1;min-width:0"><div class="mut" style="font-size:12px">${L('Pesanan untuk', 'Order for')}</div>${v.days.map((d) => { const p = dayParts(d, v.closesToday); return `<div data-dayinfo="${esc(d.id)}" hidden><div style="font-weight:800;font-size:14.5px">${p.name}</div><div class="mut" style="font-size:12px">${p.info}</div></div>`; }).join('')}</div>${v.days.length > 1 ? `<a href="${esc(v.base)}" style="font-weight:700;font-size:13px;color:var(--b)">${L('Tukar', 'Change')}</a>` : ''}</div>` : ''}
<div class="box" style="padding-top:4px;padding-bottom:4px"><div id="lines"></div><a href="${esc(v.base)}" style="display:block;padding:12px 0;font-weight:700;font-size:13.5px;color:var(--b);border-top:1px solid #F1F2F4">+ ${L('Tambah item lain', 'Add more items')}</a></div>
<div class="box"><h3>${both ? L('Cara terima', 'How to get it') : s.delivery.on ? L('Penghantaran', 'Delivery') : L('Ambil sendiri', 'Pickup')}</h3>
 <div class="seg">
  ${s.pickup.on ? `<label><input type="radio" name="fulfilment" value="pickup" checked><span class="opt">${L('Ambil sendiri', 'Pickup')}<small>${esc(s.pickup.address || '')}</small></span></label>` : ''}
  ${s.delivery.on ? `<label><input type="radio" name="fulfilment" value="delivery"${s.pickup.on ? '' : ' checked'}><span class="opt">${L('Hantar', 'Delivery')}<small>${s.delivery.areas.length === 1 ? `${esc(s.delivery.areas[0]!.name)} · ${rm(s.delivery.areas[0]!.feeSen)}` : `${L('dari', 'from')} ${rm(Math.min(...s.delivery.areas.map((a) => a.feeSen)))}`}</small></span></label>` : ''}
 </div>
 ${s.delivery.on ? `<div id="dl" hidden>
  <label class="f" for="area">${L('Kawasan', 'Area')}</label><select class="in1" id="area" name="area">${s.delivery.areas.map((a) => `<option value="${esc(a.name)}" data-fee="${a.feeSen}">${esc(a.name)} · ${rm(a.feeSen)}</option>`).join('')}</select>
  <label class="f" for="address">${L('Alamat', 'Address')}</label><textarea class="in1" id="address" name="address" rows="2" maxlength="200" autocomplete="street-address"></textarea>
  ${s.delivery.note ? `<div class="mut" style="font-size:13px;margin-top:6px">${esc(s.delivery.note)}</div>` : ''}
 </div>` : ''}
</div>
<div class="box"><h3>${L('Maklumat anda', 'Your details')}</h3>
 <label class="f" for="name" style="margin-top:0">${L('Nama', 'Name')}</label><input class="in1" id="name" name="name" maxlength="60" autocomplete="name" required>
 <label class="f" for="phone">${L('No. WhatsApp', 'WhatsApp number')}</label><input class="in1" id="phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="012-345 6789" required>
 <label class="f" for="note">${L('Nota untuk kedai', 'Note for the store')} <small>${L('(pilihan)', '(optional)')}</small></label><input class="in1" id="note" name="note" maxlength="200">
 <div class="mut" style="font-size:12px;margin-top:8px">${L('Disimpan dalam telefon ini untuk pesanan seterusnya.', 'Kept on this phone for next time.')}</div>
</div>
<div class="box"><h3>${L('Bayaran', 'Payment')}</h3>
${s.payAtPickup ? `<div class="seg">
 <label><input type="radio" name="pay" value="qr" checked><span class="opt">DuitNow QR<small>${L('Bayar sekarang', 'Pay now')}</small></span></label>
 <label><input type="radio" name="pay" value="at_pickup"><span class="opt">${L('Bayar semasa terima', 'Pay on collection')}<small>${L('Tunai atau QR', 'Cash or QR')}</small></span></label>
</div>` : `<input type="hidden" name="pay" value="qr"><div class="opt" style="border:1.5px solid var(--b);background:var(--bt)">DuitNow QR<small>${L('Imbas QR kedai selepas hantar pesanan', 'Scan the store’s QR after you place the order')}</small></div>`}
 <div class="sum" style="margin-top:14px">
  <div class="row sp"><span class="mut">${L('Item', 'Items')}</span><span id="sub">RM0.00</span></div>
  <div class="row sp g" id="savedRow" hidden><span>${L('Jimat promo', 'Promo savings')}</span><span id="saved"></span></div>
  <div class="row sp" id="feeRow" hidden><span class="mut">${L('Penghantaran', 'Delivery')}</span><span id="fee">RM0.00</span></div>
  <div class="row sp t"><span>${L('Jumlah', 'Total')}</span><span id="total">RM0.00</span></div>
 </div>
</div>
<p class="err" id="err" role="alert"></p>
<div class="stick"><div class="in"><button class="btn w" id="send" type="submit" style="height:52px">${L('Hantar pesanan', 'Place order')} · <span id="sendT">RM0.00</span></button>
<div class="mut" style="font-size:11.5px;text-align:center;margin-top:8px">${L('Bayaran terus kepada', 'You pay')} ${esc(v.shopName)}${L('', ' directly')}</div></div></div>
</form></div>
<script type="application/json" id="kd">${json({ page: 'checkout', base: v.base, open: v.canOrder, days: v.days.map((d) => ({ id: d.id, kind: d.kind, menu: d.menu })), minOrderSen: s.minOrderSen, items: v.items.map((i) => ({ id: i.id, name: i.name, priceSen: i.priceSen, promo: i.promo, stock: i.stock, photo: i.photo })) })}</script>`;
  return shell(`Troli · ${v.shopName}`, v.brand, body, { noindex: true, page: true });
}

const STATUS_TEXT: Record<Order['status'], [string, string]> = {
  awaiting_payment: ['Menunggu bayaran', 'Waiting for payment'],
  confirmed: ['Pesanan disahkan', 'Order confirmed'],
  preparing: ['Sedang disediakan', 'Being prepared'],
  ready: ['Sedia', 'Ready'],
  done: ['Selesai', 'Completed'],
  cancelled: ['Pesanan dibatalkan', 'Order cancelled'],
};

export function orderPage(p: { shopName: string; base: string; brand: string; settings: StoreSettings; order: Order; hasQr: boolean; logo: string | null; now: Date }): string {
  const o = p.order;
  const s = p.settings;
  const idx = ['awaiting_payment', 'confirmed', 'preparing', 'ready', 'done'].indexOf(o.status);
  const readyText = o.fulfilment === 'pickup' ? L('Sedia untuk diambil', 'Ready for pickup') : L('Dalam penghantaran', 'Out for delivery');
  const title = o.status === 'ready' ? readyText : L(...STATUS_TEXT[o.status]);
  const mins = o.expiresAt ? Math.max(0, Math.round((Date.parse(o.expiresAt) - p.now.getTime()) / 60000)) : null;
  const waText = encodeURIComponent(`Salam, saya dah bayar pesanan ${o.number} (${rm(o.totalSen)}). Ini bukti bayaran:`);
  const sub = o.status === 'awaiting_payment'
    ? L('Bayar sekarang supaya kedai mula sediakan. Halaman ini dikemas kini sendiri.', 'Pay now so the store can start. This page updates by itself.')
    : o.status === 'cancelled'
      ? (o.cancelReason === 'expired' ? L('Tiada bayaran dalam masa yang ditetapkan.', 'No payment in time.') : esc(o.cancelReason ?? ''))
      : L('Halaman ini dikemas kini sendiri.', 'This page updates by itself.');
  const pay = o.status === 'awaiting_payment' ? `<div class="box" style="text-align:center">
 <div class="mut" style="font-size:12px;font-weight:800;letter-spacing:.04em">${L('BAYAR DENGAN DUITNOW QR', 'PAY BY DUITNOW QR')}</div>
 <div style="font-size:30px;font-weight:800;margin-top:2px">${rm(o.totalSen)}</div>
 <div style="display:inline-block;margin-top:4px;padding:5px 10px;border-radius:8px;background:var(--soft);font-weight:700;font-size:13px">${L('Rujukan', 'Reference')}: ${esc(o.number)}</div>
 ${p.hasQr ? `<div class="qr"><img src="${esc(p.base)}/qr" alt="DuitNow QR ${esc(p.shopName)}"></div>
 <div class="seg" style="margin-top:12px"><a class="btn ol" href="${esc(p.base)}/qr" download="QR-${esc(p.shopName)}.png" style="height:44px;font-size:13.5px">${L('Simpan QR', 'Save QR')}</a><button class="btn ol" type="button" data-copy="${esc(o.number)}" style="height:44px;font-size:13.5px">${L('Salin rujukan', 'Copy reference')}</button></div>` : `<p class="mut" style="font-size:14px">${L('Kedai akan hantar butiran bayaran melalui WhatsApp.', 'The store will send payment details by WhatsApp.')}</p>`}
 ${s.whatsapp ? `<a class="btn w" style="margin-top:10px" href="https://wa.me/${esc(s.whatsapp)}?text=${waText}" target="_blank" rel="noopener">${L('Dah bayar? Hantar bukti', 'Paid? Send proof')}</a>` : ''}
 ${mins !== null ? `<div class="mut" style="font-size:12px;margin-top:8px">${L(`Tiada bayaran dalam ${mins} minit, pesanan dibatalkan sendiri.`, `No payment within ${mins} minutes and the order cancels itself.`)}</div>` : ''}
</div>` : '';
  const steps: [string, number][] = [
    [L('Pesanan diterima', 'Order received'), 0],
    [o.pay === 'at_pickup' ? L('Disahkan · bayar semasa terima', 'Confirmed · pay on collection') : o.status === 'awaiting_payment' ? L('Menunggu bayaran', 'Waiting for payment') : L('Bayaran disahkan', 'Payment confirmed'), 1],
    [L('Sedang disediakan', 'Being prepared'), 2],
    [readyText, 3],
    [L('Selesai', 'Completed'), 4],
  ];
  // idx: awaiting_payment 0 (received done, payment now), confirmed 1, preparing 2, ready 3, done 4.
  const timeline = o.status === 'cancelled' ? '' : `<div class="box"><h3>${L('Status', 'Status')}</h3>${steps.map(([label, n], k) => {
    const state = n < idx || (n === idx && o.status === 'done') || n === 0 ? 'd' : n === idx || (idx === 0 && n === 1) ? 'n' : '';
    return `<div class="tl"><div class="c"><span class="dt${state ? ` ${state}` : ''}"></span>${k < steps.length - 1 ? '<span class="ln2"></span>' : ''}</div><div class="tx${state ? '' : ' l'}">${label}${n === 0 ? `<div class="mut" style="font-size:12px;font-weight:500">${esc(fmtTime(o.createdAt))}</div>` : ''}</div></div>`;
  }).join('')}</div>`;
  const body = `<div class="wrap" style="padding-bottom:24px">
<div class="bar2"><a href="${esc(p.base)}" class="row" style="flex:1;font-weight:800;font-size:15px;gap:10px"><span class="logo" style="width:32px;height:32px;border-radius:9px;font-size:12px">${logoInner(p.logo, p.shopName)}</span>${esc(p.shopName)}</a>${langSwitch}</div>
<div style="padding:22px 24px 4px;text-align:center">
 <div class="ok${o.status === 'cancelled' ? ' x2' : ''}">${o.status === 'cancelled' ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' : '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'}</div>
 <div class="mut" style="font-size:13px;margin-top:12px">${L('Pesanan', 'Order')} ${esc(o.number)}</div>
 <h1 style="margin:4px 0 0;font-size:22px;font-weight:800">${title}</h1>
 <p class="mut" style="margin:6px 0 0;font-size:14px">${sub}</p>
</div>
${pay}
${timeline}
${o.batchLabel || o.readyDate ? `<div class="box" style="border:1.5px solid var(--b);background:var(--bt)"><div style="font-size:11.5px;font-weight:800;color:var(--b);letter-spacing:.04em">${L('PRA-TEMPAH', 'PRE-ORDER')}</div><div style="font-weight:800;font-size:17px">${o.batchLabel ? esc(o.batchLabel) : dayText(o.readyDate!)}</div>${o.readyDate ? `<div class="mut" style="font-size:13px">${L('Siap', 'Ready')} ${dayText(o.readyDate)}</div>` : ''}</div>` : ''}
<div class="box"><div class="row sp"><h3 style="margin:0">${o.fulfilment === 'pickup' ? L('Ambil sendiri', 'Pickup') : L('Penghantaran', 'Delivery')}</h3>${o.fulfilment === 'pickup' && s.pickup.mapUrl ? `<a href="${esc(s.pickup.mapUrl)}" target="_blank" rel="noopener" style="font-weight:700;font-size:13px;color:var(--b)">${L('Peta', 'Map')}</a>` : ''}</div>
 <div class="mut" style="font-size:13.5px;margin-top:4px">${o.fulfilment === 'pickup' ? `${esc(s.pickup.address)}${s.pickup.hours ? ` · ${esc(s.pickup.hours)}` : ''}` : `${esc(o.address)} · ${esc(o.area)}`}</div>
 <div class="sum" style="margin-top:12px;padding-top:12px;border-top:1px solid #EEF0F3">
 ${o.lines.map((l) => `<div class="row sp" style="align-items:flex-start"><span>${l.quantity}× ${esc(l.name)}${l.note ? ` <span class="mut">(${esc(l.note)})</span>` : ''}${l.promoName ? `<br><small style="color:var(--b);font-weight:700">${esc(l.promoName)}</small>` : ''}</span><b>${rm(l.unitPriceSen * l.quantity)}</b></div>`).join('')}
 ${o.deliverySen ? `<div class="row sp"><span class="mut">${L('Penghantaran', 'Delivery')}</span><span>${rm(o.deliverySen)}</span></div>` : ''}
 <div class="row sp t"><span>${L('Jumlah', 'Total')}</span><span>${rm(o.totalSen)}</span></div>
 ${o.pay === 'at_pickup' ? `<div class="mut" style="font-size:13px">${L('Bayar semasa terima.', 'Pay on collection.')}</div>` : ''}
 </div></div>
<div class="box" style="font-size:12.5px;color:#3D4250">${L('Bayaran terus kepada', 'Payment goes straight to')} <b>${esc(p.shopName)}</b>. ${L('JualanLab tidak memegang wang anda.', 'JualanLab never holds your money.')}${s.whatsapp ? ` <a href="https://wa.me/${esc(s.whatsapp)}" target="_blank" rel="noopener" style="color:var(--b);font-weight:700">WhatsApp ${L('kedai', 'the store')}</a>` : ''}</div>
<div class="foot">${L('Simpan pautan ini untuk semak pesanan.', 'Keep this link to check your order.')} · ${L('Dibuat dengan', 'Made with')} <a href="https://smelab.untunglab.space/#jualanlab">JualanLab</a></div>
</div>
<script type="application/json" id="kd">${json({ page: 'order', status: o.status, updatedAt: o.updatedAt })}</script>`;
  return shell(`${o.number} · ${p.shopName}`, p.brand, body, { noindex: true, page: true });
}

/** "2:41 ptg" in Malaysian time. */
function fmtTime(iso: string): string {
  const t = new Date(Date.parse(iso) + 8 * 3600_000);
  return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
}

export function notFoundPage(): string {
  return shell('Kedai tidak dijumpai', '#111418', `<div class="wrap" style="padding:80px 24px;text-align:center"><div class="ok" style="background:var(--soft);color:var(--mut)">${ICON_BAG}</div><h1 style="font-size:22px;font-weight:800;margin:16px 0 4px">${L('Kedai tidak dijumpai', 'Store not found')}</h1><p class="mut">${L('Semak pautan dengan penjual.', 'Check the link with the seller.')}</p><p><a href="https://smelab.untunglab.space" style="text-decoration:underline">smeLab</a></p></div>`, { noindex: true });
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
var days=data.days||[],dayKey='kedai:day:'+data.base;
function curDay(){var id=get(dayKey,null);return days.filter(function(x){return x.id===id})[0]||days[0]||null}
function menuStock(id){var dd=curDay(),i=byId[id];if(!i)return undefined;if(dd&&dd.kind==='batch'){if(!dd.menu)return null;return Object.prototype.hasOwnProperty.call(dd.menu,id)?dd.menu[id]:undefined}return i.stock}
function cart(){return get(key,[]).filter(function(l){return byId[l.itemId]&&l.quantity>0&&menuStock(l.itemId)!==undefined})}
function save(c){put(key,c);bar()}
function price(i){return i.promo?i.promo.priceSen:i.priceSen}
function totals(c){var n=0,t=0,saved=0;c.forEach(function(l){var i=byId[l.itemId];n+=l.quantity;t+=price(i)*l.quantity;if(i.promo)saved+=(i.priceSen-i.promo.priceSen)*l.quantity});return {n:n,t:t,saved:saved}}
function inCart(id,c){var n=0;(c||cart()).forEach(function(l){if(l.itemId===id)n+=l.quantity});return n}
function left(id,c){var st=menuStock(id);if(st===undefined)return 0;return st!=null?Math.max(0,st-inCart(id,c)):9999}
function toast(m){var t=d.getElementById('toast');if(!t){t=d.createElement('div');t.id='toast';t.setAttribute('role','status');t.style.cssText='position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:#1E1512;color:#fff;padding:10px 16px;border-radius:999px;font-weight:700;font-size:14px;z-index:60;max-width:90vw;text-align:center';d.body.appendChild(t)}t.textContent=m;t.hidden=false;clearTimeout(t._h);t._h=setTimeout(function(){t.hidden=true},2200)}
function add(id,q,note){var c=cart();var room=left(id,c);if(room<=0){toast(T('Stok habis untuk item ini.','No more stock for this item.'));return}q=Math.min(q,room);note=(note||'').trim().slice(0,80);var f=c.filter(function(l){return l.itemId===id&&(l.note||'')===note})[0];if(f)f.quantity=Math.min(9999,f.quantity+q);else c.push({itemId:id,quantity:q,note:note});save(c);var b=d.getElementById('bar');if(b){b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump')}}
function bar(){var t=totals(cart()),cn=d.getElementById('cartN');if(cn){cn.hidden=t.n===0;cn.textContent=t.n}var b=d.getElementById('bar');if(!b)return;b.hidden=t.n===0;d.getElementById('barN').textContent=t.n;d.getElementById('barT').textContent=rm(t.t)}
var query='';
function applyDay(){var dd=curDay();
 d.querySelectorAll('[data-day]').forEach(function(b){var on=!!dd&&b.getAttribute('data-day')===dd.id;b.classList.toggle('on',on);b.setAttribute('aria-selected',on?'true':'false')});
 var any=false;d.querySelectorAll('[data-item]').forEach(function(el){var st=menuStock(el.getAttribute('data-item'));el.hidden=st===undefined||(query&&(el.getAttribute('data-name')||'').indexOf(query)<0);if(!el.hidden)any=true;el.classList.toggle('out',st===0);var k=el.querySelector('.stk');if(k){k.textContent=st==null||st===0?'':(st<=5?T('Tinggal '+st,'Only '+st+' left'):T('Stok '+st,st+' in stock'));k.classList.toggle('low',st!=null&&st<=5)}});
 var none=d.getElementById('none');if(none)none.hidden=any;d.querySelectorAll('section[data-cat]').forEach(function(sec){var show=!!sec.querySelector('[data-item]:not([hidden])');sec.hidden=!show;var chip=d.querySelector('.cats a[href="#'+sec.id+'"]');if(chip)chip.hidden=!show});
 d.querySelectorAll('[data-dayinfo]').forEach(function(el){el.hidden=!dd||el.getAttribute('data-dayinfo')!==dd.id})}
function setDay(id){var before=get(key,[]),n0=0;before.forEach(function(l){n0+=l.quantity});put(dayKey,id);
 var c=cart(),n1=0;
 // Keep each item within the new day's stock.
 var seen={};c=c.map(function(l){var st=menuStock(l.itemId),used=seen[l.itemId]||0,max=st==null?9999:Math.max(0,st-used),q=Math.min(l.quantity,max);seen[l.itemId]=used+q;return {itemId:l.itemId,quantity:q,note:l.note}}).filter(function(l){return l.quantity>0});
 c.forEach(function(l){n1+=l.quantity});save(c);applyDay();if(n1<n0)toast(T('Troli dikemas kini ikut menu hari dipilih.','Your cart now follows the menu for this day.'))}
if(data.page==='store'){
 applyDay();bar();
 var qi=d.getElementById('q');if(qi)qi.addEventListener('input',function(){query=qi.value.trim().toLowerCase();applyDay()});
 d.querySelectorAll('.cats a').forEach(function(a){a.addEventListener('click',function(){d.querySelectorAll('.cats a').forEach(function(x){x.classList.toggle('on',x===a)})})});
 d.querySelectorAll('[data-day]').forEach(function(b){b.onclick=function(){setDay(b.getAttribute('data-day'))}});
 d.addEventListener('click',function(e){var a=e.target.closest('[data-add]');if(a){e.stopPropagation();add(a.getAttribute('data-add'),1,'');return}var o=e.target.closest('[data-open]');if(o)openSheet(o.getAttribute('data-open'))});
 d.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.matches&&e.target.matches('[data-open]'))openSheet(e.target.getAttribute('data-open'))});
 var sheet=d.getElementById('sheet');
 var PLATE='<svg viewBox="0 0 48 48" fill="none" stroke="#B9AEA3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 30h32"/><path d="M11 30a13 13 0 0 1 26 0"/><path d="M24 14v3"/><path d="M6 34h36"/></svg>';
 function openSheet(id){var i=byId[id];if(!i)return;var q=1;var b=d.getElementById('sheetBody');var st=menuStock(i.id);var can=data.open&&st!==0;
  var stk=st===0?'<span class="tag">'+T('Habis','Sold out')+'</span>':st!=null?'<span class="stk'+(st<=5?' low':'')+'" style="font-size:13px">'+(st<=5?T('Tinggal '+st,'Only '+st+' left'):T('Stok '+st,st+' in stock'))+'</span>':'';
  b.innerHTML='<div class="ph">'+(i.photo?'<img src="'+esc(i.photo)+'" alt="">':PLATE)+'<button class="x" type="button" aria-label="'+T('Tutup','Close')+'"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button></div>'
   +'<div class="body">'+(i.promo?'<span class="tag p">'+esc(i.promo.name)+' '+esc(i.promo.label||'')+'</span>':'')+'<h3>'+esc(i.name)+'</h3>'
   +'<div class="row sp"><div class="pr'+(i.promo?' pm':'')+'">'+(i.promo?rm(i.promo.priceSen)+'<s>'+rm(i.priceSen)+'</s>':rm(i.priceSen))+'</div>'+stk+'</div>'
   +(i.description?'<p class="ds">'+esc(i.description)+'</p>':'')
   +(can?'<label class="f" for="sn">'+T('Nota untuk kedai','Note for the store')+' <small>'+T('(pilihan)','(optional)')+'</small></label><input class="in1" id="sn" maxlength="80" placeholder="'+T('Contoh: kurang manis','e.g. less sweet')+'">':'')+'</div>'
   +(can?'<div class="foot2"><div class="qty"><button type="button" data-q="-1" aria-label="'+T('Kurang','Fewer')+'">−</button><span id="sq">1</span><button type="button" data-q="1" aria-label="'+T('Tambah','More')+'">+</button></div><button class="btn" style="flex:1" type="button" id="sa"></button></div>':'<div style="height:16px"></div>');
  function lbl(){var s=d.getElementById('sa');if(s)s.textContent=T('Tambah','Add')+' · '+rm(price(i)*q);var sq=d.getElementById('sq');if(sq)sq.textContent=q}
  lbl();b.querySelector('.x').onclick=function(){sheet.close()};
  b.querySelectorAll('[data-q]').forEach(function(x){x.onclick=function(){q=Math.max(1,Math.min(99,Math.max(1,left(i.id)),q+Number(x.getAttribute('data-q'))));lbl()}});
  var sa=d.getElementById('sa');if(sa)sa.onclick=function(){add(i.id,q,d.getElementById('sn').value);sheet.close()};
  sheet.showModal();sheet.scrollTop=0}
 if(sheet)sheet.addEventListener('click',function(e){if(e.target===sheet)sheet.close()});
}
if(data.page==='checkout'){
 applyDay();
 var form=d.getElementById('co'),err=d.getElementById('err');
 var me=get('kedai:me',{});['name','phone','address'].forEach(function(k){var el=d.getElementById(k);if(el&&me[k])el.value=me[k]});
 function fulfilment(){var r=form.querySelector('input[name=fulfilment]:checked');return r?r.value:''}
 function fee(){if(fulfilment()!=='delivery')return 0;var o=d.getElementById('area');return o?Number(o.selectedOptions[0].getAttribute('data-fee')):0}
 function draw(){var c=cart(),el=d.getElementById('lines');
  el.innerHTML=c.length?c.map(function(l,n){var i=byId[l.itemId];return '<div class="ln"><div class="th">'+(i.photo?'<img src="'+esc(i.photo)+'" alt="">':'')+'</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px">'+esc(i.name)+'</div><div class="mut" style="font-size:12.5px">'+(i.promo?'<b style="color:var(--b)">'+esc(i.promo.name)+'</b>'+(l.note?' · ':''):'')+esc(l.note||'')+'</div><div class="row sp" style="margin-top:6px"><b style="font-size:14.5px">'+rm(price(i)*l.quantity)+'</b><div class="qs"><button class="sm" type="button" data-d="'+n+'" aria-label="'+T('Kurang','Fewer')+'">−</button><b>'+l.quantity+'</b><button class="sm" type="button" data-i="'+n+'" aria-label="'+T('Tambah','More')+'">+</button></div></div></div></div>'}).join(''):'<p class="mut" style="padding:12px 0;margin:0">'+T('Troli kosong.','Your cart is empty.')+'</p>';
  var t=totals(c),f=fee();d.getElementById('sub').textContent=rm(t.t+t.saved);d.getElementById('fee').textContent=rm(f);d.getElementById('feeRow').hidden=f===0;d.getElementById('total').textContent=rm(t.t+f);d.getElementById('sendT').textContent=rm(t.t+f);d.getElementById('cnt').textContent=t.n;
  d.getElementById('saved').textContent='−'+rm(t.saved);d.getElementById('savedRow').hidden=!t.saved;var dl=d.getElementById('dl');if(dl)dl.hidden=fulfilment()!=='delivery';
  d.getElementById('send').disabled=!c.length||!data.open}
 d.getElementById('lines').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var c=cart(),n=Number(b.getAttribute('data-d')||b.getAttribute('data-i'));if(!c[n])return;if(b.hasAttribute('data-i')){if(left(c[n].itemId,c)<=0){err.textContent=T('Stok '+byId[c[n].itemId].name+' tidak mencukupi.','Not enough stock of '+byId[c[n].itemId].name+'.');return}c[n].quantity+=1}else c[n].quantity-=1;if(c[n].quantity<1)c.splice(n,1);save(c);draw()});
 form.addEventListener('change',draw);draw();
 var MSG={name:['Masukkan nama anda.','Enter your name.'],phone:['Semak nombor WhatsApp, contoh 012-345 6789.','Check your WhatsApp number, e.g. 012-345 6789.'],address:['Isi alamat penghantaran.','Enter the delivery address.'],fulfilment:['Pilih ambil sendiri atau hantar.','Choose pickup or delivery.'],store_closed:['Kedai tidak menerima pesanan sekarang.','The store is not taking orders now.'],unavailable:['Satu item tidak lagi dijual. Semak troli.','An item is no longer sold. Check your cart.'],unknown_item:['Satu item tidak lagi dijual. Semak troli.','An item is no longer sold. Check your cart.'],below_minimum:['Jumlah belum capai minimum pesanan kedai.','Below the store\\'s minimum order.'],bad_area:['Pilih kawasan penghantaran.','Choose a delivery area.'],too_many_requests:['Terlalu banyak pesanan. Cuba sebentar lagi.','Too many orders. Please wait a little.'],batch_required:['Pilih tarikh tempahan.','Choose a day for your order.'],batch_closed:['Batch ini sudah ditutup. Muat semula dan pilih batch lain.','This batch has closed. Reload and choose another.'],batch_full:['Batch ini sudah penuh. Pilih batch lain.','This batch is full. Choose another.'],not_in_batch:['Satu item tiada dalam menu hari ini. Semak troli.','An item is not on the menu for this day. Check your cart.']};
 form.addEventListener('submit',function(e){e.preventDefault();err.textContent='';var c=cart();if(!c.length)return;
  if(!fulfilment()){err.textContent=T(MSG.fulfilment[0],MSG.fulfilment[1]);return}
  var v=function(id){var el=d.getElementById(id);return el?el.value:''};
  var body={lines:c,name:v('name'),phone:v('phone'),fulfilment:fulfilment(),batchId:(curDay()||{id:''}).id,area:fulfilment()==='delivery'?v('area'):'',address:fulfilment()==='delivery'?v('address'):'',note:v('note'),pay:(form.querySelector('input[name=pay]:checked')||form.querySelector('input[name=pay]')).value};
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
