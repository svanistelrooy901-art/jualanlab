/**
 * Where each hand-off opens, and how a receiver finds the payload.
 * The payload always travels in the URL fragment (after #), so no server ever receives it.
 */
import { decodeBatchList, encodeBatchList } from './batchList';
import { decodePriceList, encodePriceList, validatePriceList } from './priceList';
import type { BatchList, DecodeResult, PriceList } from './types';

export const JUALANLAB_ORIGIN = 'https://jualan.untunglab.space';
export const UNTUNGLAB_ORIGIN = 'https://untunglab.space';

/** JualanLab route that receives a price list. */
export const PRICE_LIST_PATH = '/terima';
/** UntungLab HashRouter route that opens Plan a Batch. */
export const BATCH_ROUTE = '/rancang-batch';

/**
 * Longest link offered as a QR code: about QR version 29 at error level L (1,628 bytes),
 * shown full-screen. Above this the QR gets too dense to scan reliably from another phone's
 * screen, so the sender offers the file fallback instead. Confirm on real phones in Phase 2.
 */
export const QR_MAX_LINK_CHARS = 1600;

export function priceListLink(list: PriceList, origin = JUALANLAB_ORIGIN): string {
  return `${origin}${PRICE_LIST_PATH}#d=${encodePriceList(list)}`;
}

export function batchListLink(list: BatchList, origin = UNTUNGLAB_ORIGIN): string {
  return `${origin}/#${BATCH_ROUTE}?d=${encodeBatchList(list)}`;
}

export function fitsInQr(link: string): boolean {
  return link.length <= QR_MAX_LINK_CHARS;
}

/**
 * Finds `d=` in a full URL, a fragment (`#d=…`, `#/rancang-batch?d=…`) or a bare payload.
 * Returns null when there is none.
 */
export function extractPayload(input: string): string | null {
  const s = input.trim();
  if (s.startsWith('1.')) return s;
  const hashAt = s.indexOf('#');
  const frag = hashAt >= 0 ? s.slice(hashAt + 1) : s;
  const q = frag.includes('?') ? frag.slice(frag.indexOf('?') + 1) : frag;
  const d = new URLSearchParams(q).get('d');
  return d && d.length > 0 ? d : null;
}

export function readPriceListLink(input: string): DecodeResult<PriceList> {
  const p = extractPayload(input);
  return p === null ? { ok: false, error: { code: 'not_a_link' } } : decodePriceList(p);
}

export function readBatchListLink(input: string): DecodeResult<BatchList> {
  const p = extractPayload(input);
  return p === null ? { ok: false, error: { code: 'not_a_link' } } : decodeBatchList(p);
}

/** File fallback: the plain JSON, pretty-printed, same rules as the link. */
export function priceListFileName(sentAt: string): string {
  return `untunglab-harga-${sentAt.slice(0, 10)}.json`;
}

export function priceListFileText(list: PriceList): string {
  const checked = validatePriceList(list);
  if (!checked.ok) throw new Error('refusing to write an invalid price list');
  return JSON.stringify(checked.value, null, 2) + '\n';
}

export function readPriceListFile(text: string): DecodeResult<PriceList> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: { code: 'bad_json' } };
  }
  return validatePriceList(json);
}
