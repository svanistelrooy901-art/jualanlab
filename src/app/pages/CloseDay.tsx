import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { dayKey, isDayKey } from '../../domain/day';
import { formatRM, parseRinggit } from '../../domain/money';
import { envelopes, expectedCash, summarise, type Envelopes, type SalesSummary } from '../../domain/summary';
import { getDevice, getMeta } from '../../db/db';
import { fill, formatWhen, useLang, useT } from '../../i18n/lang';
import { Api } from '../api';
import { Layout } from '../components/Layout';
import { ErrorNote } from '../components/Sheet';
import { errorText } from '../errors';
import { useShop } from '../session';
import { useDay } from '../useDay';

export function CloseDay() {
  const t = useT();
  const lang = useLang();
  const params = useParams();
  const day = params.day && isDayKey(params.day) ? params.day : dayKey(new Date());
  const { shop, online } = useShop();
  const view = useDay(shop.id, day);
  const [floatText, setFloatText] = useState('');
  const [countedText, setCountedText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  // A float set when starting Bazaar Mode that day is offered here.
  useEffect(() => {
    void getMeta<number>(`float:${shop.id}:${day}`).then((v) => {
      if (typeof v === 'number') setFloatText((cur) => cur || (v / 100).toFixed(2));
    });
  }, [shop.id, day]);

  const close = view.closes[0] ?? null;
  const sum = summarise(view.sales.map((s) => s.sale));
  const changed = close !== null && view.source === 'server' && close.totals.summary.totalSen !== sum.totalSen;
  const showForm = !close || editing;

  const floatSen = floatText.trim() === '' ? 0 : parseRinggit(floatText);
  const countedSen = parseRinggit(countedText);
  const expected = floatSen === null ? null : expectedCash(sum, floatSen);
  const blocked = !online ? t.closeDay.needsOnline : view.waitingHere > 0 ? fill(t.closeDay.waitingHere, { n: view.waitingHere }) : '';

  async function lock() {
    if (floatSen === null || countedSen === null) return setError(t.closeDay.badAmount);
    setBusy(true);
    setError('');
    try {
      const device = await getDevice();
      await Api.closeDay(day, { floatSen, countedCashSen: countedSen, note: note.trim(), deviceId: device.id });
      await view.refresh();
      setEditing(false);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout title={t.closeDay.title} back={day === dayKey(new Date()) ? '/jualan' : `/jualan/${day}`}>
      <p className="mb-3 text-sm font-semibold text-muted">
        {new Date(`${day}T12:00:00+08:00`).toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-MY', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' })}
      </p>

      {close && !editing && (
        <>
          <p className="mb-3 rounded-xl bg-good-soft px-3 py-2 text-sm font-bold text-good">{fill(t.closeDay.locked, { when: formatWhen(close.closedAt, lang) })}</p>
          <CashCard floatSen={close.floatSen} cashSalesSen={close.totals.summary.cashSen} expectedSen={close.expectedCashSen} countedSen={close.countedCashSen} />
          <EnvelopeCard s={close.totals.summary} e={close.totals.envelopes} />
          {close.note && <p className="card mt-3 text-sm text-muted">{close.note}</p>}
          {changed && (
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
        </>
      )}

      {showForm && (
        <>
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
          {blocked && <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">{blocked}</p>}
          <button type="button" className="btn-primary mt-3 w-full" disabled={busy || !!blocked || countedSen === null || floatSen === null} onClick={() => void lock()}>
            {busy ? t.closeDay.locking : t.closeDay.lock}
          </button>
          <ErrorNote>{error}</ErrorNote>
        </>
      )}

      <Link to={day === dayKey(new Date()) ? '/jualan' : `/jualan/${day}`} className="btn-ghost mt-3 w-full">
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
