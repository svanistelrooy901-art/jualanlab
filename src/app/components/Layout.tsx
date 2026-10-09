import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { fill, useT } from '../../i18n/lang';
import { applyAppUpdate, useUpdateWaiting } from '../appUpdate';
import { useSession } from '../session';
import { Logo } from './Logo';

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
  const { online, pending } = useSession();
  const updateWaiting = useUpdateWaiting();

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="sticky top-0 z-20 bg-brand-ink text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
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
        {(!online || pending > 0) && (
          <div className="flex items-center gap-2 border-t border-brand-line bg-brand-ink-2 px-4 py-1.5 text-[13px] font-semibold text-brand-muted" role="status">
            {!online && <span className="text-brand-neon">{t.app.offline}</span>}
            {!online && pending > 0 && <span aria-hidden>·</span>}
            {pending > 0 && <span>{fill(t.app.pendingSales, { n: pending })}</span>}
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
        <div className="sticky bottom-0 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom)', background: nav ? 'var(--color-brand-ink)' : undefined }}>
          {footer}
          {nav && <BottomNav />}
        </div>
      )}
    </div>
  );
}

function BottomNav() {
  const t = useT();
  const items: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
    { to: '/', label: t.nav.home, end: true, icon: <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" /> },
    { to: '/kaunter', label: t.nav.counter, icon: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M7 20h10M12 16v4M7 8h4M7 12h10" /></> },
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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {i.icon}
          </svg>
          {i.label}
        </NavLink>
      ))}
    </nav>
  );
}
