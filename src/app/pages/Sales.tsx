import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { salesCsv } from '../../domain/csv';
import { addDays, dayKey, isDayKey } from '../../domain/day';
import { formatRM } from '../../domain/money';
import { methodLabel, PAY_METHODS, type Sale } from '../../domain/sale';
import { bestSellers, summarise } from '../../domain/summary';
import { fill, formatWhen, useLang, useT } from '../../i18n/lang';
import { Layout } from '../components/Layout';
import { downloadText } from '../download';
import { lastSyncAt } from '../sales';
import { useShop } from '../session';
import { useDay, type DaySale } from '../useDay';

type Channel = 'all' | Sale['channel'];

export function Sales() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const params = useParams();
  const today = dayKey(new Date());
  const day = params.day && isDayKey(params.day) ? params.day : today;
  const { shop, online, syncNow } = useShop();
  const view = useDay(shop.id, day);
  const [channel, setChannel] = useState<Channel>('all');
  const lastSync = useLiveQuery(() => lastSyncAt(shop.id), [shop.id, view.waitingHere]);

  const shown = view.sales.filter((s) => channel === 'all' || s.sale.channel === channel);
  const sales = shown.map((s) => s.sale);
  const sum = summarise(sales);
  const top = bestSellers(sales);
  const hasBazaar = view.sales.some((s) => s.sale.channel === 'bazaar');
  const close = view.closes[0] ?? null;
  const allSum = summarise(view.sales.map((s) => s.sale));
  const changedSinceClose = close && view.source === 'server' && close.totals.summary.totalSen !== allSum.totalSen;

  const dayLabel =
    day === today
      ? t.sales.today
      : new Date(`${day}T12:00:00+08:00`).toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-MY', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kuala_Lumpur' });
  const go = (d: string) => navigate(d === today ? '/jualan' : `/jualan/${d}`);

  return (
    <Layout
      title={t.sales.title}
      nav
      right={
        sales.length > 0 ? (
          <button type="button" className="rounded-lg px-2 py-2 text-sm font-bold text-brand-neon" onClick={() => downloadText(`jualan-${day}.csv`, salesCsv(sales))}>
            {t.sales.exportCsv}
          </button>
        ) : undefined
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <button type="button" aria-label={t.sales.prevDay} className="btn-secondary min-h-11 w-11 px-0" onClick={() => go(addDays(day, -1))}>
          ‹
        </button>
        <p className="flex-1 text-center font-bold">{dayLabel}</p>
        <button type="button" aria-label={t.sales.nextDay} className="btn-secondary min-h-11 w-11 px-0" disabled={day >= today} onClick={() => go(addDays(day, 1))}>
          ›
        </button>
      </div>

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

      <section className="card mt-3">
        {close ? (
          <>
            <p className="font-bold text-good">{fill(t.sales.closedAt, { when: formatWhen(close.closedAt, lang) })}</p>
            {changedSinceClose && (
              <p className="num mt-1 text-sm text-warn">{fill(t.sales.changedAfterClose, { now: formatRM(allSum.totalSen), then: formatRM(close.totals.summary.totalSen) })}</p>
            )}
            <Link to={`/tutup/${day}`} className={`${changedSinceClose ? 'btn-primary' : 'btn-secondary'} mt-3 w-full`}>
              {changedSinceClose ? t.sales.closeAgain : t.sales.viewClose}
            </Link>
          </>
        ) : (
          <Link to={`/tutup/${day}`} className="btn-primary w-full">
            {t.sales.closeDay}
          </Link>
        )}
      </section>

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
