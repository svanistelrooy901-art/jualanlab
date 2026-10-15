import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addItem, cartTotals, cashSuggestions, setQuantity, type CartLine } from '../../domain/cart';
import type { Item } from '../../domain/items';
import { formatRM, formatRMShort } from '../../domain/money';
import { methodLabel, type PayMethod, type Sale } from '../../domain/sale';
import { summarise } from '../../domain/summary';
import { getMeta } from '../../db/db';
import { fill, useLang, useT } from '../../i18n/lang';
import { endBazaar, keepScreenOn, loadBazaar, tapSound, type BazaarSettings } from '../bazaar';
import { Sheet } from '../components/Sheet';
import { NoOpenDay } from '../days';
import { recordSale } from '../sales';
import { useShop } from '../session';
import { useDay, useDays } from '../useDay';

/** The fast bazaar screen: big buttons, one tap per item, one tap to take the money. */
export function BazaarSell() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const { shop, items, online, pending, saleRecorded } = useShop();
  const { current, loading } = useDays(shop.id);
  const [settings, setSettings] = useState<BazaarSettings | null>(null);
  const view = useDay(shop.id, settings?.runningDayId ?? null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [done, setDone] = useState<Sale | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    if (loading) return;
    void loadBazaar(shop.id).then((s) => {
      // The bazaar sells in the day it was started in; once that day is closed, back to setup (which opens a new one).
      if (!current || s.runningDayId !== current.id) navigate('/bazar', { replace: true });
      else setSettings(s);
    });
    void getMeta<string>(`qrImage:${shop.id}`).then((v) => setQrImage(v ?? null));
  }, [shop.id, navigate, loading, current?.id]);

  useEffect(() => {
    if (!settings?.keepAwake) return;
    return keepScreenOn();
  }, [settings?.keepAwake]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 20_000);
    return () => window.clearInterval(id);
  }, []);

  const buttons = useMemo(() => (settings ? settings.itemIds.map((id) => items.find((i) => i.id === id)).filter((i): i is Item => !!i && i.active) : []), [settings, items]);
  const daySales = view.sales.map((s) => s.sale);
  const bazaarSum = summarise(daySales.filter((s) => s.channel === 'bazaar'));
  const allSum = summarise(daySales);
  const drawer = (view.day?.floatSen ?? 0) + allSum.cashSen;
  const sold = new Map<string, number>();
  for (const s of daySales) if (s.status === 'done' && s.channel === 'bazaar') for (const l of s.lines) sold.set(l.itemId, (sold.get(l.itemId) ?? 0) + l.quantity);
  const inCart = new Map<string, number>();
  for (const l of lines) inCart.set(l.itemId, (inCart.get(l.itemId) ?? 0) + l.quantity);
  const totals = cartTotals(lines);
  const cashButtons = cashSuggestions(totals.totalSen, 3);

  function tap(item: Item) {
    if (settings?.sound) tapSound();
    setDone(null);
    setLines((cur) => addItem(done ? [] : cur, item));
  }

  async function pay(method: PayMethod, cashReceivedSen: number | null) {
    if (busy || lines.length === 0) return;
    setBusy(true);
    try {
      const sale = await recordSale({ shopId: shop.id, lines, discountSen: 0, method, cashReceivedSen, channel: 'bazaar' });
      saleRecorded();
      setDone(sale);
      setLines([]);
      setQrOpen(false);
      if (settings?.sound) tapSound();
    } catch (e) {
      if (!(e instanceof NoOpenDay)) throw e;
      window.alert(t.days.closedMeanwhileBazaar);
      navigate('/bazar', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function end() {
    if (!window.confirm(t.bazaar.endConfirm)) return;
    await endBazaar(shop.id);
    navigate('/jualan');
  }

  const time = clock.toLocaleTimeString(lang === 'ms' ? 'ms-MY' : 'en-MY', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' });

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-brand-ink text-white" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="px-4 pt-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-brand-neon px-2 py-0.5 text-xs font-extrabold tracking-wider text-brand-ink">{t.bazaar.badge}</span>
          <span className="num text-sm font-semibold text-brand-muted">{time}</span>
          {(!online || pending > 0) && (
            <span className="text-xs font-semibold text-brand-neon">
              {!online ? `${t.app.offline}` : ''}
              {!online && pending > 0 ? ' · ' : ''}
              {pending > 0 ? fill(t.app.pendingSales, { n: pending }) : ''}
            </span>
          )}
          <button type="button" onClick={() => void end()} className="ml-auto rounded-lg border border-brand-line px-3 py-1.5 text-sm font-bold text-brand-muted">
            {t.bazaar.end}
          </button>
        </div>
        <div className="num mt-2 flex justify-between text-sm">
          <span>{fill(t.bazaar.today, { amount: formatRM(bazaarSum.totalSen), n: bazaarSum.itemCount })}</span>
          <span className="font-bold text-brand-neon">{fill(t.bazaar.drawer, { amount: formatRM(drawer) })}</span>
        </div>
      </header>

      <main className="grid flex-1 auto-rows-fr grid-cols-2 gap-2.5 p-3">
        {buttons.map((i) => {
          const q = inCart.get(i.id) ?? 0;
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => tap(i)}
              className={`relative flex min-h-24 flex-col justify-between rounded-2xl p-3 text-left text-ink active:scale-[0.97] ${q > 0 ? 'bg-primary-soft ring-4 ring-brand-neon' : 'bg-surface'}`}
            >
              {q > 0 && (
                <span className="num absolute left-2 top-2 flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2 text-lg font-extrabold text-white">{q}</span>
              )}
              <span className={`text-lg font-extrabold leading-tight ${q > 0 ? 'pl-10' : ''}`}>{i.name}</span>
              <span className="flex items-end justify-between">
                <span className="num text-2xl font-extrabold">{formatRMShort(i.priceSen)}</span>
                <span className="num text-xs font-semibold text-subtle">{fill(t.bazaar.sold, { n: sold.get(i.id) ?? 0 })}</span>
              </span>
            </button>
          );
        })}
      </main>

      <footer className="rounded-t-3xl bg-surface px-4 pb-4 pt-3 text-ink">
        {done ? (
          <div className="text-center" role="status">
            <p className="text-sm font-semibold text-muted">{fill(t.bazaar.paidWith, { method: methodLabel(done.method, lang), amount: formatRM(done.totalSen) })}</p>
            {done.changeSen ? (
              <>
                <p className="text-sm font-bold text-good">{t.bazaar.change}</p>
                <p className="num text-5xl font-extrabold text-good">{formatRM(done.changeSen)}</p>
              </>
            ) : (
              <p className="py-3 text-2xl font-extrabold text-good">{t.bazaar.noChange}</p>
            )}
            <button type="button" className="btn-primary mt-3 w-full text-base" onClick={() => setDone(null)}>
              {t.bazaar.next}
            </button>
            <Link to={`/resit/${done.id}`} className="mt-1 inline-block py-2 text-sm font-semibold text-primary">
              {t.bazaar.viewReceipt}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex min-h-10 items-center gap-2">
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
                {lines.map((l, idx) => (
                  <button key={`${l.itemId}-${idx}`} type="button" className="chip shrink-0" onClick={() => setLines((cur) => setQuantity(cur, idx, l.quantity - 1))}>
                    {l.name} ×{l.quantity}
                  </button>
                ))}
              </div>
              {lines.length > 0 && (
                <button type="button" className="shrink-0 px-1 text-sm font-bold text-bad" onClick={() => setLines([])}>
                  {t.bazaar.clear}
                </button>
              )}
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-bold">{t.bazaar.total}</span>
              <span className="num text-3xl font-extrabold">{formatRM(totals.totalSen)}</span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {cashButtons.map((v, j) => (
                <button key={v} type="button" disabled={busy} onClick={() => void pay('cash', v)} className="num min-h-14 rounded-xl bg-good px-1 text-base font-extrabold text-white disabled:opacity-50">
                  {j === 0 ? t.bazaar.exact : formatRMShort(v)}
                </button>
              ))}
              {Array.from({ length: Math.max(0, 3 - cashButtons.length) }, (_, k) => (
                <span key={`pad-${k}`} />
              ))}
              <button type="button" disabled={busy || lines.length === 0} onClick={() => setQrOpen(true)} className="min-h-14 rounded-xl bg-primary text-base font-extrabold text-white disabled:opacity-50">
                {t.bazaar.qr}
              </button>
            </div>
          </>
        )}
      </footer>

      <Sheet open={qrOpen} title={t.bazaar.qrTitle} onClose={() => setQrOpen(false)}>
        <div className="text-center">
          {qrImage ? <img src={qrImage} alt={t.pay.qr} className="mx-auto max-h-[45dvh] w-auto rounded-xl" /> : <p className="text-sm text-muted">{t.pay.noQr}</p>}
          <p className="num mt-3 text-4xl font-extrabold">{formatRM(totals.totalSen)}</p>
          <p className="mt-1 text-xs text-subtle">{t.pay.confirmHint}</p>
          <button type="button" className="btn-primary mt-3 w-full" disabled={busy} onClick={() => void pay('qr', null)}>
            {t.bazaar.qrConfirm}
          </button>
          <button type="button" className="btn-secondary mt-2 w-full" disabled={busy} onClick={() => void pay('ewallet', null)}>
            {t.bazaar.ewalletConfirm}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
