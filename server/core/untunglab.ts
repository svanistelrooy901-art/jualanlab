/** UntungLab's licence server (beli.untunglab.space), used with its admin token for the UntungLab-user price and the bundle. */
import type { UntungLabLicences } from './ports';

/** UntungLab's own code alphabet (src/license/code.ts there): no 0/O, 1/I/L or U. */
const UL_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

/** Canonical "UL-XXXX-XXXX-XXXX" form of what a person typed (same rules as UntungLab), or null if it cannot be a code. */
export function normaliseUlCode(input: string): string | null {
  let s = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.startsWith('UL')) s = s.slice(2);
  if (s.length !== 12 || [...s].some((c) => !UL_ALPHABET.includes(c))) return null;
  return `UL-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

export function createUntungLabLicences(opts: { baseUrl: string; adminToken: string; fetchImpl?: typeof fetch }): UntungLabLicences {
  const f = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/+$/, '');
  const call = async (path: string, body: unknown) => {
    const res = await f(`${base}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${opts.adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`UntungLab ${path} answered ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  };
  return {
    async check(code) {
      const r = await call('/api/admin/lookup', { code });
      const results = Array.isArray(r.results) ? (r.results as { code?: string; status?: string }[]) : [];
      const want = normaliseUlCode(code);
      const hit = results.find((x) => typeof x.code === 'string' && want !== null && normaliseUlCode(x.code) === want);
      if (!hit) return 'unknown';
      return hit.status === 'revoked' ? 'revoked' : hit.status === 'active' ? 'active' : 'unknown';
    },
    async issue(name, email) {
      const r = await call('/api/admin/issue', { name, email });
      if (typeof r.code !== 'string') throw new Error('UntungLab issue gave no code');
      return r.code;
    },
  };
}
