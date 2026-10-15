import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addItem, cartTotals, removeOne } from '../../domain/cart';
import { effectiveMargin, groupByCategory, type Item } from '../../domain/items';
import { formatPct, formatRM } from '../../domain/money';
import { fill, useT } from '../../i18n/lang';
import { clearCart, updateCart, useCart } from '../cart';
import { Layout } from '../components/Layout';
import { LongOpenNote, Notice, OpenDayCard } from '../components/OpenDay';
import { useDays } from '../useDay';
import { itemSubtitle, marginTone, matchesSearch } from '../itemLabels';
import { useShop } from '../session';

export function Counter() {
  const t = useT();
  const { items, shop } = useShop();
  const cart = useCart();
  const [category, setCategory] = useState<string | null | 'all'>('all');
  const [query, setQuery] = useState('');
  const { current, loading } = useDays(shop.id);
  const [notice, setNotice] = useState('');

  const active = useMemo(() => items.filter((i) => i.active), [items]);
  const groups = useMemo(() => groupByCategory(active), [active]);
  const categories = groups.map((g) => g.category);
  const shown = active.filter((i) => (category === 'all' || i.category === category) && matchesSearch(i, query));
  const ordered = groupByCategory(shown).flatMap((g) => g.items);

  const qtyById = new Map<string, number>();
  for (const l of cart.lines) qtyById.set(l.itemId, (qtyById.get(l.itemId) ?? 0) + l.quantity);
  const totals = cartTotals(cart.lines, cart.discountSen);

  const footer =
    cart.lines.length > 0 ? (
      <div className="flex items-center gap-2 border-t border-border bg-surface px-4 py-3">
        <button type="button" onClick={clearCart} className="btn-ghost min-h-11 px-3 text-sm">
          {t.counter.clear}
        </button>
        <p className="num min-w-0 flex-1 truncate text-right font-bold">
          {fill(t.counter.summary, {
            n: totals.itemCount,
            total: formatRM(totals.totalSen),
          })}
        </p>
        <Link to="/kaunter/bayar" className="btn-primary px-6">
          {t.counter.pay}
        </Link>
      </div>
    ) : undefined;

  if (!current) {
    // No open day: nothing is sold until one is opened (T-07). The cart, if any, waits.
    return (
      <Layout title={t.counter.title} nav>
        {!loading && (
          <>
            <p className="mb-3 text-sm font-semibold text-muted">{t.days.needed}</p>
            <OpenDayCard onOpened={setNotice} />
          </>
        )}
      </Layout>
    );
  }

  return (
    <Layout title={t.counter.title} nav footer={footer}>
      <Notice text={notice} />
      <LongOpenNote day={current} />
      {active.length === 0 ? (
        <div className="card text-center">
          <p className="text-muted">{t.counter.empty}</p>
          <div className="mt-3 flex justify-center gap-2">
            <Link to="/terima" className="btn-secondary min-h-11 text-sm">
              {t.home.receivePrices}
            </Link>
            <Link to="/katalog" className="btn-ghost min-h-11 text-sm">
              {t.home.openCatalogue}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <input type="search" className="field" placeholder={t.counter.search} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t.counter.search} />
          {categories.length > 1 && (
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
              <button type="button" className={`chip ${category === 'all' ? 'chip-on' : ''}`} onClick={() => setCategory('all')}>
                {t.counter.all}
              </button>
              {categories.map((c) => (
                <button key={c ?? '—'} type="button" className={`chip ${category === c ? 'chip-on' : ''}`} onClick={() => setCategory(c)}>
                  {c ?? t.catalogue.noCategory}
                </button>
              ))}
            </div>
          )}
          {ordered.length === 0 ? (
            <p className="mt-6 text-center text-muted">{t.counter.noMatch}</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ordered.map((i) => (
                <Tile
                  key={i.id}
                  item={i}
                  all={items}
                  qty={qtyById.get(i.id) ?? 0}
                  onAdd={() => updateCart((c) => ({ ...c, lines: addItem(c.lines, i) }))}
                  onRemove={() =>
                    updateCart((c) => ({
                      ...c,
                      lines: removeOne(c.lines, i.id),
                    }))
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}

function Tile({ item, all, qty, onAdd, onRemove }: { item: Item; all: Item[]; qty: number; onAdd: () => void; onRemove: () => void }) {
  const t = useT();
  const margin = effectiveMargin(item);
  const sub = itemSubtitle(item, all, t);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onAdd}
        className={`relative flex min-h-24 w-full flex-col justify-between rounded-2xl border-[1.5px] p-3 text-left active:scale-[0.98] ${qty > 0 ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}
      >
        {qty > 0 && (
          <span
            className="num absolute -right-1.5 -top-2 flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-primary px-1.5 text-[13px] font-extrabold text-white"
            aria-label={`× ${qty}`}
          >
            {qty}
          </span>
        )}
        <span className={qty > 0 ? 'pr-9' : undefined}>
          <span className="block font-bold leading-tight">{item.name}</span>
          {sub && <span className="mt-0.5 block text-xs text-subtle">{sub}</span>}
        </span>
        <span className="mt-2 flex items-center justify-between gap-1">
          <span className="num font-extrabold">{formatRM(item.priceSen)}</span>
          {margin !== null ? (
            <span className={`num rounded-md px-1.5 py-0.5 text-[11px] font-bold ${marginTone(item)}`}>{formatPct(margin)}</span>
          ) : (
            <span className="text-[11px] font-semibold text-subtle">{t.counter.marginNone}</span>
          )}
        </span>
      </button>
      {qty > 0 && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={fill(t.counter.removeOne, { name: item.name })}
          className="absolute right-1 top-5 flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-primary bg-surface text-xl font-extrabold leading-none text-primary active:scale-95"
        >
          −
        </button>
      )}
    </div>
  );
}
