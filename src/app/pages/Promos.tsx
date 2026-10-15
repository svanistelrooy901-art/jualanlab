/**
 * Diskaun & Promosi (Mamu, 15 Oct): promotions the counter applies by itself, and the shop's three quick discount
 * buttons. Changes need internet (the server keeps them for every phone); the counter uses the phone's copy offline.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { openedDate } from '../../domain/bizday';
import { dayKey } from '../../domain/day';
import { marginAt, unitCost, type Item } from '../../domain/items';
import { formatPct, formatRM, parseRinggit } from '../../domain/money';
import {
  daysLeft,
  DEFAULT_PRESETS,
  MAX_PROMO_NAME,
  MAX_PROMOS,
  promoItems,
  promoStatus,
  validatePresets,
  validPct,
  type Promo,
  type PromoInput,
  type PromoKind,
  type PromoScope,
  type PromoStatus,
} from '../../domain/promo';
import { fill, useLang, useT, type Dict, type Lang } from '../../i18n/lang';
import { Api, ApiError } from '../api';
import { Layout } from '../components/Layout';
import { ErrorNote } from '../components/Sheet';
import { errorText } from '../errors';
import { matchesSearch } from '../itemLabels';
import { useShop } from '../session';
import { useDays } from '../useDay';

const TZ = 'Asia/Kuala_Lumpur';
const PCT_CHIPS = [5, 10, 15, 20, 25, 30, 50];
const PREVIEW_ROWS = 8;

/** Promotions follow the business day: the open day's date, or the calendar date when no day is open. */
function usePromoToday(shopId: string): string {
  const { current } = useDays(shopId);
  return current ? openedDate(current) : dayKey(new Date());
}

export function dateLabel(key: string, lang: Lang): string {
  return new Date(`${key}T12:00:00+08:00`).toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
}

const pctText = (pct: number | null) => `${pct ?? 0}%`;

/** "10% off · Kek, Kuih" or "Promo price · 3 items". */
export function promoSummary(p: Promo, t: Dict): string {
  if (p.kind === 'price') return `${t.promos.promoPrice} · ${fill(t.promos.nItems, { n: Object.keys(p.prices).length })}`;
  const what = p.scope === 'all' ? t.promos.allItems : p.scope === 'categories' ? p.categories.join(', ') : fill(t.promos.nItems, { n: p.itemIds.length });
  return `${fill(t.promos.pctOff, { pct: pctText(p.pct) })} · ${what}`;
}

function dateSpan(p: Pick<Promo, 'startDate' | 'endDate'>, t: Dict, lang: Lang): string {
  return p.endDate === null ? fill(t.promos.from, { date: dateLabel(p.startDate, lang) }) : fill(t.promos.range, { from: dateLabel(p.startDate, lang), to: dateLabel(p.endDate, lang) });
}

const STATUS_ORDER: PromoStatus[] = ['running', 'scheduled', 'off', 'ended'];
const STATUS_TONE: Record<PromoStatus, string> = {
  running: 'bg-promo-soft text-promo',
  scheduled: 'bg-primary-soft text-primary',
  off: 'bg-canvas text-muted',
  ended: 'bg-canvas text-subtle',
};

function toInput(p: Promo): PromoInput {
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = p;
  return rest;
}

function saveError(e: unknown, t: Dict): string {
  if (e instanceof ApiError) {
    if (e.offline) return t.promos.needsOnline;
    if (e.code === 'too_many_promos') return fill(t.promos.tooMany, { max: MAX_PROMOS });
    if (e.code === 'bad_promo') {
      const d = String(e.extra.detail ?? '');
      if (d === 'name') return t.promos.badName;
      if (d === 'pct') return t.promos.badPct;
      if (d === 'categories') return t.promos.badCategories;
      if (d === 'itemIds') return t.promos.badItems;
      if (d === 'prices' || d === 'price' || d === 'unknown_item') return t.promos.badPrices;
      if (d === 'endDate' || d === 'startDate') return t.promos.badDates;
    }
  }
  return errorText(e, t);
}

// ---------------------------------------------------------------- list

export function Promos() {
  const t = useT();
  const lang = useLang();
  const { shop, promos, presets, setPromos } = useShop();
  const today = usePromoToday(shop.id);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...promos].sort((a, b) => STATUS_ORDER.indexOf(promoStatus(a, today)) - STATUS_ORDER.indexOf(promoStatus(b, today)) || a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name)),
    [promos, today],
  );

  async function toggle(p: Promo) {
    setBusyId(p.id);
    setError('');
    try {
      const r = await Api.updatePromo(p.id, { ...toInput(p), on: !p.on });
      await setPromos(promos.map((x) => (x.id === p.id ? r.promo : x)));
    } catch (e) {
      setError(saveError(e, t));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout
      title={t.promos.title}
      back="/lagi"
      right={
        <Link to="/diskaun/baru" className="rounded-lg bg-brand-neon px-3 py-2 text-sm font-bold text-brand-ink">
          + {t.promos.add}
        </Link>
      }
    >
      <p className="text-sm text-muted">{t.promos.intro}</p>
      <ErrorNote>{error}</ErrorNote>

      {sorted.length === 0 ? (
        <div className="card mt-3 text-center">
          <p className="text-muted">{t.promos.empty}</p>
          <Link to="/diskaun/baru" className="btn-primary mt-3">
            + {t.promos.add}
          </Link>
        </div>
      ) : (
        <ul className="card mt-3 divide-y divide-border p-0">
          {sorted.map((p) => {
            const status = promoStatus(p, today);
            const left = status === 'running' ? daysLeft(p, today) : null;
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Link to={`/diskaun/${p.id}`} className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-bold">{p.name}</span>
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${STATUS_TONE[status]}`}>{t.promos[status]}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">{promoSummary(p, t)}</span>
                  <span className="num block text-xs text-subtle">
                    {dateSpan(p, t, lang)}
                    {left !== null && ` · ${left === 1 ? t.promos.lastDay : fill(t.promos.daysLeft, { n: left })}`}
                  </span>
                </Link>
                <Switch on={p.on} busy={busyId === p.id} label={fill(t.promos.switchOn, { name: p.name })} onChange={() => void toggle(p)} />
              </li>
            );
          })}
        </ul>
      )}

      <PresetsCard presets={presets} />
    </Layout>
  );
}

function Switch({ on, busy, label, onChange }: { on: boolean; busy?: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onChange}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-promo' : 'bg-border-strong'}`}
    >
      <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-[left] ${on ? 'left-7' : 'left-1'}`} />
    </button>
  );
}

function PresetsCard({ presets }: { presets: number[] }) {
  const t = useT();
  const { promos, setPromos } = useShop();
  const [values, setValues] = useState(() => presets.map(String));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next = validatePresets(values.map((v) => Number(v.replace(',', '.').trim() || NaN)));
    if (!next) return setMsg({ ok: false, text: t.promos.presetsBad });
    setBusy(true);
    setMsg(null);
    try {
      const r = await Api.setPresets(next);
      await setPromos(promos, r.presets);
      setValues(r.presets.map(String));
      setMsg({ ok: true, text: t.promos.presetsSaved });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError && err.offline ? t.promos.needsOnline : errorText(err, t) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card mt-4" onSubmit={save}>
      <h2 className="font-bold">{t.promos.presetsTitle}</h2>
      <p className="mt-0.5 text-sm text-muted">{t.promos.presetsHint}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {values.map((v, i) => (
          <label key={i} className="relative block">
            <span className="sr-only">{`${t.promos.presetsTitle} ${i + 1}`}</span>
            <input
              className="field num pr-8 text-center text-lg font-extrabold"
              inputMode="decimal"
              value={v}
              placeholder={String(DEFAULT_PRESETS[i])}
              onChange={(e) => {
                setValues(values.map((x, j) => (j === i ? e.target.value : x)));
                setMsg(null);
              }}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-subtle">%</span>
          </label>
        ))}
      </div>
      <button className="btn-secondary mt-3 w-full" disabled={busy}>
        {busy ? t.app.saving : t.promos.presetsSave}
      </button>
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`mt-2 rounded-xl px-3 py-2 text-sm font-semibold ${msg.ok ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>
          {msg.text}
        </p>
      )}
    </form>
  );
}

// ---------------------------------------------------------------- editor

/** Last day of the month of a "YYYY-MM-DD" date: a new promotion runs to the end of this month unless changed. */
function endOfMonth(key: string): string {
  const [y, m] = key.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function PromoEditor() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const { id } = useParams();
  const { shop, items, promos, setPromos } = useShop();
  const today = usePromoToday(shop.id);
  const existing = id && id !== 'baru' ? (promos.find((p) => p.id === id) ?? null) : null;
  const missing = id !== 'baru' && !existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<PromoKind>(existing?.kind ?? 'pct');
  const [pct, setPct] = useState(existing?.pct != null ? String(existing.pct) : '10');
  const [scope, setScope] = useState<PromoScope>(existing?.kind === 'pct' ? existing.scope : 'all');
  const [categories, setCategories] = useState<string[]>(existing?.categories ?? []);
  const [itemIds, setItemIds] = useState<string[]>(existing?.itemIds ?? []);
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(existing?.prices ?? {}).map(([k, v]) => [k, (v / 100).toFixed(2)])));
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [endDate, setEndDate] = useState(existing ? (existing.endDate ?? '') : endOfMonth(today));
  const [noEnd, setNoEnd] = useState(existing ? existing.endDate === null : false);
  const [on, setOn] = useState(existing?.on ?? true);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const active = useMemo(() => items.filter((i) => i.active).sort((a, b) => (a.category ?? '￿').localeCompare(b.category ?? '￿', 'ms') || a.name.localeCompare(b.name, 'ms')), [items]);
  const allCategories = useMemo(() => {
    const now = [...new Set(active.map((i) => i.category).filter((c): c is string => c !== null))].sort((a, b) => a.localeCompare(b, 'ms'));
    return [...now, ...categories.filter((c) => !now.includes(c))];
  }, [active, categories]);
  const liveCategories = new Set(active.map((i) => i.category));

  /** What would be saved, or the reason it cannot be. */
  const built = useMemo((): { input: PromoInput } | { error: string } => {
    const nm = name.trim().replace(/\s+/g, ' ');
    if (!nm) return { error: t.promos.badName };
    const end = noEnd ? null : endDate || null;
    if (!startDate || (end !== null && end < startDate)) return { error: t.promos.badDates };
    const base = { name: nm, startDate, endDate: end, on };
    if (kind === 'price') {
      const out: Record<string, number> = {};
      for (const [itemId, text] of Object.entries(prices)) {
        const sen = parseRinggit(text);
        if (sen === null) return { error: t.promos.badPrices };
        out[itemId] = sen;
      }
      if (Object.keys(out).length === 0) return { error: t.promos.badPrices };
      return { input: { ...base, kind, pct: null, scope: 'items', categories: [], itemIds: [], prices: out } };
    }
    const p = Number(pct.replace(',', '.').trim() || NaN);
    if (!validPct(p)) return { error: t.promos.badPct };
    if (scope === 'categories' && categories.length === 0) return { error: t.promos.badCategories };
    if (scope === 'items' && itemIds.length === 0) return { error: t.promos.badItems };
    return {
      input: { ...base, kind, pct: p, scope, categories: scope === 'categories' ? categories : [], itemIds: scope === 'items' ? itemIds : [], prices: {} },
    };
  }, [name, kind, pct, scope, categories, itemIds, prices, startDate, endDate, noEnd, on, t]);

  // The preview works even before the name is typed: it only needs the discount and what it covers.
  const previewPromo = useMemo((): Promo | null => {
    const p = Number(pct.replace(',', '.').trim() || NaN);
    if (kind === 'pct' && !validPct(p)) return null;
    const pricesSen = Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, parseRinggit(v) ?? -1]));
    return {
      id: 'preview',
      name: name || '—',
      kind,
      pct: kind === 'pct' ? p : null,
      scope: kind === 'price' ? 'items' : scope,
      categories,
      itemIds,
      prices: pricesSen,
      startDate,
      endDate: null,
      on: true,
      createdAt: '',
      updatedAt: '',
    };
  }, [kind, pct, scope, categories, itemIds, prices, name, startDate]);
  const covered = previewPromo ? promoItems(previewPromo, active) : [];
  const losses = covered.filter((c) => c.priceSen !== null && (unitCost(c.item) ?? -Infinity) > c.priceSen).length;
  const notLower = covered.filter((c) => c.priceSen === null).length;

  async function save() {
    if ('error' in built) return setError(built.error);
    setBusy(true);
    setError('');
    try {
      if (existing) {
        const r = await Api.updatePromo(existing.id, built.input);
        await setPromos(promos.map((p) => (p.id === existing.id ? r.promo : p)));
      } else {
        const r = await Api.createPromo(built.input);
        await setPromos([...promos, r.promo]);
      }
      navigate('/diskaun', { replace: true });
    } catch (e) {
      setError(saveError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing || !window.confirm(fill(t.promos.deleteConfirm, { name: existing.name }))) return;
    setBusy(true);
    setError('');
    try {
      await Api.deletePromo(existing.id);
      await setPromos(promos.filter((p) => p.id !== existing.id));
      navigate('/diskaun', { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        await setPromos(promos.filter((p) => p.id !== existing.id));
        navigate('/diskaun', { replace: true });
      } else setError(saveError(e, t));
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <Layout title={t.promos.editTitle} back="/diskaun">
        <p className="card text-muted">{t.errors.generic}</p>
      </Layout>
    );
  }

  const shownItems = active.filter((i) => matchesSearch(i, query));
  const footer = (
    <div className="border-t border-border bg-surface px-4 py-3">
      <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => void save()}>
        {busy ? t.app.saving : t.promos.save}
      </button>
    </div>
  );

  return (
    <Layout title={existing ? t.promos.editTitle : t.promos.newTitle} back="/diskaun" footer={footer}>
      <div className="space-y-4">
        <section className="card space-y-3">
          <div>
            <label className="label" htmlFor="promo-name">
              {t.promos.name}
            </label>
            <input id="promo-name" className="field" maxLength={MAX_PROMO_NAME} placeholder={t.promos.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
            <p className="mt-1 text-xs text-subtle">{t.promos.nameHint}</p>
          </div>

          <div>
            <p className="label">{t.promos.kind}</p>
            <Segmented
              value={kind}
              onChange={(v) => {
                setKind(v);
                setShowAll(false);
              }}
              options={[
                ['pct', t.promos.kindPct],
                ['price', t.promos.kindPrice],
              ]}
            />
          </div>

          {kind === 'pct' && (
            <div>
              <label className="label" htmlFor="promo-pct">
                {t.promos.pct}
              </label>
              <div className="relative">
                <input id="promo-pct" className="field num pr-9 text-lg font-extrabold" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-subtle">%</span>
              </div>
              <div className="-mx-1 mt-2 flex flex-wrap gap-1.5">
                {PCT_CHIPS.map((c) => (
                  <button key={c} type="button" className={`chip min-h-9 ${Number(pct) === c ? 'chip-on' : ''}`} onClick={() => setPct(String(c))}>
                    {c}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="card space-y-3">
          {kind === 'pct' ? (
            <>
              <div>
                <p className="label">{t.promos.appliesTo}</p>
                <Segmented
                  value={scope}
                  onChange={setScope}
                  options={[
                    ['all', t.promos.scopeAll],
                    ['categories', t.promos.scopeCategories],
                    ['items', t.promos.scopeItems],
                  ]}
                />
              </div>
              {scope === 'categories' &&
                (allCategories.length === 0 ? (
                  <p className="text-sm text-muted">{t.promos.noCategories}</p>
                ) : (
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {allCategories.map((c) => {
                        const picked = categories.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            aria-pressed={picked}
                            className={`chip ${picked ? 'chip-on' : ''}`}
                            onClick={() => setCategories(picked ? categories.filter((x) => x !== c) : [...categories, c])}
                          >
                            {liveCategories.has(c) ? c : fill(t.promos.categoryGone, { name: c })}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-subtle">{t.promos.categoriesHint}</p>
                  </div>
                ))}
              {scope === 'items' && (
                <ItemPicker
                  items={shownItems}
                  query={query}
                  onQuery={setQuery}
                  isPicked={(i) => itemIds.includes(i.id)}
                  onToggle={(i) => setItemIds(itemIds.includes(i.id) ? itemIds.filter((x) => x !== i.id) : [...itemIds, i.id])}
                />
              )}
            </>
          ) : (
            <div>
              <p className="label">{t.promos.priceHint}</p>
              <ItemPicker
                items={shownItems}
                query={query}
                onQuery={setQuery}
                isPicked={(i) => i.id in prices}
                onToggle={(i) => {
                  const next = { ...prices };
                  if (i.id in next) delete next[i.id];
                  else next[i.id] = (i.priceSen / 100).toFixed(2);
                  setPrices(next);
                }}
                below={(i) => (i.id in prices ? <PriceRow item={i} text={prices[i.id]!} onText={(v) => setPrices({ ...prices, [i.id]: v })} /> : null)}
              />
            </div>
          )}
        </section>

        <section className="card space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="promo-start">
                {t.promos.start}
              </label>
              <input id="promo-start" type="date" className="field num" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="promo-end">
                {t.promos.end}
              </label>
              <input id="promo-end" type="date" className="field num disabled:opacity-40" disabled={noEnd} min={startDate} value={noEnd ? '' : endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 accent-[var(--color-primary)]" checked={noEnd} onChange={(e) => setNoEnd(e.target.checked)} />
            <span className="font-semibold">{t.promos.noEnd}</span>
          </label>
          <p className="text-xs text-subtle">{t.promos.datesHint}</p>
          <div className="flex items-center gap-3 border-t border-border pt-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t.promos.on}</span>
              <span className="block text-xs text-subtle">{t.promos.onHint}</span>
            </span>
            <Switch on={on} label={t.promos.on} onChange={() => setOn(!on)} />
          </div>
        </section>

        {kind === 'pct' && previewPromo && (
          <section className="card">
            <h2 className="font-bold">{fill(t.promos.preview, { n: covered.length })}</h2>
            {covered.length === 0 ? (
              <p className="mt-1 text-sm text-muted">{t.promos.previewNone}</p>
            ) : (
              <>
                {losses > 0 && <p className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">{fill(t.promos.lossWarning, { n: losses })}</p>}
                {notLower > 0 && <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{fill(t.promos.notLowerWarning, { n: notLower })}</p>}
                <ul className="mt-2 divide-y divide-border">
                  {(showAll ? covered : covered.slice(0, PREVIEW_ROWS)).map((c) => (
                    <PreviewRow key={c.item.id} item={c.item} priceSen={c.priceSen} />
                  ))}
                </ul>
                {!showAll && covered.length > PREVIEW_ROWS && (
                  <button type="button" className="btn-ghost mt-1 w-full text-sm" onClick={() => setShowAll(true)}>
                    {fill(t.promos.showAll, { n: covered.length })}
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {kind === 'price' && (losses > 0 || notLower > 0) && (
          <div>
            {losses > 0 && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">{fill(t.promos.lossWarning, { n: losses })}</p>}
            {notLower > 0 && <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{fill(t.promos.notLowerWarning, { n: notLower })}</p>}
          </div>
        )}

        <ErrorNote>{error}</ErrorNote>

        {existing && (
          <button type="button" className="btn-danger w-full" disabled={busy} onClick={() => void remove()}>
            {t.promos.delete}
          </button>
        )}
        {existing && <p className="text-center text-xs text-subtle">{dateSpan(existing, t, lang)}</p>}
      </div>
    </Layout>
  );
}

function Segmented<V extends string>({ value, onChange, options }: { value: V; onChange: (v: V) => void; options: [V, string][] }) {
  return (
    <div className={`grid gap-1 rounded-xl bg-canvas p-1 ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`} role="radiogroup">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`min-h-10 rounded-lg px-2 text-sm font-bold ${value === v ? 'bg-surface text-ink shadow-sm ring-1 ring-border' : 'text-muted'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ItemPicker({
  items,
  query,
  onQuery,
  isPicked,
  onToggle,
  below,
}: {
  items: Item[];
  query: string;
  onQuery: (q: string) => void;
  isPicked: (i: Item) => boolean;
  onToggle: (i: Item) => void;
  below?: (i: Item) => React.ReactNode;
}) {
  const t = useT();
  return (
    <div>
      <input type="search" className="field" placeholder={t.promos.search} aria-label={t.promos.search} value={query} onChange={(e) => onQuery(e.target.value)} />
      <ul className="mt-2 max-h-[55dvh] divide-y divide-border overflow-y-auto rounded-xl border-[1.5px] border-border">
        {items.map((i) => {
          const picked = isPicked(i);
          return (
            <li key={i.id} className={picked ? 'bg-promo-soft/40' : undefined}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
                <input type="checkbox" className="size-5 shrink-0 accent-[var(--color-promo)]" checked={picked} onChange={() => onToggle(i)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{i.name}</span>
                  {i.category && <span className="block truncate text-xs text-subtle">{i.category}</span>}
                </span>
                <span className="num text-sm text-muted">{formatRM(i.priceSen)}</span>
              </label>
              {below?.(i)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PriceRow({ item, text, onText }: { item: Item; text: string; onText: (v: string) => void }) {
  const t = useT();
  const sen = parseRinggit(text);
  const cost = unitCost(item);
  const margin = sen !== null ? marginAt(sen, cost) : null;
  const lower = sen !== null && sen < item.priceSen;
  return (
    <div className="flex items-center gap-2 px-3 pb-3 pl-11">
      <input
        className="field num min-h-10 w-28 text-right font-bold"
        inputMode="decimal"
        aria-label={fill(t.promos.priceFor, { name: item.name })}
        value={text}
        onChange={(e) => onText(e.target.value)}
      />
      <span className="num min-w-0 flex-1 text-xs leading-tight">
        <span className="block text-subtle">{fill(t.promos.normal, { price: formatRM(item.priceSen) })}</span>
        {sen === null ? null : !lower ? (
          <span className="block font-semibold text-warn">{t.promos.notLower}</span>
        ) : cost !== null && sen < cost ? (
          <span className="block font-bold text-bad">{fill(t.promos.loss, { amount: formatRM(Math.round(cost - sen)) })}</span>
        ) : margin !== null ? (
          <span className="block font-semibold text-muted">{fill(t.promos.marginAt, { margin: formatPct(margin) })}</span>
        ) : null}
      </span>
    </div>
  );
}

function PreviewRow({ item, priceSen }: { item: Item; priceSen: number | null }) {
  const t = useT();
  const cost = unitCost(item);
  const margin = priceSen !== null ? marginAt(priceSen, cost) : null;
  return (
    <li className="flex items-center gap-2 py-2">
      <span className="min-w-0 flex-1 truncate font-semibold">{item.name}</span>
      <span className="num text-right text-sm leading-tight">
        {priceSen === null ? (
          <span className="block text-warn">{t.promos.notLower}</span>
        ) : (
          <>
            <span className="text-xs text-subtle line-through">{formatRM(item.priceSen)}</span> <span className="font-bold">{formatRM(priceSen)}</span>
            {cost !== null && priceSen < cost ? (
              <span className="block text-xs font-bold text-bad">{fill(t.promos.loss, { amount: formatRM(Math.round(cost - priceSen)) })}</span>
            ) : margin !== null ? (
              <span className="block text-xs text-muted">{fill(t.promos.marginAt, { margin: formatPct(margin) })}</span>
            ) : null}
          </>
        )}
      </span>
    </li>
  );
}
