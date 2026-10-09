import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { planImport, planIsEmpty, type ItemChange } from '../../domain/importPlan';
import { effectiveMargin, type Item } from '../../domain/items';
import { formatPct, formatRM } from '../../domain/money';
import { readPriceListFile, readPriceListLink } from '../../link/links';
import type { DecodeResult, LinkError, PriceList } from '../../link/types';
import { fill, formatWhen, useLang, useT, type Dict } from '../../i18n/lang';
import { Api, ApiError } from '../api';
import { Layout } from '../components/Layout';
import { ErrorNote } from '../components/Sheet';
import { errorText } from '../errors';
import { takePendingLink } from '../pendingLink';
import { useShop } from '../session';

function linkErrorText(e: LinkError, t: Dict): string {
  return fill(t.receive.err[e.code], { path: e.path ?? '?' });
}

export function Receive() {
  const t = useT();
  const lang = useLang();
  const { items, setItems, setLastImport, refreshItems } = useShop();
  const [list, setList] = useState<PriceList | null>(null);
  const [paste, setPaste] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ add: number; change: number } | null>(null);

  function take(r: DecodeResult<PriceList>) {
    if (r.ok) {
      setList(r.value);
      setError('');
    } else setError(linkErrorText(r.error, t));
  }

  // Opened from UntungLab's link (#d=…), or a link kept while signing in.
  useEffect(() => {
    const fromUrl = window.location.hash.includes('d=') ? window.location.hash : null;
    const kept = takePendingLink(); // always cleared, so it is never offered twice
    const source = fromUrl ?? kept;
    if (fromUrl) window.history.replaceState(null, '', window.location.pathname);
    if (source) take(readPriceListLink(source));
    void refreshItems();
  }, []);

  const plan = useMemo(() => (list ? planImport(items, list, { now: new Date().toISOString(), newId: () => 'preview' }) : null), [items, list]);

  async function accept() {
    if (!list) return;
    setBusy(true);
    setError('');
    try {
      const r = await Api.importPrices(list);
      await setItems(r.items);
      await setLastImport(r.lastImport);
      setDone({ add: r.added, change: r.changed });
      setList(null);
    } catch (e) {
      if (e instanceof ApiError && e.offline) setError(t.receive.needsOnline);
      else if (e instanceof ApiError && e.code === 'bad_price_list') setError(linkErrorText((e.extra.linkError as LinkError) ?? { code: 'invalid' }, t));
      else setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function openFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) return setError(t.receive.err.too_large);
    take(readPriceListFile(await file.text()));
  }

  if (done) {
    return (
      <Layout title={t.receive.title} back="/">
        <div className="card text-center">
          <p className="font-bold text-good">{fill(t.receive.done, { add: done.add, change: done.change })}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link to="/kaunter" className="btn-primary">
              {t.home.startSelling}
            </Link>
            <Link to="/katalog" className="btn-secondary">
              {t.home.openCatalogue}
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  if (!list || !plan) {
    return (
      <Layout title={t.receive.title} back="/">
        <section className="card">
          <h2 className="font-bold">{t.receive.pasteTitle}</h2>
          <p className="mb-3 mt-1 text-sm text-muted">{t.receive.pasteHint}</p>
          <textarea className="field min-h-24 py-2 text-sm" placeholder={t.receive.pastePlaceholder} value={paste} onChange={(e) => setPaste(e.target.value)} aria-label={t.receive.pasteTitle} />
          <button type="button" className="btn-primary mt-2 w-full" disabled={!paste.trim()} onClick={() => take(readPriceListLink(paste))}>
            {t.receive.read}
          </button>
          <label className="btn-secondary mt-2 w-full">
            {t.receive.openFile}
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void openFile(e.target.files?.[0])} />
          </label>
        </section>
        <ErrorNote>{error}</ErrorNote>
      </Layout>
    );
  }

  const baseName = (id: string | null) => (id ? (list.menus.find((m) => m.id === id)?.name ?? null) : null);

  return (
    <Layout
      title={t.receive.title}
      back="/"
      footer={
        <div className="flex gap-2 border-t border-border bg-surface px-4 py-3">
          <button type="button" className="btn-secondary" onClick={() => setList(null)}>
            {t.app.cancel}
          </button>
          <button type="button" className="btn-primary flex-1" disabled={busy} onClick={() => void accept()}>
            {busy ? t.receive.accepting : fill(t.receive.accept, { n: list.menus.length })}
          </button>
        </div>
      }
    >
      <section className="rounded-2xl bg-brand-ink p-4 text-white">
        <p className="text-sm font-semibold text-brand-neon">{t.receive.from}</p>
        <p className="mt-1 text-sm text-brand-muted">{fill(t.receive.sentAt, { when: formatWhen(list.sentAt, lang), n: list.menus.length })}</p>
        <p className="mt-2 font-bold">
          {fill(t.receive.counts, { add: plan.add.length, change: plan.change.length, same: plan.same.length })}
          {plan.deactivate.length > 0 && ` · ${fill(t.receive.removed, { n: plan.deactivate.length })}`}
        </p>
      </section>

      {planIsEmpty(plan) && <p className="card mt-3 text-muted">{t.receive.nothingNew}</p>}

      {plan.change.length > 0 && (
        <Group title={t.receive.changed}>
          {plan.change.map((c) => (
            <ChangeRow key={c.after.id} c={c} />
          ))}
        </Group>
      )}
      {plan.add.length > 0 && (
        <Group title={t.receive.added}>
          {plan.add.map((i) => (
            <li key={i.ulMenuId} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{i.name}</p>
                <p className="text-xs text-subtle">
                  {[baseName(i.baseUlMenuId) && fill(t.receive.variationOf, { name: baseName(i.baseUlMenuId)! }), i.category, marginText(i, t)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <p className="num font-bold">{formatRM(i.priceSen)}</p>
            </li>
          ))}
        </Group>
      )}
      {plan.deactivate.length > 0 && (
        <Group title={t.receive.deactivated}>
          {plan.deactivate.map((c) => (
            <li key={c.before.id} className="px-4 py-3">
              <p className="font-bold text-muted line-through">{c.before.name}</p>
            </li>
          ))}
          <li className="px-4 py-3 text-sm text-muted">{t.receive.deactivatedNote}</li>
        </Group>
      )}
      <ErrorNote>{error}</ErrorNote>
    </Layout>
  );
}

function marginText(i: Item, t: Dict): string {
  const m = effectiveMargin(i);
  return m === null ? t.receive.incomplete : fill(t.receive.margin, { pct: formatPct(m) });
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-subtle">{title}</h2>
      <ul className="card divide-y divide-border p-0">{children}</ul>
    </section>
  );
}

function ChangeRow({ c }: { c: ItemChange }) {
  const t = useT();
  const priceMoved = c.before.priceSen !== c.after.priceSen;
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold">{c.after.name}</p>
          <p className="text-xs text-subtle">{marginText(c.after, t)}</p>
        </div>
        <p className="num text-right font-bold">
          {priceMoved && <span className="mr-2 text-sm font-normal text-subtle line-through">{formatRM(c.before.priceSen)}</span>}
          {formatRM(c.after.priceSen)}
        </p>
      </div>
      {c.keptOwnPrice && (
        <p className="num mt-1 rounded-lg bg-warn-soft px-2 py-1 text-xs text-warn">
          {fill(t.receive.keptOwnPrice, { price: formatRM(c.after.priceSen), ul: formatRM(c.after.ulPriceSen ?? 0) })}
        </p>
      )}
    </li>
  );
}
