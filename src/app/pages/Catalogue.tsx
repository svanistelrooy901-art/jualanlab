import { useMemo, useState } from 'react';
import { effectiveMargin, groupByCategory, isPriceOverridden, MAX_CATEGORY, MAX_ITEM_NAME, type Item } from '../../domain/items';
import { formatPct, formatRM, parseRinggit } from '../../domain/money';
import { fill, useT } from '../../i18n/lang';
import { Api, ApiError } from '../api';
import { Layout } from '../components/Layout';
import { ErrorNote, Sheet } from '../components/Sheet';
import { errorText } from '../errors';
import { itemSubtitle, marginTone, matchesSearch } from '../itemLabels';
import { useShop } from '../session';

type Editing = { kind: 'new' } | { kind: 'edit'; item: Item } | null;

export function Catalogue() {
  const t = useT();
  const { items } = useShop();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Editing>(null);

  const shown = useMemo(() => items.filter((i) => matchesSearch(i, query)), [items, query]);
  const groups = groupByCategory(shown.filter((i) => i.active));
  const inactive = shown.filter((i) => !i.active).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Layout
      title={t.catalogue.title}
      back="/lagi"
      right={
        <button type="button" className="rounded-lg bg-brand-neon px-3 py-2 text-sm font-bold text-brand-ink" onClick={() => setEditing({ kind: 'new' })}>
          + {t.catalogue.addItem}
        </button>
      }
    >
      <input type="search" className="field" placeholder={t.catalogue.search} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t.catalogue.search} />
      {items.length === 0 && <p className="card mt-3 text-muted">{t.catalogue.empty}</p>}

      {groups.map((g) => (
        <section key={g.category ?? '—'} className="mt-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-subtle">{g.category ?? t.catalogue.noCategory}</h2>
          <ItemList items={g.items} all={items} onPick={(item) => setEditing({ kind: 'edit', item })} />
        </section>
      ))}
      {inactive.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-subtle">{t.catalogue.inactive}</h2>
          <ItemList items={inactive} all={items} onPick={(item) => setEditing({ kind: 'edit', item })} />
        </section>
      )}

      <Sheet open={editing !== null} title={editing?.kind === 'edit' ? t.catalogue.editTitle : t.catalogue.newTitle} onClose={() => setEditing(null)}>
        {editing && <ItemForm key={editing.kind === 'edit' ? editing.item.id : 'new'} editing={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </Layout>
  );
}

function ItemList({ items, all, onPick }: { items: Item[]; all: Item[]; onPick: (i: Item) => void }) {
  const t = useT();
  return (
    <ul className="card divide-y divide-border p-0">
      {items.map((i) => {
        const margin = effectiveMargin(i);
        const sub = itemSubtitle(i, all, t);
        return (
          <li key={i.id}>
            <button type="button" onClick={() => onPick(i)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas ${i.active ? '' : 'opacity-60'}`}>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">{i.name}</p>
                <p className="text-xs text-subtle">
                  {[sub, i.source === 'untunglab' ? t.catalogue.fromUl : null, isPriceOverridden(i) ? t.catalogue.ownPrice : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="text-right">
                <p className="num font-bold">{formatRM(i.priceSen)}</p>
                {margin !== null ? <p className={`num ml-auto w-fit rounded px-1 text-xs font-bold ${marginTone(i)}`}>{formatPct(margin)}</p> : <p className="text-xs text-subtle">{t.catalogue.marginNone}</p>}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ItemForm({ editing, onDone }: { editing: Exclude<Editing, null>; onDone: () => void }) {
  const t = useT();
  const { saveItem } = useShop();
  const existing = editing.kind === 'edit' ? editing.item : null;
  const fromUl = existing?.source === 'untunglab';
  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [price, setPrice] = useState(existing ? (existing.priceSen / 100).toFixed(2) : '');
  const [active, setActive] = useState(existing?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const priceSen = parseRinggit(price);
  const differsFromUl = fromUl && existing?.ulPriceSen !== null && priceSen !== null && priceSen !== existing?.ulPriceSen;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (priceSen === null) return setError(t.catalogue.badPrice);
    if (!fromUl && !name.trim()) return setError(t.catalogue.badName);
    setBusy(true);
    setError('');
    try {
      const cat = category.trim() || null;
      const r = existing
        ? await Api.updateItem(existing.id, fromUl ? { priceSen, active } : { name: name.trim(), category: cat, priceSen, active })
        : await Api.addItem({ name: name.trim(), category: cat, priceSen });
      await saveItem(r.item);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'bad_price') setError(t.catalogue.badPrice);
      else if (err instanceof ApiError && err.code === 'bad_name') setError(t.catalogue.badName);
      else if (err instanceof ApiError && err.offline) setError(t.catalogue.needsOnline);
      else setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {fromUl ? (
        <div>
          <p className="text-lg font-bold">{existing?.name}</p>
          <p className="text-sm text-subtle">{t.catalogue.nameFromUl}</p>
        </div>
      ) : (
        <>
          <div>
            <label className="label" htmlFor="itemName">
              {t.catalogue.name}
            </label>
            <input id="itemName" className="field" maxLength={MAX_ITEM_NAME} required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="itemCat">
              {t.catalogue.category}
            </label>
            <input id="itemCat" className="field" maxLength={MAX_CATEGORY} value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </>
      )}
      <div>
        <label className="label" htmlFor="itemPrice">
          {t.catalogue.price}
        </label>
        <input id="itemPrice" className="field num" inputMode="decimal" required placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} />
        {fromUl && existing?.ulPriceSen !== null && existing && (
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="num text-sm text-muted">{fill(t.catalogue.ulPrice, { price: formatRM(existing.ulPriceSen ?? 0) })}</p>
            {differsFromUl && (
              <button type="button" className="btn-ghost min-h-9 px-2 text-sm" onClick={() => setPrice(((existing.ulPriceSen ?? 0) / 100).toFixed(2))}>
                {t.catalogue.useUlPrice}
              </button>
            )}
          </div>
        )}
        {differsFromUl && <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{t.catalogue.overrideNote}</p>}
      </div>
      {existing && (
        <label className="flex min-h-12 items-center gap-3">
          <input type="checkbox" className="size-5 accent-[var(--color-primary)]" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>
            <span className="block font-semibold">{t.catalogue.active}</span>
            <span className="block text-xs text-subtle">{t.catalogue.activeHint}</span>
          </span>
        </label>
      )}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? t.app.saving : t.app.save}
      </button>
      <ErrorNote>{error}</ErrorNote>
    </form>
  );
}
