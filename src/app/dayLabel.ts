/** How business days are named on screen: the open day is "Today", others by the date they opened. */
import { crossesMidnight, openTooLong } from '../domain/bizday';
import { dayKey } from '../domain/day';
import { fill, type Dict, type Lang } from '../i18n/lang';

type DayLike = { openedAt: string; closedAt: string | null };
const loc = (lang: Lang) => (lang === 'ms' ? 'ms-MY' : 'en-MY');
const TZ = 'Asia/Kuala_Lumpur';

export function timeOf(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(loc(lang), { hour: 'numeric', minute: '2-digit', timeZone: TZ });
}

export function dateOf(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(loc(lang), { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
}

/** Time alone when it is today's date, otherwise date and time. */
export function whenShort(iso: string, lang: Lang, now: Date = new Date()): string {
  return dayKey(new Date(iso)) === dayKey(now) ? timeOf(iso, lang) : `${dateOf(iso, lang)}, ${timeOf(iso, lang)}`;
}

/** "Today" for the day being traded now; otherwise the date it opened ("Wed, 14 Oct"). */
export function dayName(d: DayLike, t: Dict, lang: Lang, now: Date = new Date()): string {
  return d.closedAt === null && !openTooLong(d, now) ? t.sales.today : dateOf(d.openedAt, lang);
}

/** "Opened 5:02 pm", or "5:02 pm to Thu, 15 Oct 1:40 am" for a day that ran past midnight. */
export function daySpan(d: DayLike, t: Dict, lang: Lang, now: Date = new Date()): string {
  if (d.closedAt === null) return fill(t.days.openSince, { when: whenShort(d.openedAt, lang, now) });
  const to = crossesMidnight(d, now) ? `${dateOf(d.closedAt, lang)}, ${timeOf(d.closedAt, lang)}` : timeOf(d.closedAt, lang);
  return fill(t.days.span, { from: timeOf(d.openedAt, lang), to });
}

/** "18:00" → "6:00 ptg" (Malaysian style, as on the store). */
export function clockText(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2)), m = hhmm.slice(3, 5);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${h < 12 ? 'pg' : h < 14 ? 'tgh' : h < 19 ? 'ptg' : 'mlm'}`;
}
