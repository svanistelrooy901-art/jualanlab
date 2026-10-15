import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatRM, parseRinggit } from '../../domain/money';
import { envelopes, expectedCash, summarise, type Envelopes, type SalesSummary } from '../../domain/summary';
import { getDevice } from '../../db/db';
import { fill, formatWhen, useLang, useT } from '../../i18n/lang';
import { Api, ApiError } from '../api';
import { Layout } from '../components/Layout';
import { ErrorNote } from '../components/Sheet';
import { dayName, daySpan } from '../dayLabel';
import { applyServerDay } from '../days';
import { errorText } from '../errors';
import { useShop } from '../session';
import { useDay, useDays } from '../useDay';

export function CloseDay() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const params = useParams();
  const { shop, online, syncNow } = useShop();
  const { days, current } = useDays(shop.id);
  // Without an id: the open day, else the latest one (so the page stays on the day just closed).
  const dayId = params.day ?? current?.id ?? days[0]?.id ?? null;
  const view = useDay(shop.id, dayId);
  const day = view.day;
  const [floatText, setFloatText] = useState('');
  const [countedText, setCountedText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  // The opening cash entered at Open Day is offered here.
  useEffect(() => {
    if (day) setFloatText((cur) => cur || (day.floatSen ? (day.floatSen / 100).toFixed(2) : ''));
  }, [day?.id]);

  const backTo = day && day.id !== current?.id ? `/jualan/${day.id}` : '/jualan';
  if (!day) {
    return (
      <Layout title={t.closeDay.title} back="/jualan">
        {!view.loading && <p className="card text-muted">{t.closeDay.notFound}</p>}
      </Layout>
    );
  }

  const close = view.closes[0] ?? null;
  const sum = summarise(view.sales.map((s) => s.sale));
  const changed = close !== null && view.source === 'server' && close.totals.summary.totalSen !== sum.totalSen;
  const locked = day.closedAt !== null && (close !== null || day.counted) && !editing;
  const canReopen = day.closedAt !== null && current === null && days[0]?.id === day.id;

  const floatSen = floatText.trim() === '' ? 0 : parseRinggit(floatText);
  const countedSen = parseRinggit(countedText);
  const expected = floatSen === null ? null : expectedCash(sum, floatSen);
  const blocked = !online ? t.closeDay.needsOnline : view.waitingHere > 0 ? fill(t.closeDay.waitingHere, { n: view.waitingHere }) : '';

  async function lock() {
    if (!day || floatSen === null || countedSen === null) return setError(t.closeDay.badAmount);
    setBusy(true);
    setError('');
    try {
      const device = await getDevice();
      const r = await Api.closeDay(day.id, { floatSen, countedCashSen: countedSen, note: note.trim(), deviceId: device.id });
      await applyServerDay(shop.id, r.day);
      await view.refresh();
      setEditing(false);
      if (!params.day) navigate(`/tutup/${r.day.id}`, { replace: true });
      void syncNow();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    if (!day) return;
    setBusy(true);
    setError('');
    try {
      const r = await Api.reopenDay(day.id);
      await applyServerDay(shop.id, r.day);
      void syncNow();
      navigate('/');
    } catch (e) {
      setError(e instanceof ApiError && (e.code === 'not_latest' || e.code === 'another_open') ? t.days.reopenFailed : errorText(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout title={t.closeDay.title} back={backTo}>
      <p className="font-bold">{dayName(day, t, lang)}</p>
      <p className="mb-3 text-sm text-muted">{daySpan(day, t, lang)}</p>

      {locked && (
        <>
          <p className="mb-3 rounded-xl bg-good-soft px-3 py-2 text-sm font-bold text-good">
            {fill(t.closeDay.locked, { when: formatWhen(day.closedAt!, lang) })}
            {close && close.closedAt !== day.closedAt ? ` ${fill(t.closeDay.countedAt, { when: formatWhen(close.closedAt, lang) })}` : ''}
          </p>
          {close && (
            <>
              <CashCard floatSen={close.floatSen} cashSalesSen={close.totals.summary.cashSen} expectedSen={close.expectedCashSen} countedSen={close.countedCashSen} />
              <EnvelopeCard s={close.totals.summary} e={close.totals.envelopes} />
              {close.note && <p className="card mt-3 text-sm text-muted">{close.note}</p>}
            </>
          )}
          {changed && close && (
            <>
              <p className="num mt-3 text-sm text-warn">{fill(t.sales.changedAfterClose, { now: formatRM(sum.totalSen), then: formatRM(close.totals.summary.totalSen) })}</p>
              <button
                type="button"
                className="btn-primary mt-2 w-full"
                onClick={() => {
                  setFloatText((close.floatSen / 100).toFixed(2));
                  setEditing(true);
                }}
              >
                {t.sales.closeAgain}
              </button>
            </>
          )}
          {canReopen && (
            <section className="card mt-3">
              <p className="text-sm text-muted">{t.days.reopenHint}</p>
              <button type="button" className="btn-secondary mt-2 w-full" disabled={busy || !online} onClick={() => void reopen()}>
                {t.days.reopen}
              </button>
            </section>
          )}
          <ErrorNote>{error}</ErrorNote>
        </>
      )}

      {!locked && (
        <>
          {day.closedAt !== null && !close && !day.counted && <p className="mb-3 rounded-xl bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">{t.closeDay.countLate}</p>}
          <section className="card">
            <h2 className="font-bold">{t.closeDay.step1}</h2>
            <label className="label mt-3" htmlFor="float">
              {t.closeDay.float}
            </label>
            <input id="float" className="field num" inputMode="decimal" placeholder="0.00" value={floatText} onChange={(e) => setFloatText(e.target.value)} />
            <p className="mt-1 text-xs text-subtle">{t.closeDay.floatHint}</p>
            <dl className="num mt-3 space-y-1 text-sm">
              <Row k={t.closeDay.cashSales} v={formatRM(sum.cashSen)} />
              <div className="flex justify-between font-bold">
                <dt>{t.closeDay.expected}</dt>
                <dd>{expected === null ? '—' : formatRM(expected)}</dd>
              </div>
            </dl>
            <label className="label mt-3" htmlFor="counted">
              {t.closeDay.counted}
            </label>
            <input id="counted" className="field num text-lg font-bold" inputMode="decimal" placeholder="0.00" value={countedText} onChange={(e) => setCountedText(e.target.value)} />
            {expected !== null && countedSen !== null && <Difference diff={countedSen - expected} />}
          </section>

          <EnvelopeCard s={sum} e={envelopes(sum)} />

          <section className="card mt-3">
            <label className="label" htmlFor="note">
              {t.closeDay.note}
            </label>
            <input id="note" className="field" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          </section>

          <p className="mt-3 text-xs text-subtle">{t.closeDay.otherPhones}</p>
          {day.closedAt === null && <p className="mt-1 text-xs font-semibold text-muted">{t.closeDay.afterClose}</p>}
          {blocked && <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">{blocked}</p>}
          <button type="button" className="btn-primary mt-3 w-full" disabled={busy || !!blocked || countedSen === null || floatSen === null} onClick={() => void lock()}>
            {busy ? t.closeDay.locking : t.closeDay.lock}
          </button>
          <ErrorNote>{error}</ErrorNote>
        </>
      )}

      <Link to={backTo} className="btn-ghost mt-3 w-full">
        {t.closeDay.back}
      </Link>
    </Layout>
  );
}

function Difference({ diff }: { diff: number }) {
  const t = useT();
  const tone = diff === 0 ? 'bg-good-soft text-good' : diff > 0 ? 'bg-warn-soft text-warn' : 'bg-bad-soft text-bad';
  const text = diff === 0 ? t.closeDay.exact : diff > 0 ? fill(t.closeDay.over, { amount: formatRM(diff) }) : fill(t.closeDay.short, { amount: formatRM(-diff) });
  return (
    <p className={`num mt-3 rounded-xl px-3 py-2 font-bold ${tone}`} role="status">
      {text}
    </p>
  );
}

function CashCard({ floatSen, cashSalesSen, expectedSen, countedSen }: { floatSen: number; cashSalesSen: number; expectedSen: number; countedSen: number }) {
  const t = useT();
  return (
    <section className="card">
      <h2 className="font-bold">{t.closeDay.step1}</h2>
      <dl className="num mt-2 space-y-1 text-sm">
        <Row k={t.closeDay.float.replace(' (RM)', '')} v={formatRM(floatSen)} />
        <Row k={t.closeDay.cashSales} v={formatRM(cashSalesSen)} />
        <Row k={t.closeDay.expected} v={formatRM(expectedSen)} />
        <Row k={t.closeDay.counted.replace(' (RM)', '')} v={formatRM(countedSen)} />
      </dl>
      <Difference diff={countedSen - expectedSen} />
    </section>
  );
}

function EnvelopeCard({ s, e }: { s: SalesSummary; e: Envelopes }) {
  const t = useT();
  const loss = e.profitSen < 0;
  return (
    <section className="mt-3 rounded-2xl bg-brand-ink p-4 text-white">
      <h2 className="font-bold">{t.closeDay.step2}</h2>
      <p className="num mt-1 text-sm text-brand-muted">{fill(t.closeDay.fromTakings, { amount: formatRM(s.totalSen) })}</p>
      <div className="mt-3 space-y-2">
        <Envelope title={t.closeDay.capital} hint={t.closeDay.capitalHint} amount={e.capitalSen} />
        <Envelope title={loss ? t.closeDay.loss : t.closeDay.profit} hint={t.closeDay.profitHint} amount={e.profitSen} neon={!loss} bad={loss} />
        {e.unsplitSen !== 0 && <Envelope title={t.closeDay.unsplit} hint={fill(t.closeDay.unsplitHint, { n: s.itemsWithoutMargin })} amount={e.unsplitSen} />}
      </div>
      <p className="mt-3 text-xs text-brand-muted">{t.closeDay.envelopeNote}</p>
    </section>
  );
}

function Envelope({ title, hint, amount, neon = false, bad = false }: { title: string; hint: string; amount: number; neon?: boolean; bad?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-brand-ink-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className="text-xs text-brand-muted">{hint}</p>
      </div>
      <p className={`num text-xl font-extrabold ${neon ? 'text-brand-neon' : bad ? 'text-[#ff8a8a]' : ''}`}>{formatRM(amount)}</p>
    </div>
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
