import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatRM } from '../../domain/money';
import { openedDate } from '../../domain/bizday';
import { dayKey } from '../../domain/day';
import { promoStatus } from '../../domain/promo';
import { summarise } from '../../domain/summary';
import { fill, formatWhen, useLang, useT } from '../../i18n/lang';
import { Layout } from '../components/Layout';
import { LongOpenNote, Notice, OpenDayCard } from '../components/OpenDay';
import { dayName, daySpan } from '../dayLabel';
import { useShop } from '../session';
import { useDay, useDays } from '../useDay';

export function Home() {
  const t = useT();
  const lang = useLang();
  const { shop, me, items, promos } = useShop();
  const { days, current, loading } = useDays(shop.id);
  const view = useDay(shop.id, current?.id ?? null);
  const [notice, setNotice] = useState('');
  const s = summarise(view.sales.map((r) => r.sale));
  const last = current ? null : (days[0] ?? null);
  const promoDay = current ? openedDate(current) : dayKey(new Date());
  const running = promos.filter((p) => promoStatus(p, promoDay) === 'running');
  const changedNote = me.lastImport ? fill(t.home.pricesFrom, { when: formatWhen(me.lastImport.receivedAt, lang), n: me.lastImport.menus }) : null;

  return (
    <Layout title={shop.name} nav brand>
      <Notice text={notice} />
      {current ? (
        <>
          <p className="mb-2 text-sm font-semibold text-muted">
            {t.days.current} · {daySpan(current, t, lang)}
          </p>
          <LongOpenNote day={current} />
          <section className="rounded-2xl bg-brand-ink p-5 text-white">
            <p className="text-sm font-semibold text-brand-muted">{t.home.profitToday}</p>
            <p className="num mt-1 text-4xl font-extrabold text-brand-neon">{formatRM(s.estProfitSen)}</p>
            <p className="num mt-2 text-sm text-white/85">{fill(t.home.salesLine, { total: formatRM(s.totalSen), items: s.itemCount, count: s.count })}</p>
            {s.itemsWithoutMargin > 0 && <p className="mt-2 text-xs text-brand-muted">{fill(t.home.noMargin, { n: s.itemsWithoutMargin })}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-brand-ink-2 px-3 py-2">
                <p className="text-xs text-brand-muted">{t.home.cash}</p>
                <p className="num font-bold">{formatRM(s.cashSen)}</p>
              </div>
              <div className="rounded-xl bg-brand-ink-2 px-3 py-2">
                <p className="text-xs text-brand-muted">{t.home.qrEwallet}</p>
                <p className="num font-bold">{formatRM(s.otherSen)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-brand-muted">{view.source === 'server' ? t.sales.allPhones : t.sales.phoneOnly}</p>
          </section>

          <div className="mt-4 grid grid-cols-[2fr_1fr] gap-2">
            <Link to="/kaunter" className="btn-primary text-base">
              {t.home.startSelling}
            </Link>
            <Link to="/bazar" className="btn bg-brand-ink text-brand-neon">
              {t.bazaar.open}
            </Link>
          </div>
          <Link to={`/tutup/${current.id}`} className="btn-secondary mt-2 w-full">
            {t.days.closeNow}
          </Link>
        </>
      ) : loading ? null : (
        <>
          <OpenDayCard onOpened={setNotice} />
          <Link to="/bazar" className="btn mt-2 w-full bg-brand-ink text-brand-neon">
            {t.bazaar.open}
          </Link>
          {last && (
            <Link to={`/jualan/${last.id}`} className="card mt-3 block text-sm text-muted">
              {fill(t.home.lastDay, { name: dayName(last, t, lang), span: daySpan(last, t, lang) })} ›
            </Link>
          )}
        </>
      )}

      {running.length > 0 && (
        <Link to="/diskaun" className="mt-4 flex items-center gap-3 rounded-2xl border-[1.5px] border-promo/30 bg-promo-soft px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-wide text-promo">{t.promos.homeRunning}</span>
            <span className="block truncate font-bold text-ink">{running.map((p) => p.name).join(', ')}</span>
          </span>
          <span aria-hidden className="text-promo">
            ›
          </span>
        </Link>
      )}

      <section className="card mt-4">
        {changedNote ? <p className="text-sm text-muted">{changedNote}</p> : <p className="text-sm text-muted">{t.home.noPrices}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/terima" className="btn-secondary min-h-11 text-sm">
            {t.home.receivePrices}
          </Link>
          <Link to="/katalog" className="btn-ghost min-h-11 text-sm">
            {items.length === 0 ? t.home.noItems + ' ' : ''}
            {t.home.openCatalogue}
          </Link>
        </div>
      </section>
    </Layout>
  );
}
