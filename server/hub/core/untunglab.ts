/** UntungLab's licence server admin API (beli.untunglab.space), with the admin token JualanLab already uses. */
import { normaliseUlCode } from '../../core/untunglab';
import type { UntungLabAdmin } from './ports';

export function createUntungLabAdmin(opts: { baseUrl: string; adminToken: string; fetchImpl?: typeof fetch }): UntungLabAdmin {
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
    async activeCodes(email) {
      const r = await call('/api/admin/lookup', { email });
      const results = Array.isArray(r.results) ? (r.results as { code?: unknown; status?: unknown; email?: unknown }[]) : [];
      return results
        .filter((x) => x.status === 'active' && typeof x.code === 'string' && typeof x.email === 'string' && x.email.trim().toLowerCase() === email)
        .map((x) => normaliseUlCode(x.code as string))
        .filter((c): c is string => c !== null);
    },
    async issue(name, email, note) {
      const r = await call('/api/admin/issue', { name, email });
      if (typeof r.code !== 'string') throw new Error('UntungLab issue gave no code');
      // Best effort: mark the RM0 licence order with the smeLab order it came from.
      if (typeof r.orderId === 'string') await call('/api/admin/note', { orderId: r.orderId, note }).catch(() => undefined);
      return r.code;
    },
  };
}
