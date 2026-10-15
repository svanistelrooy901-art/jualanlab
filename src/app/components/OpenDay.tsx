import { useState } from 'react';
import { Link } from 'react-router-dom';
import { openTooLong } from '../../domain/bizday';
import { parseRinggit } from '../../domain/money';
import { fill, useLang, useT } from '../../i18n/lang';
import type { LocalDay } from '../../db/db';
import { whenShort } from '../dayLabel';
import { openDay } from '../days';
import { useShop } from '../session';
import { ErrorNote } from './Sheet';

/** Open Day (T-07): one tap, opening cash optional. Works without internet. */
export function OpenDayCard({ onOpened }: { onOpened?: (notice: string) => void }) {
  const t = useT();
  const lang = useLang();
  const { shop, online, syncNow } = useShop();
  const [floatText, setFloatText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function open(e: React.FormEvent) {
    e.preventDefault();
    const floatSen = floatText.trim() === '' ? 0 : parseRinggit(floatText);
    if (floatSen === null) return setError(t.closeDay.badAmount);
    setBusy(true);
    setError('');
    try {
      const r = await openDay(shop.id, floatSen);
      if (r.alreadyOpen) onOpened?.(fill(t.days.alreadyOpen, { when: whenShort(r.day.openedAt, lang) }));
      else if (!online) onOpened?.(t.days.openedOffline);
      void syncNow();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void open(e)} className="rounded-2xl border-2 border-primary bg-surface p-4">
      <h2 className="text-lg font-extrabold">{t.days.openTitle}</h2>
      <p className="mt-1 text-sm text-muted">{t.days.openHint}</p>
      <label className="label mt-3" htmlFor="open-float">
        {t.days.float}
      </label>
      <input id="open-float" className="field num text-lg font-bold" inputMode="decimal" placeholder="0.00" value={floatText} onChange={(e) => setFloatText(e.target.value)} />
      <button className="btn-primary mt-3 w-full text-base" disabled={busy}>
        {busy ? t.days.opening : t.days.open}
      </button>
      <ErrorNote>{error}</ErrorNote>
    </form>
  );
}

/** Shown when a day has been open a long time: nothing closes by itself, so ask. */
export function LongOpenNote({ day }: { day: LocalDay }) {
  const t = useT();
  const lang = useLang();
  if (!openTooLong(day, new Date())) return null;
  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-warn/30 bg-warn-soft px-3 py-2 text-warn" role="status">
      <p className="flex-1 text-sm font-semibold">{fill(t.days.longOpen, { when: whenShort(day.openedAt, lang) })}</p>
      <Link to={`/tutup/${day.id}`} className="shrink-0 rounded-lg bg-warn px-3 py-2 text-sm font-bold text-white">
        {t.days.closeNow}
      </Link>
    </div>
  );
}

/** A one-off message after opening (opened offline, or another phone had opened the day already). */
export function Notice({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="mb-3 rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold text-primary" role="status">
      {text}
    </p>
  );
}
