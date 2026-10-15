import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { openedDate } from '../../domain/bizday';
import { salesCsv } from '../../domain/csv';
import { formatRM } from '../../domain/money';
import { methodLabel, PAY_METHODS, type Sale } from '../../domain/sale';
import { bestSellers, promoTotals, summarise } from '../../domain/summary';
import { fill, formatWhen, useLang, useT } from '../../i18n/lang';
import { Layout } from '../components/Layout';
import { LongOpenNote, Notice, OpenDayCard } from '../components/OpenDay';
import { dayName, daySpan } from '../dayLabel';
import { downloadText } from '../download';
import { lastSyncAt } from '../sales';
import { useShop } from '../session';
import { useDay, useDays, type DaySale } from '../useDay';

type Channel = 'all' | Sale['channel'];

export function Sales() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const params = useParams();
  const { shop, online, syncNow } = useShop();
  const { days, current, loading } = useDays(shop.id);
  // A business day by id; without one, the open day, else the latest (T-07).
  const dayId = params.day ?? current?.id ?? days[0]?.id ?? null;
  const view = useDay(shop.id, dayId);
  const [channel, setChannel] = useState<Channel>('all');
  const [notice, setNotice] = useState('');
  const lastSync = useLiveQuery(() => lastSyncAt(shop.id), [shop.id, view.waitingHere]);

  const shown = view.sales.filter((s) => channel === 'all' || s.sale.channel === channel);
  const sales = shown.map((s) => s.sale);
  const sum = summarise(sales);
  const top = bestSellers(sales);
  const byPromo = promoTotals(sales);
  const hasBazaar = view.sales.some((s) => s.sale.channel === 'bazaar');
  const close = view.closes[0] ?? null;
  const allSum = summarise(view.sales.map((s) => s.sale));
  const changedSinceClose = close && view.source === 'server' && close.totals.summary.totalSen !== allSum.totalSen;

  const day = view.day;
  // Days are listed newest first: "previous" is the next one down the list.
  const at = days.findIndex((d) => d.id === dayId);
  const older = at >= 0 ? (days[at + 1] ?? null) : null;
  const newer = at > 0 ? days[at - 1]! : null;
  const go = (id: string) => navigate(id === current?.id ? '/jualan' : `/jualan/${id}`);

  if (!loading && !dayId) {
    return (
      <Layout title={t.sales.title} nav>
        <p className="mb-3 text-sm font-semibold text-muted">{t.sales.noDays}</p>
        <Notice text={notice} />
        <OpenDayCard onOpened={setNotice} />
      </Layout>
    );
  }

  return (
    <Layout
      title={t.sales.title}
      nav
      right={
        sales.length > 0 && day ? (
          <button type="button" className="rounded-lg px-2 py-2 text-sm font-bold text-brand-neon" onClick={() => downloadText(`jualan-${openedDate(day)}.csv`, salesCsv(sales))}>
            {t.sales.exportCsv}
          </button>
        ) : undefined
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <button type="button" aria-label={t.sales.prevDay} className="btn-secondary min-h-11 w-11 px-0" disabled={!older} onClick={() => older && go(older.id)}>
          ‹
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="font-bold">{day ? dayName(day, t, lang) : '…'}</p>
          {day && <p className="text-xs text-muted">{daySpan(day, t, lang)}</p>}
        </div>
        <button type="button" aria-label={t.sales.nextDay} className="btn-secondary min-h-11 w-11 px-0" disabled={!newer} onClick={() => newer && go(newer.id)}>
          ›
        </button>
      </div>
      {day && <LongOpenNote day={day} />}

      {hasBazaar && (
        <div className="mb-3 flex gap-2">
          {(['all', 'counter', 'bazaar'] as const).map((c) => (
            <button key={c} type="button" className={`chip ${channel === c ? 'chip-on' : ''}`} onClick={() => setChannel(c)}>
              {t.sales[c]}
            </button>
          ))}
        </div>
      )}

      <section className="grid grid-cols-3 gap-2 rounded-2xl bg-brand-ink p-4 text-white">
        <Stat label={t.sales.sales} value={formatRM(sum.totalSen)} />
        <Stat label={t.sales.profit} value={formatRM(sum.estProfitSen)} neon />
        <Stat label={t.sales.transactions} value={String(sum.count)} />
        <p className="col-span-3 text-xs text-brand-muted">
          {view.source === 'server' ? t.sales.allPhones : t.sales.phoneOnly}
          {sum.itemsWithoutMargin > 0 && ` ${fill(t.sales.noMargin, { n: sum.itemsWithoutMargin })}.`}
        </p>
      </section>

      {view.waitingHere > 0 && online && (
        <button type="button" className="btn-secondary mt-3 w-full" onClick={() => void syncNow()}>
          {t.sales.sendNow}
        </button>
      )}

      {sum.count > 0 && (
        <section className="card mt-3">
          <h2 className="label">{t.sales.byMethod}</h2>
          <dl className="num space-y-1">
            {PAY_METHODS.map((m) => (
              <div key={m} className="flex justify-between">
                <dt className="text-muted">{methodLabel(m, lang)}</dt>
                <dd className="font-bold">{formatRM(sum.byMethod[m])}</dd>
              </div>
            ))}
          </dl>
          {sum.itemDiscountSen + sum.orderDiscountSen > 0 && (
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm">
              <dt className="text-muted">{t.discount.given}</dt>
              <dd className="font-bold">{formatRM(sum.itemDiscountSen + sum.orderDiscountSen)}</dd>
            </div>
          )}
          {sum.voidCount > 0 && <p className="num mt-2 text-xs text-subtle">{fill(t.sales.voidTotal, { n: sum.voidCount, amount: formatRM(sum.voidSen) })}</p>}
        </section>
      )}

      {top.length > 0 && (
        <section className="card mt-3">
          <h2 className="label">{t.sales.bestSellers}</h2>
          <ol className="space-y-1">
            {top.map((b, i) => (
              <li key={b.itemId} className="flex items-baseline gap-2">
                <span className="w-5 text-sm font-bold text-subtle">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{b.name}</span>
                <span className="num text-sm text-muted">{fill(t.sales.soldLine, { n: b.quantity, amount: formatRM(b.revenueSen) })}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {byPromo.length > 0 && (
        <section className="card mt-3">
          <h2 className="label">{t.promos.salesTitle}</h2>
          <ul className="space-y-1">
            {byPromo.map((p) => (
              <li key={p.promoId} className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold text-promo">{p.name}</span>
                <span className="num text-sm text-muted">{fill(t.promos.salesLine, { n: p.quantity, amount: formatRM(p.discountSen) })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {day && (
        <section className="card mt-3">
          {day.closedAt === null ? (
            <Link to={`/tutup/${day.id}`} className="btn-primary w-full">
              {t.sales.closeDay}
            </Link>
          ) : close || day.counted ? (
            <>
              <p className="font-bold text-good">{fill(t.sales.closedAt, { when: formatWhen(day.closedAt, lang) })}</p>
              {changedSinceClose && close && (
                <p className="num mt-1 text-sm text-warn">{fill(t.sales.changedAfterClose, { now: formatRM(allSum.totalSen), then: formatRM(close.totals.summary.totalSen) })}</p>
              )}
              <Link to={`/tutup/${day.id}`} className={`${changedSinceClose ? 'btn-primary' : 'btn-secondary'} mt-3 w-full`}>
                {changedSinceClose ? t.sales.closeAgain : t.sales.viewClose}
              </Link>
            </>
          ) : (
            <>
              <p className="font-bold text-warn">{t.days.notCounted}</p>
              <Link to={`/tutup/${day.id}`} className="btn-secondary mt-3 w-full">
                {t.days.countCash}
              </Link>
            </>
          )}
        </section>
      )}

      <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-subtle">{t.sales.list}</h2>
      {shown.length === 0 ? (
        <p className="card text-muted">{t.sales.empty}</p>
      ) : (
        <ul className="card divide-y divide-border p-0">
          {shown.map((s) => (
            <SaleRow key={s.sale.id} row={s} />
          ))}
        </ul>
      )}
      <p className="mt-3 text-center text-xs text-subtle">{t.sales.voidNote}</p>
      {lastSync && <p className="mt-1 text-center text-xs text-subtle">{fill(t.sales.lastSync, { when: formatWhen(lastSync, lang) })}</p>}
    </Layout>
  );
}

function Stat({ label, value, neon = false }: { label: string; value: string; neon?: boolean }) {
  return (
    <div>
      <p className="text-xs text-brand-muted">{label}</p>
      <p className={`num text-lg font-extrabold ${neon ? 'text-brand-neon' : ''}`}>{value}</p>
    </div>
  );
}

function SaleRow({ row }: { row: DaySale }) {
  const t = useT();
  const lang = useLang();
  const s = row.sale;
  const void_ = s.status === 'void';
  const time = new Date(s.createdAt).toLocaleTimeString(lang === 'ms' ? 'ms-MY' : 'en-MY', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' });
  return (
    <li>
      <Link to={`/resit/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
        <div className="min-w-0 flex-1">
          <p className="num font-bold">
            {s.number} · {methodLabel(s.method, lang)}
            {s.channel === 'bazaar' && <span className="ml-1 rounded bg-brand-ink px-1 text-[10px] font-bold text-brand-neon">{t.sales.bazaar}</span>}
          </p>
          <p className={`truncate text-sm ${void_ ? 'font-semibold text-bad' : 'text-muted'}`}>
            {void_ ? fill(t.sales.voided, { reason: s.voidReason ?? '' }) : `${time} · ${s.lines.map((l) => `${l.name} × ${l.quantity}`).join(', ')}`}
          </p>
        </div>
        <div className="text-right">
          <p className={`num font-bold ${void_ ? 'text-subtle line-through' : ''}`}>{formatRM(s.totalSen)}</p>
          <SyncBadge row={row} />
        </div>
      </Link>
    </li>
  );
}

function SyncBadge({ row }: { row: DaySale }) {
  const t = useT();
  if (!row.local) return null; // made on another phone: it is on the server
  if (row.local.sync === 'rejected') return <p className="text-xs font-semibold text-bad">{t.sales.problem}</p>;
  if (row.local.sync === 'pending') return <p className="text-xs font-semibold text-warn">{t.sales.pending}</p>;
  if (row.local.voidPending) return <p className="text-xs font-semibold text-warn">{t.sales.voidWaiting}</p>;
  return <p className="text-xs font-semibold text-good">{t.sales.sent}</p>;
}
