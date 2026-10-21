import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { formatRM } from '../../domain/money';
import { fill, useT } from '../../i18n/lang';
import { applyAppUpdate, useUpdateWaiting } from '../appUpdate';
import { useSession } from '../session';
import { Logo } from './Logo';

/** After this long, waiting sales get a red banner (scope doc: "firmer after 24 hours"). */
const STALE_MS = 24 * 3600_000;

interface Props {
  title: string;
  /** Show a back arrow to this path (or history back when true). */
  back?: string | true;
  /** Bottom navigation (main pages). */
  nav?: boolean;
  /** Extra content on the right of the top bar. */
  right?: ReactNode;
  /** Sticky bar above the bottom navigation (the counter's cart bar). */
  footer?: ReactNode;
  children: ReactNode;
  brand?: boolean;
}

export function Layout({ title, back, nav = false, right, footer, children, brand = false }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const { online, pending, oldestPending, newOrder, dismissNewOrder, kedai } = useSession();
  const stale = pending > 0 && oldestPending !== null && Date.now() - Date.parse(oldestPending) > STALE_MS;
  const updateWaiting = useUpdateWaiting();

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="sticky top-0 z-20 bg-brand-ink text-white print:hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex min-h-14 items-center gap-2 px-3">
          {back && (
            <button
              type="button"
              aria-label={t.app.back}
              onClick={() => (back === true ? navigate(-1) : navigate(back))}
              className="-ml-1 flex size-11 items-center justify-center rounded-full text-brand-neon hover:bg-brand-ink-2"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
          )}
          {brand && <Logo size={30} />}
          <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold">{title}</h1>
          {right}
        </div>
        {stale ? (
          <div className="border-t border-bad bg-bad px-4 py-2 text-[13px] font-bold text-white" role="alert">
            {fill(t.app.pendingStale, { n: pending })}
          </div>
        ) : (
          (!online || pending > 0) && (
            <div className="flex items-center gap-2 border-t border-brand-line bg-brand-ink-2 px-4 py-1.5 text-[13px] font-semibold text-brand-muted" role="status">
              {!online && <span className="text-brand-neon">{t.app.offline}</span>}
              {!online && pending > 0 && <span aria-hidden>·</span>}
              {pending > 0 && <span>{fill(t.app.pendingSales, { n: pending })}</span>}
            </div>
          )
        )}
        {kedai?.stockCheck && (
          <div className="flex items-center gap-3 border-t border-brand-line bg-[#FDE68A] px-4 py-2 text-[#422006]" role="status">
            <span className="flex-1 text-sm font-bold">{fill(t.stockCheck.banner, { time: kedai.stockCheck.closesAt })}</span>
            <button type="button" onClick={() => navigate('/kedai/stok')} className="rounded-lg bg-[#422006] px-3 py-2 text-sm font-bold text-white">
              {t.stockCheck.open}
            </button>
          </div>
        )}
        {newOrder && (
          <div className="flex items-center gap-2 border-t border-brand-line bg-brand-neon px-3 py-2 text-brand-ink" role="alert">
            <span aria-hidden className="text-lg">●</span>
            <button
              type="button"
              className="min-h-10 flex-1 text-left text-sm font-extrabold"
              onClick={() => {
                dismissNewOrder();
                navigate('/pesanan');
              }}
            >
              {fill(t.orders.newAlert, { number: newOrder.number, name: newOrder.customerName, amount: formatRM(newOrder.totalSen) })}
              <span className="ml-1 underline">{t.orders.newAlertOpen}</span>
            </button>
            <button type="button" aria-label={t.app.close} className="flex size-10 items-center justify-center rounded-full text-xl font-bold" onClick={dismissNewOrder}>
              ×
            </button>
          </div>
        )}
        {updateWaiting && (
          <div className="flex items-center gap-3 border-t border-brand-line bg-brand-ink-2 px-4 py-2 text-sm" role="status">
            <span className="flex-1 text-white">{t.app.update}</span>
            <button type="button" onClick={applyAppUpdate} className="rounded-lg bg-brand-neon px-3 py-2 font-bold text-brand-ink">
              {t.app.updateBtn}
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      {(footer || nav) && (
        <div className="sticky bottom-0 z-20 print:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)', background: nav ? 'var(--color-brand-ink)' : undefined }}>
          {footer}
          {nav && <BottomNav />}
        </div>
      )}
    </div>
  );
}

function BottomNav() {
  const t = useT();
  const { kedai } = useSession();
  // Pesanan appears once the shop has an online store (K-plan); its badge counts orders that need the seller.
  const orders = kedai?.set
    ? [{ to: '/pesanan', label: t.nav.orders, badge: kedai.needsAction, icon: <><path d="M6 2l-2 4v14a2 2 0 002 2h12a2 2 0 002-2V6l-2-4z" /><path d="M4 6h16M16 10a4 4 0 01-8 0" /></> }]
    : [];
  const items: { to: string; label: string; icon: ReactNode; end?: boolean; badge?: number }[] = [
    { to: '/', label: t.nav.home, end: true, icon: <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" /> },
    { to: '/kaunter', label: t.nav.counter, icon: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M7 20h10M12 16v4M7 8h4M7 12h10" /></> },
    ...orders,
    { to: '/jualan', label: t.nav.sales, icon: <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /> },
    { to: '/lagi', label: t.nav.more, icon: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></> },
  ];
  return (
    <nav aria-label={t.nav.main} className="flex justify-around bg-brand-ink px-1 pb-2 pt-1">
      {items.map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end={i.end}
          className={({ isActive }) =>
            `flex min-h-12 min-w-16 flex-col items-center justify-center gap-0.5 border-t-2 text-[11px] font-semibold ${isActive ? 'border-brand-neon text-brand-neon' : 'border-transparent text-brand-muted'}`
          }
        >
          <span className="relative">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {i.icon}
            </svg>
            {!!i.badge && (
              <span className="num absolute -right-3 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad px-1 text-[11px] font-extrabold text-white">{i.badge > 99 ? '99+' : i.badge}</span>
            )}
          </span>
          {i.label}
        </NavLink>
      ))}
    </nav>
  );
}
