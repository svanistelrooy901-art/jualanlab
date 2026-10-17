/**
 * Laporan (DECISIONS L-01, L-02; mockup 16 Oct): a period's profit and sales, compared with the period before.
 * Profit is the main figure. Full POS plan; Free shops see a locked preview. PDF = the phone's print dialog.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatRM } from '../../domain/money';
import { addDays, change, myDate, type Report } from '../../domain/report';
import { fill, useT } from '../../i18n/lang';
import { Api, ApiError } from '../api';
import { Layout } from '../components/Layout';
import { ErrorNote } from '../components/Sheet';
import { downloadText } from '../download';
import { errorText } from '../errors';

type Period = 'today' | '7d' | 'month' | 'lastMonth' | 'custom';

function rangeFor(p: Period, today: string, custom: { from: string; to: string }): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const first = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01`;
  if (p === 'today') return { from: today, to: today };
  if (p === '7d') return { from: addDays(today, -6), to: today };
  if (p === 'month') return { from: first(y, m), to: today };
  if (p === 'lastMonth') {
    const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
    return { from: first(py, pm), to: addDays(first(y, m), -1) };
  }
  return custom;
}

const rm0 = (sen: number) => formatRM(Math.round(sen / 100) * 100).replace(/\.00$/, '');

function Delta({ now, prev, invert = false, light = false }: { now: number; prev: number; invert?: boolean; light?: boolean }) {
  const t = useT();
  const c = change(now, prev);
  if (c === null) return <span className={`text-xs font-semibold ${light ? 'text-brand-muted' : 'text-subtle'}`}>{t.reports.noPrev}</span>;
  const up = c >= 0;
  const good = invert ? !up : up;
  const color = light ? (good ? 'text-[#6EE7A8]' : 'text-[#FDBA74]') : good ? 'text-good' : 'text-warn';
  return (
    <span className={`text-xs font-bold ${color}`}>
      {up ? '▲' : '▼'} {Math.abs(c).toLocaleString('ms-MY', { maximumFractionDigits: 1 })}%
    </span>
  );
}

export function Reports() {
  const t = useT();
  const today = myDate(new Date().toISOString());
  const [period, setPeriod] = useState<Period>('month');
  const [custom, setCustom] = useState({ from: addDays(today, -29), to: today });
  const range = rangeFor(period, today, custom);
  const [data, setData] = useState<{ locked: boolean; report?: Report } | null>(null);
  const [error, setError] = useState('');
  const [allItems, setAllItems] = useState(false);

  useEffect(() => {
    setData(null);
    setError('');
    Api.reports(range.from, range.to)
      .then((r) => setData(r.locked ? { locked: true } : { locked: false, report: r.report }))
      .catch((e) => setError(e instanceof ApiError && e.offline ? t.reports.offline : errorText(e, t)));
  }, [range.from, range.to, t]);

  async function csv() {
    try {
      const res = await fetch(`/api/reports/csv?from=${range.from}&to=${range.to}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      downloadText(`jualan-${range.from}-${range.to}.csv`, await res.text());
    } catch {
      setError(t.reports.csvFailed);
    }
  }

  const periods: [Period, string][] = [['today', t.reports.today], ['7d', t.reports.d7], ['month', t.reports.month], ['lastMonth', t.reports.lastMonth], ['custom', t.reports.custom]];

  return (
    <Layout title={t.reports.title} back="/jualan">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 print:hidden" role="tablist">
        {periods.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={period === k} className={`chip flex-none ${period === k ? 'chip-on' : ''}`} onClick={() => setPeriod(k)}>
            {label}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="mt-2 grid grid-cols-2 gap-2 print:hidden">
          <div>
            <label className="label" htmlFor="rf">{t.reports.from}</label>
            <input id="rf" type="date" className="field" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="rt">{t.reports.to}</label>
            <input id="rt" type="date" className="field" value={custom.to} min={custom.from} max={today} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} />
          </div>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
      {data?.locked && <LockedPreview />}
      {data?.report && <ReportView r={data.report} allItems={allItems} onAllItems={() => setAllItems(true)} onCsv={() => void csv()} />}
      {!data && !error && <p className="mt-6 text-center text-muted">{t.app.loading}</p>}
    </Layout>
  );
}

const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const BUCKETS = [6, 8, 10, 12, 14, 16, 18, 20, 22]; // two-hour columns from 6am

function ReportView({ r, allItems, onAllItems, onCsv }: { r: Report; allItems: boolean; onAllItems: () => void; onCsv: () => void }) {
  const t = useT();
  const prevRange = `${fmtDate(addDays(r.from, -r.days))} – ${fmtDate(addDays(r.from, -1))}`;
  const items = allItems ? r.items : r.items.slice(0, 6);
  const maxProfit = Math.max(1, ...r.items.map((i) => i.profitSen ?? 0));
  const thin = r.items.find((i) => i.thin);
  const chanTotal = r.channels.counter + r.channels.bazaar + r.channels.online;
  const payTotal = r.methods.cash + r.methods.qr + r.methods.ewallet;
  const discount = r.itemDiscountSen + r.orderDiscountSen;

  // Daily chart: weeks instead of days for long periods.
  const bars = useMemo(() => {
    if (r.daily.length <= 45) return r.daily.map((d) => ({ label: d.date, ...d }));
    const out: { label: string; date: string; salesSen: number; profitSen: number }[] = [];
    r.daily.forEach((d, i) => {
      if (i % 7 === 0) out.push({ label: d.date, date: d.date, salesSen: 0, profitSen: 0 });
      out[out.length - 1]!.salesSen += d.salesSen;
      out[out.length - 1]!.profitSen += d.profitSen;
    });
    return out;
  }, [r.daily]);
  const maxBar = Math.max(1, ...bars.map((b) => b.salesSen));

  // Busy hours: Monday to Sunday × two-hour buckets.
  const heat = WEEK.map((day) => BUCKETS.map((h) => (r.heat[day]![h] ?? 0) + (r.heat[day]![h + 1] ?? 0) + (h === 6 ? (r.heat[day]!.slice(0, 6).reduce((a, b) => a + b, 0)) : 0)));
  const maxHeat = Math.max(0, ...heat.flat());
  let peak: { day: number; h: number } | null = null;
  heat.forEach((row, ri) => row.forEach((v, ci) => { if (v > 0 && v === maxHeat && !peak) peak = { day: WEEK[ri]!, h: BUCKETS[ci]! }; }));
  const shade = (v: number) => {
    if (v <= 0 || maxHeat === 0) return '#F1F4F8';
    const k = v / maxHeat;
    return k > 0.8 ? '#0B63CE' : k > 0.55 ? '#5B97E3' : k > 0.3 ? '#93BBEE' : k > 0.1 ? '#BFD7F6' : '#E3EDFB';
  };

  if (r.now.count === 0) {
    return <p className="card mt-3 text-center text-muted">{t.reports.empty}</p>;
  }

  return (
    <div className="mt-2 space-y-3">
      <p className="text-xs text-subtle">
        {fmtDate(r.from)}{r.days > 1 ? ` – ${fmtDate(r.to)}` : ''} · {fill(t.reports.vs, { range: prevRange })}
      </p>

      {/* Headline: profit first (L-01). */}
      <section className="rounded-3xl bg-brand-ink p-5 text-white print:border print:border-black print:bg-white print:text-black">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-brand-muted">{t.reports.profit}</div>
            <div className="num text-[34px] font-extrabold leading-tight tracking-tight text-brand-neon print:text-black">{formatRM(r.now.profitSen)}</div>
            <Delta now={r.now.profitSen} prev={r.prev.profitSen} light />
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-brand-muted">{t.reports.sales}</div>
            <div className="num text-xl font-extrabold">{formatRM(r.now.salesSen)}</div>
            <Delta now={r.now.salesSen} prev={r.prev.salesSen} light />
          </div>
        </div>
        <div className="my-4 h-px bg-brand-line" />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[11.5px] text-brand-muted">{t.reports.margin}</div>
            <div className="num text-base font-extrabold">{r.now.marginPct === null ? '—' : `${r.now.marginPct}%`}</div>
          </div>
          <div>
            <div className="text-[11.5px] text-brand-muted">{t.reports.count}</div>
            <div className="num text-base font-extrabold">{r.now.count}</div>
            <Delta now={r.now.count} prev={r.prev.count} light />
          </div>
          <div>
            <div className="text-[11.5px] text-brand-muted">{t.reports.basket}</div>
            <div className="num text-base font-extrabold">{formatRM(r.now.avgBasketSen)}</div>
            <Delta now={r.now.avgBasketSen} prev={r.prev.avgBasketSen} light />
          </div>
        </div>
        <p className="mt-3 text-[11.5px] text-brand-muted">
          {t.reports.costNote}
          {r.itemsWithoutCost > 0 ? ` ${fill(t.reports.noCost, { n: r.itemsWithoutCost })}` : ''}
        </p>
      </section>

      {r.days > 1 && (
        <section className="card">
          <div className="flex items-baseline justify-between">
            <h2 className="font-extrabold">{r.daily.length > 45 ? t.reports.weekly : t.reports.daily}</h2>
            <div className="flex gap-3 text-[11.5px] font-bold text-muted">
              <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-[#BFD7F6]" />{t.reports.sales}</span>
              <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-[#0B63CE]" />{t.reports.profit}</span>
            </div>
          </div>
          <svg viewBox={`0 0 ${bars.length * 10} 100`} preserveAspectRatio="none" className="mt-3 block h-36 w-full" role="img" aria-label={t.reports.chartLabel}>
            {bars.map((b, i) => {
              const hs = (b.salesSen / maxBar) * 96;
              const hp = (Math.max(0, b.profitSen) / maxBar) * 96;
              return (
                <g key={b.label}>
                  <rect x={i * 10 + 1.5} y={100 - hs} width={7} height={hs} rx={1.2} fill="#BFD7F6" />
                  <rect x={i * 10 + 1.5} y={100 - hp} width={7} height={hp} rx={1.2} fill="#0B63CE" />
                </g>
              );
            })}
          </svg>
          <div className="mt-1 flex justify-between text-[11px] text-subtle">
            <span>{fmtDate(bars[0]!.label)}</span>
            <span>{fmtDate(bars[bars.length - 1]!.label)}</span>
          </div>
          {r.bestWeekday && (
            <p className="mt-2 text-sm">
              <b>{fill(t.reports.bestDay, { day: t.reports.days[r.bestWeekday.day]! })}</b>: {fill(t.reports.bestDayAvg, { amount: rm0(r.bestWeekday.avgSen) })}
            </p>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="font-extrabold">{t.reports.items}</h2>
        <ul className="mt-3 space-y-3">
          {items.map((i) => (
            <li key={i.itemId}>
              <div className="flex justify-between gap-2 text-sm">
                <b className="min-w-0 truncate">{i.name}</b>
                <b className="num">{i.profitSen === null ? '—' : formatRM(i.profitSen)}</b>
              </div>
              <div className="mt-1 h-2 rounded-full bg-canvas">
                <div className={`h-2 rounded-full ${i.thin ? 'bg-[#F59E0B]' : 'bg-primary'}`} style={{ width: `${i.profitSen === null ? 0 : Math.max(2, (Math.max(0, i.profitSen) / maxProfit) * 100)}%` }} />
              </div>
              <div className={`mt-0.5 text-xs ${i.thin ? 'font-bold text-warn' : 'text-subtle'}`}>
                {i.thin ? `${t.reports.thin}: ` : ''}
                {fill(t.reports.itemLine, { n: i.quantity, sales: formatRM(i.revenueSen) })}
                {i.marginPct !== null ? ` · ${t.reports.margin.toLowerCase()} ${i.marginPct}%` : ` · ${t.reports.noCostItem}`}
              </div>
            </li>
          ))}
        </ul>
        {!allItems && r.items.length > 6 && (
          <button type="button" className="btn-ghost mt-2 min-h-10 px-2 text-sm print:hidden" onClick={onAllItems}>
            {fill(t.reports.allItems, { n: r.items.length })}
          </button>
        )}
        {thin && (
          <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
            {fill(t.reports.tip, { name: thin.name, extra: formatRM(thin.quantity * 50) })}
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="font-extrabold">{t.reports.channels}</h2>
        {chanTotal > 0 && (
          <div className="mt-3 flex h-3.5 overflow-hidden rounded-full">
            <div style={{ width: `${(r.channels.counter / chanTotal) * 100}%`, background: '#0B63CE' }} />
            <div style={{ width: `${(r.channels.bazaar / chanTotal) * 100}%`, background: '#7CD3FF' }} />
            <div style={{ width: `${(r.channels.online / chanTotal) * 100}%`, background: '#F59E0B' }} />
          </div>
        )}
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
          {([['counter', '#0B63CE', t.reports.counter], ['bazaar', '#7CD3FF', t.reports.bazaar], ['online', '#F59E0B', t.reports.online]] as const).map(([k, color, label]) => (
            <div key={k}>
              <div className="flex items-center gap-1 text-xs font-bold text-muted"><span className="size-2.5 rounded-sm" style={{ background: color }} />{label}</div>
              <b className="num">{rm0(r.channels[k])}</b>
              {k === 'online' && r.channels.online > 0 && (
                <div>
                  <Delta now={r.channels.online} prev={r.prevChannels.online} />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="my-3 h-px bg-border" />
        <h3 className="text-sm font-extrabold">{t.reports.payments}</h3>
        <div className="mt-2 space-y-1.5 text-sm">
          {([['cash', t.reports.cash], ['qr', t.reports.qr], ['ewallet', t.reports.ewallet]] as const).map(([k, label]) => (
            <div key={k} className="flex justify-between">
              <span>{label}</span>
              <b className="num">{formatRM(r.methods[k])}{payTotal ? ` · ${Math.round((r.methods[k] / payTotal) * 100)}%` : ''}</b>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-subtle">{t.reports.bankHint}</p>
      </section>

      <section className="card">
        <h2 className="font-extrabold">{t.reports.busy}</h2>
        <div className="mt-3 grid items-center gap-[3px] text-[10.5px] text-subtle" style={{ gridTemplateColumns: `34px repeat(${BUCKETS.length}, minmax(0, 1fr))` }}>
          <span />
          {BUCKETS.map((h) => (
            <span key={h} className="text-center">{h}</span>
          ))}
          {WEEK.map((day, ri) => [
            <span key={`l${day}`}>{t.reports.daysShort[day]}</span>,
            ...heat[ri]!.map((v, ci) => <span key={`${day}-${ci}`} className="h-5 rounded" style={{ background: shade(v) }} title={`${t.reports.daysShort[day]} ${BUCKETS[ci]}:00 · ${formatRM(v)}`} />),
          ])}
        </div>
        {peak && (
          <p className="mt-2 text-sm">
            <b>{fill(t.reports.peak, { day: t.reports.days[(peak as { day: number }).day]!, from: hourText((peak as { h: number }).h), to: hourText((peak as { h: number }).h + 2) })}</b> {t.reports.peakTip}
          </p>
        )}
      </section>

      {(discount > 0 || r.promos.length > 0) && (
        <section className="card">
          <h2 className="font-extrabold">{t.reports.promos}</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-canvas p-3">
              <div className="text-xs text-muted">{t.reports.discountGiven}</div>
              <b className="num text-lg">{formatRM(discount)}</b>
            </div>
            {r.promos.slice(0, 3).map((p) => (
              <div key={p.promoId} className="rounded-xl bg-canvas p-3">
                <div className="truncate text-xs text-muted">{p.name}</div>
                <b className="num text-lg">{formatRM(p.revenueSen)}</b>
                <div className="text-xs text-subtle">{fill(t.reports.promoLine, { n: p.quantity, off: formatRM(p.discountSen) })}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2 pb-4 print:hidden">
        <button type="button" className="btn-primary min-h-12" onClick={() => window.print()}>
          {t.reports.pdf}
        </button>
        <button type="button" className="btn-secondary min-h-12" onClick={onCsv}>
          {t.reports.csv}
        </button>
      </div>
    </div>
  );
}

function hourText(h: number): string {
  const x = h % 24;
  if (x === 0) return '12 tgh mlm';
  if (x === 12) return '12 tgh';
  return x < 12 ? `${x} pg` : `${x - 12} ${x < 19 ? 'ptg' : 'mlm'}`;
}

const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

/** Free plan: what Laporan looks like, numbers hidden, with the way to the full plan. */
function LockedPreview() {
  const t = useT();
  return (
    <div className="relative mt-3">
      <div aria-hidden className="pointer-events-none select-none space-y-3 blur-[3px]">
        <section className="rounded-3xl bg-brand-ink p-5 text-white">
          <div className="text-xs text-brand-muted">{t.reports.profit}</div>
          <div className="text-[34px] font-extrabold text-brand-neon">RM•,•••</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm"><b>••%</b><b>•••</b><b>RM••</b></div>
        </section>
        <section className="card h-40" />
        <section className="card h-32" />
      </div>
      <div className="absolute inset-x-0 top-10 mx-auto max-w-sm rounded-3xl border border-border bg-white p-5 text-center shadow-lg">
        <p className="text-lg font-extrabold">{t.reports.lockedTitle}</p>
        <p className="mt-1 text-sm text-muted">{t.reports.lockedText}</p>
        <Link to="/pelan" className="btn-primary mt-4 w-full">
          {t.reports.lockedCta}
        </Link>
      </div>
    </div>
  );
}
