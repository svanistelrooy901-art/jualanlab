import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupByCategory } from '../../domain/items';
import { formatRM, parseRinggit } from '../../domain/money';
import { fill, useLang, useT } from '../../i18n/lang';
import { loadBazaar, MAX_BAZAAR_BUTTONS, startBazaar, type BazaarSettings } from '../bazaar';
import { whenShort } from '../dayLabel';
import { openDay } from '../days';
import { useDays } from '../useDay';
import { Layout } from '../components/Layout';
import { ErrorNote } from '../components/Sheet';
import { useShop } from '../session';

export function BazaarSetup() {
  const t = useT();
  const navigate = useNavigate();
  const lang = useLang();
  const { shop, items, syncNow } = useShop();
  const { current } = useDays(shop.id);
  const [s, setS] = useState<BazaarSettings | null>(null);
  const [floatText, setFloatText] = useState('');
  const [error, setError] = useState('');

  const active = useMemo(() => groupByCategory(items.filter((i) => i.active)).flatMap((g) => g.items), [items]);

  useEffect(() => {
    void loadBazaar(shop.id).then((b) => {
      const ids = b.itemIds.filter((id) => items.some((i) => i.id === id && i.active));
      setS({ ...b, itemIds: ids.length ? ids : active.slice(0, MAX_BAZAAR_BUTTONS).map((i) => i.id) });
      setFloatText(b.floatSen ? (b.floatSen / 100).toFixed(2) : '');
    });
    // Only on open: later catalogue changes do not reset the seller's picks.
  }, [shop.id]);

  // Opened straight from a link, the catalogue can arrive after the settings: offer the first items then.
  useEffect(() => {
    setS((cur) => (cur && cur.itemIds.length === 0 && active.length > 0 ? { ...cur, itemIds: active.slice(0, MAX_BAZAAR_BUTTONS).map((i) => i.id) } : cur));
  }, [active.length > 0]);

  if (!s) return <Layout title={t.bazaar.title} back="/">{null}</Layout>;
  const running = current !== null && s.runningDayId === current.id;

  function toggle(id: string) {
    setS((cur) => {
      if (!cur) return cur;
      if (cur.itemIds.includes(id)) return { ...cur, itemIds: cur.itemIds.filter((x) => x !== id) };
      if (cur.itemIds.length >= MAX_BAZAAR_BUTTONS) return cur;
      return { ...cur, itemIds: [...cur.itemIds, id] };
    });
  }

  async function start() {
    const floatSen = floatText.trim() === '' ? 0 : parseRinggit(floatText);
    if (floatSen === null) return setError(t.closeDay.badAmount);
    if (!s || s.itemIds.length === 0) return setError(t.bazaar.pickOne);
    // Bazaar sales go into the open business day; with none open, starting the bazaar opens it (T-07).
    let dayId = current?.id;
    if (!dayId) {
      dayId = (await openDay(shop.id, floatSen)).day.id;
      void syncNow();
    }
    await startBazaar(shop.id, current ? s : { ...s, floatSen }, dayId);
    navigate('/bazar/jual');
  }

  return (
    <Layout
      title={t.bazaar.title}
      back="/"
      footer={
        <div className="border-t border-border bg-surface px-4 py-3">
          <button type="button" className="btn-primary w-full text-base" disabled={active.length === 0} onClick={() => void start()}>
            {running ? t.bazaar.resume : current ? t.bazaar.start : t.bazaar.startAndOpen}
          </button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-muted">{t.bazaar.subtitle}</p>

      {current ? (
        <p className="card text-sm font-semibold text-muted">{fill(t.bazaar.dayOpen, { when: whenShort(current.openedAt, lang), amount: formatRM(current.floatSen) })}</p>
      ) : (
        <section className="card">
          <label className="label" htmlFor="bfloat">
            {t.bazaar.float}
          </label>
          <input id="bfloat" className="field num text-lg font-bold" inputMode="decimal" placeholder="0.00" value={floatText} onChange={(e) => setFloatText(e.target.value)} />
          <p className="mt-1 text-xs text-subtle">{t.days.openHint}</p>
        </section>
      )}

      <section className="card mt-3">
        <div className="flex items-baseline justify-between">
          <p className="label">{t.bazaar.buttons}</p>
          <p className="num text-sm font-bold text-primary">{fill(t.bazaar.picked, { n: s.itemIds.length, max: MAX_BAZAAR_BUTTONS })}</p>
        </div>
        <p className="mb-2 text-xs text-subtle">{fill(t.bazaar.pickHint, { max: MAX_BAZAAR_BUTTONS })}</p>
        {active.length === 0 ? (
          <p className="text-muted">{t.bazaar.noItems}</p>
        ) : (
          <ul className="divide-y divide-border">
            {active.map((i) => {
              const on = s.itemIds.includes(i.id);
              const full = !on && s.itemIds.length >= MAX_BAZAAR_BUTTONS;
              return (
                <li key={i.id}>
                  <label className={`flex min-h-12 items-center gap-3 ${full ? 'opacity-50' : ''}`}>
                    <input type="checkbox" className="size-5 accent-[var(--color-primary)]" checked={on} disabled={full} onChange={() => toggle(i.id)} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{i.name}</span>
                    <span className="num text-sm text-muted">{formatRM(i.priceSen)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card mt-3 space-y-1">
        <Toggle label={t.bazaar.keepAwake} on={s.keepAwake} set={(v) => setS({ ...s, keepAwake: v })} />
        <Toggle label={t.bazaar.sound} on={s.sound} set={(v) => setS({ ...s, sound: v })} />
      </section>
      <p className="mt-3 text-sm text-muted">{t.bazaar.offlineNote}</p>
      <ErrorNote>{error}</ErrorNote>
    </Layout>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3">
      <span className="font-semibold">{label}</span>
      <input type="checkbox" role="switch" className="size-5 accent-[var(--color-primary)]" checked={on} onChange={(e) => set(e.target.checked)} />
    </label>
  );
}

