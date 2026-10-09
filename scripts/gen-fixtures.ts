/**
 * Regenerates the derived fixtures from the two valid ones:
 *   spec/fixtures/invalid-cases.json   every rule in the spec, one broken payload each
 *   spec/fixtures/*.link.txt           the valid payloads as real links
 * Run: npx tsx scripts/gen-fixtures.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { batchListLink, priceListLink } from '../src/link';
import type { BatchList, PriceList } from '../src/link';

const dir = new URL('../spec/fixtures/', import.meta.url);
const read = <T>(f: string): T => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as T;
const price = read<PriceList>('price-list.valid.json');
const batch = read<BatchList>('batch-list.valid.json');
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

type Case = { name: string; reader: 'price-list' | 'batch-list'; json: unknown; expect: { code: string; path?: string } };
const cases: Case[] = [];
const p = (name: string, mutate: (x: any) => void, code: string, path?: string) => {
  const x = clone(price);
  mutate(x);
  cases.push({ name, reader: 'price-list', json: x, expect: path ? { code, path } : { code } });
};
const b = (name: string, mutate: (x: any) => void, code: string, path?: string) => {
  const x = clone(batch);
  mutate(x);
  cases.push({ name, reader: 'batch-list', json: x, expect: path ? { code, path } : { code } });
};

// Header
p('batch list read as a price list', (x) => Object.assign(x, clone(batch)), 'wrong_app', 'app');
p('unknown kind', (x) => (x.kind = 'backup'), 'wrong_kind', 'kind');
p('newer format', (x) => (x.format = 2), 'newer_format', 'format');
p('format zero', (x) => (x.format = 0), 'invalid', 'format');
p('sentAt without time zone', (x) => (x.sentAt = '2026-10-09T20:42:00'), 'invalid', 'sentAt');
p('currency not MYR', (x) => (x.currency = 'SGD'), 'invalid', 'currency');
p('no menus', (x) => (x.menus = []), 'invalid', 'menus');
p('menus not an array', (x) => (x.menus = {}), 'invalid', 'menus');
// Menu fields
p('duplicate id', (x) => (x.menus[1].id = x.menus[0].id), 'invalid', 'menus[1].id');
p('id with a space', (x) => (x.menus[0].id = 'm karipap'), 'invalid', 'menus[0].id');
p('blank name', (x) => (x.menus[0].name = '   '), 'invalid', 'menus[0].name');
p('name too long', (x) => (x.menus[0].name = 'K'.repeat(121)), 'invalid', 'menus[0].name');
p('name with a control character', (x) => (x.menus[0].name = 'Kari\u0007pap'), 'invalid', 'menus[0].name');
p('category too long', (x) => (x.menus[0].category = 'C'.repeat(61)), 'invalid', 'menus[0].category');
p('price in ringgit, not sen', (x) => (x.menus[0].priceSen = 1.5), 'invalid', 'menus[0].priceSen');
p('negative price', (x) => (x.menus[0].priceSen = -100), 'invalid', 'menus[0].priceSen');
p('price as text', (x) => (x.menus[0].priceSen = '100'), 'invalid', 'menus[0].priceSen');
p('margin above 100', (x) => (x.menus[0].marginPct = 120), 'invalid', 'menus[0].marginPct');
p('margin as text', (x) => (x.menus[0].marginPct = '31.2'), 'invalid', 'menus[0].marginPct');
p('status without a margin', (x) => (x.menus[0].marginPct = null), 'invalid', 'menus[0].status');
p('margin without a status', (x) => (x.menus[4].marginPct = 20), 'invalid', 'menus[4].status');
p('unknown status', (x) => (x.menus[0].status = 'great'), 'invalid', 'menus[0].status');
p('price 0 with a margin', (x) => (x.menus[0].priceSen = 0), 'invalid', 'menus[0].marginPct');
p('variation of itself', (x) => (x.menus[3].baseMenuId = x.menus[3].id), 'invalid', 'menus[3].baseMenuId');
p('variation of a variation', (x) => {
  x.menus.push({ id: 'm-brownies-03', name: 'Brownies kacang besar', category: 'Kek', priceSen: 500, marginPct: 36, status: 'watch', baseMenuId: 'm-brownies-02' });
}, 'invalid', 'menus[7].baseMenuId');
// Batch list
b('price list read as a batch list', (x) => Object.assign(x, clone(price)), 'wrong_app', 'app');
b('newer batch format', (x) => (x.format = 2), 'newer_format', 'format');
b('date that does not exist', (x) => (x.batchDate = '2026-02-30'), 'invalid', 'batchDate');
b('date with time', (x) => (x.batchDate = '2026-10-18T10:00'), 'invalid', 'batchDate');
b('quantity zero', (x) => (x.items[0].quantity = 0), 'invalid', 'items[0].quantity');
b('quantity with decimals', (x) => (x.items[0].quantity = 2.5), 'invalid', 'items[0].quantity');
b('duplicate menuId', (x) => (x.items[1].menuId = x.items[0].menuId), 'invalid', 'items[1].menuId');
b('empty batch', (x) => {
  x.items = [];
  x.notInUntungLab = [];
}, 'invalid', 'items');
b('blank extra item name', (x) => (x.notInUntungLab[0].name = ''), 'invalid', 'notInUntungLab[0].name');

writeFileSync(new URL('invalid-cases.json', dir), JSON.stringify(cases, null, 2) + '\n');
writeFileSync(new URL('price-list.valid.link.txt', dir), priceListLink(price) + '\n');
writeFileSync(new URL('batch-list.valid.link.txt', dir), batchListLink(batch) + '\n');
console.log(`${cases.length} invalid cases, 2 links written`);
