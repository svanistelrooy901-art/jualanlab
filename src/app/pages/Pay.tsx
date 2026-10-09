import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cartTotals, cashSuggestions, changeDue, lineTotal, MAX_NOTE, setNote, setQuantity } from '../../domain/cart';
import { formatRM, formatRMShort, parseRinggit } from '../../domain/money';
import type { PayMethod } from '../../domain/sale';
import { getMeta } from '../../db/db';
import { fill, useT } from '../../i18n/lang';
import { clearCart, updateCart, useCart } from '../cart';
import { Layout } from '../components/Layout';
import { ErrorNote, Sheet } from '../components/Sheet';
import { recordSale } from '../sales';
import { useShop } from '../session';

export function Pay() {
  const t = useT();
  const navigate = useNavigate();
  const { shop, saleRecorded } = useShop();
  const cart = useCart();
  const [method, setMethod] = useState<PayMethod>('cash');
  const [cashText, setCashText] = useState('');
  const [discountOpen, setDiscountOpen] = useState(cart.discountSen > 0);
  const [discountText, setDiscountText] = useState(cart.discountSen > 0 ? (cart.discountSen / 100).toFixed(2) : '');
  const [noteOpen, setNoteOpen] = useState<number | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void getMeta<string>(`qrImage:${shop.id}`).then((v) => setQrImage(v ?? null));
  }, [shop.id]);

  const totals = cartTotals(cart.lines, cart.discountSen);
  const cashSen = parseRinggit(cashText);
  const change = cashSen === null ? null : changeDue(totals.totalSen, cashSen);
  const canConfirm = cart.lines.length > 0 && !busy && (method !== 'cash' || change !== null);

  function onDiscount(text: string) {
    setDiscountText(text);
    const v = parseRinggit(text);
    updateCart((c) => ({ ...c, discountSen: v === null ? 0 : Math.min(v, cartTotals(c.lines).subtotalSen) }));
  }

  async function confirm() {
    if (!canConfirm) return;
    setBusy(true);
    setError('');
    try {
      const sale = await recordSale({
        shopId: shop.id,
        lines: cart.lines,
        discountSen: cart.discountSen,
        method,
        cashReceivedSen: method === 'cash' ? cashSen : null,
      });
      clearCart();
      saleRecorded();
      navigate(`/resit/${sale.id}`, { replace: true });
    } catch {
      setError(t.errors.generic);
      setBusy(false);
    }
  }

  if (cart.lines.length === 0) {
    return (
      <Layout title={t.pay.title} back="/kaunter">
        <div className="card text-center">
          <p className="text-muted">{t.pay.empty}</p>
          <Link to="/kaunter" className="btn-primary mt-3">
            {t.pay.backToCounter}
          </Link>
        </div>
      </Layout>
    );
  }

  const methods: { id: PayMethod; label: string }[] = [
    { id: 'cash', label: t.pay.cash },
    { id: 'qr', label: t.pay.qr },
    { id: 'ewallet', label: t.pay.ewallet },
  ];

  return (
    <Layout
      title={t.pay.title}
      back="/kaunter"
      footer={
        <div className="border-t border-border bg-surface px-4 py-3">
          <button type="button" className="btn-primary w-full text-base" disabled={!canConfirm} onClick={() => void confirm()}>
            {busy ? t.app.saving : `${t.pay.confirm} · ${formatRM(totals.totalSen)}`}
          </button>
        </div>
      }
    >
      <ul className="card divide-y divide-border p-0">
        {cart.lines.map((l, i) => (
          <li key={`${l.itemId}-${i}`} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">{l.name}</p>
                {noteOpen === i ? (
                  <input
                    className="field mt-2 min-h-10 text-sm"
                    autoFocus
                    maxLength={MAX_NOTE}
                    placeholder={t.pay.notePlaceholder}
                    aria-label={t.pay.note}
                    value={l.note}
                    onChange={(e) => updateCart((c) => ({ ...c, lines: setNote(c.lines, i, e.target.value) }))}
                    onBlur={() => setNoteOpen(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setNoteOpen(null)}
                  />
                ) : (
                  <button type="button" className="mt-0.5 text-left text-sm font-semibold text-primary" onClick={() => setNoteOpen(i)}>
                    {l.note ? `${t.pay.note}: ${l.note}` : `+ ${t.pay.addNote}`}
                  </button>
                )}
              </div>
              <p className="num pt-0.5 font-bold">{formatRM(lineTotal(l))}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <QtyButton label="−" aria={t.pay.remove} onClick={() => updateCart((c) => ({ ...c, lines: setQuantity(c.lines, i, l.quantity - 1) }))} />
              <span className="num w-10 text-center text-lg font-extrabold">{l.quantity}</span>
              <QtyButton label="+" aria="+" onClick={() => updateCart((c) => ({ ...c, lines: setQuantity(c.lines, i, l.quantity + 1) }))} />
              <span className="num ml-auto text-sm text-subtle">{formatRM(l.unitPriceSen)}</span>
            </div>
          </li>
        ))}
      </ul>

      <section className="card mt-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-muted">{t.pay.discount}</span>
          {!discountOpen && (
            <button type="button" className="btn-ghost min-h-10 px-3 text-sm" onClick={() => setDiscountOpen(true)}>
              + {t.pay.addDiscount}
            </button>
          )}
        </div>
        {discountOpen && (
          <input className="field num mt-2" inputMode="decimal" placeholder="0.00" aria-label={t.pay.discountRm} value={discountText} onChange={(e) => onDiscount(e.target.value)} />
        )}
        <dl className="num mt-3 space-y-1 text-sm">
          {totals.discountSen > 0 && (
            <>
              <Row k={t.pay.subtotal} v={formatRM(totals.subtotalSen)} />
              <Row k={t.pay.discount} v={formatRM(-totals.discountSen)} />
            </>
          )}
          <div className="flex items-baseline justify-between pt-1">
            <dt className="text-base font-bold">{t.pay.total}</dt>
            <dd className="text-2xl font-extrabold">{formatRM(totals.totalSen)}</dd>
          </div>
          {totals.linesWithoutMargin < cart.lines.length && <p className="text-right text-xs text-good">{fill(t.pay.estProfit, { amount: formatRM(totals.estProfitSen) })}</p>}
        </dl>
      </section>

      <section className="card mt-3">
        <p className="label">{t.pay.method}</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.pay.method}>
          {methods.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={method === m.id}
              onClick={() => setMethod(m.id)}
              className={`min-h-12 rounded-xl border-[1.5px] text-sm font-bold ${method === m.id ? 'border-primary bg-primary text-white' : 'border-border-strong bg-surface text-muted'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {method === 'cash' ? (
          <div className="mt-4">
            <label className="label" htmlFor="cash">
              {t.pay.cashReceived}
            </label>
            <input id="cash" className="field num text-lg font-bold" inputMode="decimal" placeholder="0.00" value={cashText} onChange={(e) => setCashText(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              {cashSuggestions(totals.totalSen).map((v, j) => (
                <button key={v} type="button" className={`chip num ${cashSen === v ? 'chip-on' : ''}`} onClick={() => setCashText((v / 100).toFixed(2))}>
                  {j === 0 ? t.pay.exact : formatRMShort(v)}
                </button>
              ))}
            </div>
            {cashSen !== null && (
              <div className={`mt-3 rounded-xl px-4 py-3 ${change === null ? 'bg-bad-soft text-bad' : 'bg-good-soft text-good'}`} role="status">
                {change === null ? (
                  <p className="num font-bold">{fill(t.pay.notEnough, { short: formatRM(totals.totalSen - cashSen) })}</p>
                ) : (
                  <>
                    <p className="text-sm font-semibold">{t.pay.change}</p>
                    <p className="num text-3xl font-extrabold">{formatRM(change)}</p>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-muted">{t.pay.confirmHint}</p>
            {method === 'qr' && (
              <button type="button" className="btn-secondary mt-3 w-full" onClick={() => setQrOpen(true)}>
                {t.pay.showQr}
              </button>
            )}
          </div>
        )}
      </section>
      <ErrorNote>{error}</ErrorNote>

      <Sheet open={qrOpen} title={t.pay.qr} onClose={() => setQrOpen(false)}>
        {qrImage ? (
          <div className="text-center">
            <img src={qrImage} alt={t.pay.qr} className="mx-auto max-h-[60dvh] w-auto rounded-xl" />
            <p className="num mt-3 text-3xl font-extrabold">{formatRM(totals.totalSen)}</p>
          </div>
        ) : (
          <p className="text-muted">{t.pay.noQr}</p>
        )}
      </Sheet>
    </Layout>
  );
}

function QtyButton({ label, aria, onClick }: { label: string; aria: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={aria} onClick={onClick} className="flex size-11 items-center justify-center rounded-xl border-[1.5px] border-border-strong bg-surface text-xl font-bold text-ink active:bg-canvas">
      {label}
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-muted">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
