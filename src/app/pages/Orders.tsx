/**
 * Pesanan: the online store's orders (DECISIONS K-01 plan, seller side). One button per step; payment received
 * turns the order into a sale (server side). Refreshes every 20 seconds while open, and when another phone moved an
 * order first the server answers with the order as it is now.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MAX_CANCEL_REASON, type Order, type OrderStatus } from '../../domain/kedai';
import { formatRM } from '../../domain/money';
import { fill, formatWhen, useLang, useT } from '../../i18n/lang';
import { Api, ApiError } from '../api';
import { Layout } from '../components/Layout';
import { ErrorNote, Sheet } from '../components/Sheet';
import { errorText } from '../errors';
import { useShop } from '../session';

type Tab = 'open' | 'done' | 'cancelled';
const REFRESH_MS = 20_000;

export function Orders() {
  const t = useT();
  const { kedai, refreshKedai } = useShop();
  const [tab, setTab] = useState<Tab>('open');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [counts, setCounts] = useState<Record<OrderStatus, number> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [kedaiUrl, setKedaiUrl] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await Api.orders(tab);
      setOrders(r.orders);
      setCounts(r.counts);
      setError('');
    } catch (e) {
      setError(errorText(e, t));
    }
  }, [tab, t]);

  useEffect(() => {
    setOrders(null);
    void load();
    const id = window.setInterval(() => {
      void load();
      tick((n) => n + 1);
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    void Api.kedai().then((k) => {
      setKedaiUrl(k.kedaiUrl);
      setSlug(k.store?.slug ?? null);
    }).catch(() => undefined);
  }, []);

  function replace(o: Order) {
    setOrders((cur) => (cur ?? []).map((x) => (x.id === o.id ? o : x)).filter((x) => (tab === 'open' ? !['done', 'cancelled'].includes(x.status) : true)));
    void refreshKedai();
  }

  async function step(o: Order, method?: 'cash' | 'qr') {
    setBusy(o.id);
    setError('');
    try {
      replace((await Api.orderStep(o.id, o.status, method)).order);
      void load();
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'order_changed' || e.code === 'order_finished')) {
        setError(t.orders.changed);
        void load();
      } else setError(errorText(e, t));
    } finally {
      setBusy(null);
    }
  }

  const open = (counts?.awaiting_payment ?? 0) + (counts?.confirmed ?? 0) + (counts?.preparing ?? 0) + (counts?.ready ?? 0);

  return (
    <Layout title={t.orders.title} nav>
      {kedai && !kedai.set ? (
        <div className="card text-center">
          <p className="text-muted">{t.orders.noStore}</p>
          <Link to="/kedai" className="btn-primary mt-3">
            {t.kedai.start}
          </Link>
        </div>
      ) : (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
            {(['open', 'done', 'cancelled'] as Tab[]).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={`chip ${tab === k ? 'chip-on' : ''}`} onClick={() => setTab(k)}>
                {k === 'open' ? `${t.orders.active}${open ? ` · ${open}` : ''}` : k === 'done' ? t.orders.done : t.orders.cancelled}
              </button>
            ))}
          </div>
          <ErrorNote>{error}</ErrorNote>
          {orders === null ? null : orders.length === 0 ? (
            <p className="card mt-3 text-center text-muted">{t.orders.empty}</p>
          ) : (
            <div className="mt-3 space-y-3">
              {orders.map((o) => (
                <OrderCard key={o.id} o={o} busy={busy === o.id} link={kedaiUrl && slug ? `${kedaiUrl}/${slug}/p/${o.id}` : null} onStep={(m) => void step(o, m)} onCancel={() => setCancelling(o)} />
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={cancelling !== null} title={cancelling ? fill(t.orders.cancelTitle, { number: cancelling.number }) : ''} onClose={() => setCancelling(null)}>
        {cancelling && (
          <CancelForm
            key={cancelling.id}
            order={cancelling}
            onDone={(o) => {
              replace(o);
              setCancelling(null);
              void load();
            }}
          />
        )}
      </Sheet>
    </Layout>
  );
}

function waLink(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function OrderCard({ o, busy, link, onStep, onCancel }: { o: Order; busy: boolean; link: string | null; onStep: (method?: 'cash' | 'qr') => void; onCancel: () => void }) {
  const t = useT();
  const lang = useLang();
  const amount = formatRM(o.totalSen);
  const vars = { name: o.customerName, number: o.number, amount, url: link ?? '' };
  const msg =
    o.status === 'awaiting_payment' ? fill(t.orders.msgAwaiting, vars)
    : o.status === 'confirmed' ? fill(t.orders.msgConfirmed, vars)
    : o.status === 'ready' || o.status === 'preparing' ? fill(o.fulfilment === 'pickup' ? t.orders.msgReadyPickup : t.orders.msgReadyDelivery, vars)
    : fill(t.orders.msgDone, vars);
  const mins = o.status === 'awaiting_payment' && o.expiresAt ? Math.max(0, Math.round((Date.parse(o.expiresAt) - Date.now()) / 60000)) : null;
  const left = mins === null ? '' : mins >= 60 ? `${Math.floor(mins / 60)} j ${mins % 60} min` : `${mins} min`;
  const next =
    o.status === 'awaiting_payment' ? t.orders.stepPaid
    : o.status === 'confirmed' ? t.orders.stepPrepare
    : o.status === 'preparing' ? (o.fulfilment === 'pickup' ? t.orders.stepReadyPickup : t.orders.stepReadyDelivery)
    : o.status === 'ready' ? t.orders.stepDone
    : null;
  const payAtHandover = o.status === 'ready' && o.pay === 'at_pickup' && !o.saleId;
  const tone =
    o.status === 'awaiting_payment' ? 'bg-warn-soft text-warn'
    : o.status === 'cancelled' ? 'bg-bad-soft text-bad'
    : o.status === 'done' ? 'bg-canvas text-muted'
    : 'bg-good-soft text-good';
  return (
    <article className="card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-extrabold">
          {o.number} · {o.customerName}
        </h2>
        <span className="num text-[17px] font-extrabold">{amount}</span>
      </div>
      <p className="mt-0.5 text-sm text-muted">
        {o.fulfilment === 'pickup' ? t.orders.pickupAt : `${t.orders.deliverTo} ${o.address}, ${o.area}`} · {formatWhen(o.createdAt, lang)}
      </p>
      <p className="mt-2 text-sm">{o.lines.map((l) => `${l.quantity}× ${l.name}${l.note ? ` (${l.note})` : ''}`).join(' · ')}</p>
      {o.note && <p className="mt-1 text-sm text-muted">“{o.note}”</p>}
      <p className={`mt-2 inline-block rounded-lg px-2 py-1 text-xs font-bold ${tone}`}>
        {t.orders.status[o.status]}
        {o.pay === 'at_pickup' && !o.saleId && o.status !== 'cancelled' ? ` · ${t.orders.payAtPickup}` : ''}
        {mins !== null ? ` · ${fill(t.orders.expiresIn, { t: left })}` : ''}
        {o.status === 'cancelled' && o.cancelReason ? ` · ${o.cancelReason === 'expired' ? t.orders.expired : o.cancelReason}` : ''}
      </p>
      {o.status === 'awaiting_payment' && <p className="mt-2 text-xs text-subtle">{fill(t.orders.checkBank, { amount, number: o.number })}</p>}
      {next && (
        <div className={`mt-3 grid gap-2 ${payAtHandover ? 'grid-cols-2' : 'grid-cols-[2fr_1fr]'}`}>
          {payAtHandover ? (
            <>
              <button type="button" className="btn-primary min-h-12" disabled={busy} onClick={() => onStep('cash')}>
                {t.orders.stepDone} · {t.orders.paidCash}
              </button>
              <button type="button" className="btn-primary min-h-12" disabled={busy} onClick={() => onStep('qr')}>
                {t.orders.stepDone} · {t.orders.paidQr}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-primary min-h-12" disabled={busy} onClick={() => onStep()}>
                {next}
              </button>
              <a className="btn-secondary min-h-12" href={waLink(o.customerPhone, msg)} target="_blank" rel="noopener">
                {t.orders.whatsapp}
              </a>
            </>
          )}
        </div>
      )}
      {o.status !== 'done' && o.status !== 'cancelled' && (
        <div className="mt-2 flex justify-between">
          {payAtHandover && (
            <a className="btn-ghost min-h-10 px-2 text-sm" href={waLink(o.customerPhone, msg)} target="_blank" rel="noopener">
              {t.orders.whatsapp}
            </a>
          )}
          <button type="button" className="btn-ghost ml-auto min-h-10 px-2 text-sm text-bad" onClick={onCancel}>
            {t.orders.cancel}
          </button>
        </div>
      )}
    </article>
  );
}

function CancelForm({ order, onDone }: { order: Order; onDone: (o: Order) => void }) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    setError('');
    try {
      onDone((await Api.orderCancel(order.id, reason.trim())).order);
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      {order.saleId && <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{t.orders.cancelPaid}</p>}
      <div>
        <label className="label" htmlFor="creason">
          {t.orders.cancelReason}
        </label>
        <input id="creason" className="field" maxLength={MAX_CANCEL_REASON} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </div>
      <ErrorNote>{error}</ErrorNote>
      <button className="btn-danger w-full" disabled={busy || !reason.trim()}>
        {t.orders.cancelConfirm}
      </button>
    </form>
  );
}
