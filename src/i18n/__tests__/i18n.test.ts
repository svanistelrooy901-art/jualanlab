import { describe, expect, it } from 'vitest';
import { en } from '../en';
import { ms } from '../ms';
import { fill } from '../lang';

type Tree = { [k: string]: string | Tree };

function flatten(t: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(t)) {
    if (typeof v === 'string') out.set(prefix + k, v);
    else for (const [kk, vv] of flatten(v, `${prefix}${k}.`)) out.set(kk, vv);
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('copy', () => {
  const m = flatten(ms as unknown as Tree);
  const e = flatten(en as unknown as Tree);

  it('English has exactly the Malay keys', () => {
    expect([...e.keys()].sort()).toEqual([...m.keys()].sort());
  });

  it('every placeholder in Malay is in English, and none are invented', () => {
    for (const [k, v] of m) expect(placeholders(e.get(k)!), k).toEqual(placeholders(v));
  });

  it('no empty strings', () => {
    for (const [k, v] of [...m, ...e]) expect(v.trim(), k).not.toBe('');
  });

  it('fill replaces known placeholders and leaves unknown ones', () => {
    expect(fill('{n} item · {total}', { n: 3, total: 'RM9.00' })).toBe('3 item · RM9.00');
    expect(fill('{x}', {})).toBe('{x}');
  });
});
