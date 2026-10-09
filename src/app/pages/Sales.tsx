import { Link } from 'react-router-dom';
import { formatRM } from '../../domain/money';
import { methodLabel } from '../../domain/sale';
import { summarise } from '../../domain/summary';
import { fill, useLang, useT } from '../../i18n/lang';
import { Layout } from '../components/Layout';
import { useShop } from '../session';
import { useTodaySales } from '../useTodaySales';

export function Sales() {
  const t = useT();
  const lang = useLang();
  const { shop, online, syncNow } = useShop();
  const rows = useTodaySales(shop.id);
  const s = summarise((rows ?? []).map((r) => r.sale));
  const waiting = (rows ?? []).some((r) => r.sync === 'pending');

  return (
    <Layout title={t.sales.title} nav>
      {rows && rows.length > 0 && <p className="num mb-3 font-bold">{fill(t.sales.total, { amount: formatRM(s.totalSen), count: s.count })}</p>}
      {waiting && online && (
        <button type="button" className="btn-secondary mb-3 w-full" onClick={() => void syncNow()}>
          {t.sales.sendNow}
        </button>
      )}
      {rows && rows.length === 0 && <p className="card text-muted">{t.sales.empty}</p>}
      {rows && rows.length > 0 && (
        <ul className="card divide-y divide-border p-0">
          {rows.map((r) => (
            <li key={r.id}>
              <Link to={`/resit/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                <div className="min-w-0 flex-1">
                  <p className="num font-bold">
                    {r.sale.number}
                    <span className="ml-2 text-sm font-normal text-subtle">
                      {new Date(r.createdAt).toLocaleTimeString(lang === 'ms' ? 'ms-MY' : 'en-MY', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' })}
                    </span>
                  </p>
                  <p className="truncate text-sm text-muted">{r.sale.lines.map((l) => `${l.name} × ${l.quantity}`).join(', ')}</p>
                </div>
                <div className="text-right">
                  <p className="num font-bold">{formatRM(r.sale.totalSen)}</p>
                  <p className="text-xs text-subtle">{methodLabel(r.sale.method, lang)}</p>
                  <SyncBadge state={r.sync} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-center text-xs text-subtle">{t.sales.later}</p>
    </Layout>
  );
}

function SyncBadge({ state }: { state: 'pending' | 'sent' | 'rejected' }) {
  const t = useT();
  if (state === 'sent') return <p className="text-xs font-semibold text-good">{t.sales.sent}</p>;
  if (state === 'rejected') return <p className="text-xs font-semibold text-bad">{t.sales.problem}</p>;
  return <p className="text-xs font-semibold text-warn">{t.sales.pending}</p>;
}
