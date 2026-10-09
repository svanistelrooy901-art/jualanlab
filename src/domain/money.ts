/** Money is integer sen everywhere (DECISIONS L-04). Only this file turns sen into text or text into sen. */

const MINUS = '−';

/** RM1,234.50. Negative values carry a real minus sign; a value that rounds to zero has none. */
export function formatRM(sen: number): string {
  const rounded = Math.round(sen);
  const abs = Math.abs(rounded);
  const ringgit = Math.floor(abs / 100).toLocaleString('en-MY');
  const cents = String(abs % 100).padStart(2, '0');
  return `${rounded < 0 ? MINUS : ''}RM${ringgit}.${cents}`;
}

/** Short form for tiles and buttons: RM7, RM3.50. */
export function formatRMShort(sen: number): string {
  return sen % 100 === 0 ? `RM${(sen / 100).toLocaleString('en-MY')}` : formatRM(sen);
}

/**
 * Reads what a Malaysian user types: "5", "5.5", "5,50", "RM 1,000", "1,000.50".
 * A lone comma followed by exactly three digits is a thousands separator; otherwise a comma is a decimal point.
 * Returns null for anything else, negative values or more than 2 decimals.
 */
export function parseRinggit(input: string): number | null {
  let s = input.trim().replace(/^rm\s*/i, '').replace(/\s+/g, '');
  if (s === '') return null;
  const commas = (s.match(/,/g) ?? []).length;
  const dots = (s.match(/\./g) ?? []).length;
  if (commas > 0 && dots > 0) {
    // 1,000.50: commas are thousands separators and must sit in groups of three
    if (!/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s)) return null;
    s = s.replace(/,/g, '');
  } else if (commas === 1 && dots === 0) {
    s = /^\d{1,3},\d{3}$/.test(s) ? s.replace(',', '') : s.replace(',', '.');
  } else if (commas > 1) {
    if (!/^\d{1,3}(,\d{3})+$/.test(s)) return null;
    s = s.replace(/,/g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const sen = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(sen) ? sen : null;
}

export function formatPct(pct: number | null): string {
  if (pct === null) return '—';
  const v = Math.round(pct * 10) / 10;
  return `${v < 0 ? MINUS : ''}${Math.abs(v).toLocaleString('en-MY', { maximumFractionDigits: 1 })}%`;
}
