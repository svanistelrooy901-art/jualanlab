/**
 * Senarai sedia (prep list): what to make for one pre-order batch, or for every open order. Totals per item with
 * the customers' notes, unpaid orders shown apart (they may still expire), a print button, and the quantities sent
 * to UntungLab's Plan a Batch for the ingredient shopping list (link format, DECISIONS phase 2).
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Batch, PrepList } from '../../domain/kedai';
import { fill, useT } from '../../i18n/lang';
import { batchListLink } from '../../link/links';
import { Api } from '../api';
import { Layout } from '../components/Layout';
import { ErrorNote } from '../components/Sheet';
import { errorText } from '../errors';
import { useShop } from '../session';

export function Prep() {
  const t = useT();
  const { items } = useShop();
  const [params, setParams] = useSearchParams();
  const batchId = params.get('batch');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [prep, setPrep] = useState<PrepList | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([Api.kedai(), Api.orders('open')])
      .then(([k, o]) => {
        const list = [...(k.store?.preorder?.batches ?? [])];
        // Next-day pre-orders (mode 'auto') appear as their own day.
        for (const x of o.orders) if (x.batchId?.startsWith('auto-') && x.batchLabel && !list.some((b) => b.id === x.batchId)) list.push({ id: x.batchId, label: x.batchLabel, readyDate: x.readyDate ?? '', closesAt: '', maxOrders: null });
        setBatches(list);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    setPrep(null);
    Api.prep(batchId)
      .then((r) => setPrep(r.prep))
      .catch((e) => setError(errorText(e, t)));
  }, [batchId, t]);

  const batch = batches.find((b) => b.id === batchId) ?? null;
  // Plan a Batch in UntungLab: items linked to UntungLab go by their menu id; the rest are listed by name.
  const untung = useMemo(() => {
    if (!prep || prep.lines.length === 0) return null;
    const byId = new Map(items.map((i) => [i.id, i]));
    const linked = prep.lines.filter((l) => byId.get(l.itemId)?.ulMenuId);
    if (linked.length === 0) return null;
    return batchListLink({
      app: 'jualanlab', kind: 'batch-list', format: 1, sentAt: new Date().toISOString(),
      batchDate: batch?.readyDate ?? new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10),
      items: linked.map((l) => ({ menuId: byId.get(l.itemId)!.ulMenuId!, name: l.name, quantity: l.quantity })),
      notInUntungLab: prep.lines.filter((l) => !byId.get(l.itemId)?.ulMenuId).map((l) => ({ name: l.name, quantity: l.quantity })),
    });
  }, [prep, items, batch]);

  return (
    <Layout title={t.prep.title} back="/pesanan">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 print:hidden" role="tablist">
        <button type="button" role="tab" aria-selected={!batchId} className={`chip ${!batchId ? 'chip-on' : ''}`} onClick={() => setParams({})}>
          {t.prep.allOpen}
        </button>
        {batches.map((b) => (
          <button key={b.id} type="button" role="tab" aria-selected={batchId === b.id} className={`chip ${batchId === b.id ? 'chip-on' : ''}`} onClick={() => setParams({ batch: b.id })}>
            {b.label}
          </button>
        ))}
      </div>
      <ErrorNote>{error}</ErrorNote>
      {prep && (
        <div className="mt-3 space-y-3">
          <div className="card">
            <h2 className="text-xl font-extrabold">{batch ? batch.label : t.prep.allOpen}</h2>
            <p className="mt-1 text-sm text-muted">
              {fill(t.prep.summary, { n: prep.orders, pickup: prep.pickup, delivery: prep.delivery })}
              {prep.unpaidOrders > 0 && <span className="font-bold text-warn"> · {fill(t.prep.unpaidOrders, { n: prep.unpaidOrders })}</span>}
            </p>
          </div>
          {prep.lines.length === 0 ? (
            <p className="card text-center text-muted">{t.prep.empty}</p>
          ) : (
            <ul className="card divide-y divide-border p-0">
              {prep.lines.map((l) => (
                <li key={l.itemId} className="flex items-start gap-3 px-4 py-3">
                  <span className="num w-14 flex-none text-right text-2xl font-extrabold">{l.quantity}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{l.name}</span>
                    {l.unpaid > 0 && <span className="block text-xs font-semibold text-warn">{fill(t.prep.unpaid, { n: l.unpaid })}</span>}
                    {l.notes.map((n) => (
                      <span key={n.note} className="block text-sm text-muted">
                        {n.quantity}× “{n.note}”
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-2 print:hidden">
            <button type="button" className="btn-secondary min-h-12" onClick={() => window.print()} disabled={prep.lines.length === 0}>
              {t.prep.print}
            </button>
            {untung ? (
              <a className="btn-primary min-h-12" href={untung} target="_blank" rel="noopener">
                {t.prep.untung}
              </a>
            ) : (
              <span />
            )}
          </div>
          {untung && <p className="text-xs text-subtle print:hidden">{t.prep.untungHint}</p>}
        </div>
      )}
    </Layout>
  );
}
