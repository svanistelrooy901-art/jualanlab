import { readFileSync } from 'node:fs';
import { deflateSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  batchListLink, decodePayload, encodePayload, extractPayload, fitsInQr, MAX_JSON_BYTES, priceListFileName,
  priceListFileText, priceListLink, readBatchListLink, readPriceListFile, readPriceListLink, ringgitToSen, roundMargin,
  validateBatchList, validatePriceList, QR_MAX_LINK_CHARS,
} from '..';
import type { BatchList, PriceList, PriceListMenu } from '..';

const fx = (f: string) => readFileSync(new URL(`../../../spec/fixtures/${f}`, import.meta.url), 'utf8');
const price = JSON.parse(fx('price-list.valid.json')) as PriceList;
const batch = JSON.parse(fx('batch-list.valid.json')) as BatchList;
const invalid = JSON.parse(fx('invalid-cases.json')) as {
  name: string; reader: 'price-list' | 'batch-list'; json: unknown; expect: { code: string; path?: string };
}[];

describe('valid fixtures', () => {
  it('price list passes unchanged, with no warnings', () => {
    const r = validatePriceList(price);
    expect(r).toEqual({ ok: true, value: price, warnings: [] });
  });
  it('batch list passes unchanged', () => {
    expect(validateBatchList(batch)).toEqual({ ok: true, value: batch, warnings: [] });
  });
  it('a variation whose base is not in the list is a warning, not an error', () => {
    const r = validatePriceList(JSON.parse(fx('price-list.base-missing.json')));
    expect(r.ok && r.warnings).toEqual([{ code: 'base_missing', path: 'menus[0].baseMenuId' }]);
  });
});

describe('invalid fixtures', () => {
  it.each(invalid.map((c) => [c.name, c] as const))('%s', (_n, c) => {
    const r = c.reader === 'price-list' ? validatePriceList(c.json) : validateBatchList(c.json);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe(c.expect.code);
      if (c.expect.path) expect(r.error.path).toBe(c.expect.path);
    }
  });
});

describe('links', () => {
  it('stored fixture links decode to the fixture JSON', () => {
    expect(readPriceListLink(fx('price-list.valid.link.txt'))).toEqual({ ok: true, value: price, warnings: [] });
    expect(readBatchListLink(fx('batch-list.valid.link.txt'))).toEqual({ ok: true, value: batch, warnings: [] });
  });
  it('price list opens JualanLab /terima with the payload after #', () => {
    const link = priceListLink(price);
    expect(link.startsWith('https://jualan.untunglab.space/terima#d=1.')).toBe(true);
    expect(link.split('#')[0]).not.toContain('d=');
  });
  it('batch list opens the UntungLab HashRouter route', () => {
    expect(batchListLink(batch).startsWith('https://untunglab.space/#/rancang-batch?d=1.')).toBe(true);
  });
  it('round trip keeps Malay text and symbols', () => {
    const p = structuredClone(price);
    p.menus[0]!.name = 'Kuih “Seri Muka” — ½ dulang';
    const r = readPriceListLink(priceListLink(p));
    expect(r.ok && r.value.menus[0]!.name).toBe('Kuih “Seri Muka” — ½ dulang');
  });
  it('finds the payload in a URL, a fragment or on its own', () => {
    const link = priceListLink(price);
    const payload = link.split('#d=')[1]!;
    expect(extractPayload(link)).toBe(payload);
    expect(extractPayload('#d=' + payload)).toBe(payload);
    expect(extractPayload(payload)).toBe(payload);
    expect(extractPayload('https://untunglab.space/#/rancang-batch?x=1&d=' + payload)).toBe(payload);
    expect(readPriceListLink('https://jualan.untunglab.space/terima').ok).toBe(false);
    expect(readPriceListLink('https://jualan.untunglab.space/terima')).toMatchObject({ error: { code: 'not_a_link' } });
  });
  it('a link for the other app is refused by app, not by field', () => {
    const asBatch = priceListLink(price).replace('https://jualan.untunglab.space/terima#', 'https://untunglab.space/#/rancang-batch?');
    expect(readBatchListLink(asBatch)).toMatchObject({ ok: false, error: { code: 'wrong_app' } });
  });
});

describe('envelope', () => {
  it('rejects an unknown scheme, damaged base64 and damaged deflate data', () => {
    const good = encodePayload({ a: 1 });
    expect(decodePayload('2.' + good.slice(2))).toMatchObject({ ok: false, error: { code: 'bad_encoding' } });
    expect(decodePayload('1.abc$')).toMatchObject({ ok: false, error: { code: 'bad_encoding' } });
    expect(decodePayload('1.' + 'A'.repeat(41))).toMatchObject({ ok: false, error: { code: 'bad_encoding' } });
    expect(decodePayload(good.slice(0, good.length - 3))).toMatchObject({ ok: false });
  });
  it('rejects text that is not JSON', () => {
    const notJson = '1.' + Buffer.from(deflateSync(strToU8('not json'))).toString('base64url');
    expect(decodePayload(notJson)).toMatchObject({ ok: false, error: { code: 'bad_json' } });
  });
  it('stops a decompression bomb before it fills memory', () => {
    const bomb = '1.' + Buffer.from(deflateSync(new Uint8Array(MAX_JSON_BYTES + 10).fill(32), { level: 9 })).toString('base64url');
    expect(bomb.length).toBeLessThan(5000);
    expect(decodePayload(bomb)).toMatchObject({ ok: false, error: { code: 'too_large' } });
  });
  it('refuses to encode an invalid list', () => {
    const bad = structuredClone(price);
    bad.menus[0]!.priceSen = 1.5;
    expect(() => priceListLink(bad)).toThrow(/invalid price list/);
  });
});

describe('file fallback', () => {
  it('names the file by the date sent and reads it back', () => {
    expect(priceListFileName(price.sentAt)).toBe('untunglab-harga-2026-10-09.json');
    expect(readPriceListFile(priceListFileText(price))).toEqual({ ok: true, value: price, warnings: [] });
    expect(readPriceListFile('{oops')).toMatchObject({ ok: false, error: { code: 'bad_json' } });
  });
});

describe('sender helpers', () => {
  it('converts ringgit to sen without float drift', () => {
    expect(ringgitToSen(1.15)).toBe(115);
    expect(ringgitToSen(4.35)).toBe(435);
    expect(ringgitToSen(0.1 + 0.2)).toBe(30);
    expect(ringgitToSen(0)).toBe(0);
  });
  it('rounds margin to 2 decimals and keeps null', () => {
    expect(roundMargin(31.23456)).toBe(31.23);
    expect(roundMargin(-4.555)).toBe(-4.55);
    expect(roundMargin(null)).toBe(null);
  });
});

describe('QR capacity', () => {
  const names = ['Karipap kentang', 'Kek batik sepotong', 'Brownies coklat', 'Puding roti', 'Murtabak daging',
    'Kuih lapis', 'Popia goreng', 'Air bandung', 'Nasi lemak bungkus', 'Seri muka', 'Kopi O ais', 'Teh tarik'];
  const menu = (i: number): PriceListMenu => ({
    id: crypto.randomUUID(),
    name: `${names[i % names.length]}${i >= names.length ? ' ' + (Math.floor(i / names.length) + 1) : ''}`,
    category: ['Kuih', 'Kek', 'Minuman', 'Bazar'][i % 4]!,
    priceSen: 100 + ((i * 137) % 1900),
    marginPct: Math.round((((i * 7.31) % 60) + 10) * 100) / 100,
    status: 'watch',
    baseMenuId: null,
  });
  const list = (n: number): PriceList => ({ ...price, menus: Array.from({ length: n }, (_, i) => menu(i)) });

  it(`a typical home menu (15 items with real UUIDs) fits in one QR (≤ ${QR_MAX_LINK_CHARS} chars)`, () => {
    let fit = 0;
    for (let n = 1; n <= 200; n++) {
      if (fitsInQr(priceListLink(list(n)))) fit = n;
      else break;
    }
    console.log(`menus per QR with UUID ids: ${fit}`);
    expect(fit).toBeGreaterThanOrEqual(15);
  });
  it('500 menus still make a valid link (file fallback size is not the limit)', () => {
    const link = priceListLink(list(500));
    expect(fitsInQr(link)).toBe(false);
    expect(readPriceListLink(link).ok).toBe(true);
  });
});
