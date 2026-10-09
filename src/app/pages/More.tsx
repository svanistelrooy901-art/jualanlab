import { Link } from 'react-router-dom';
import { fill, setLang, useLang, useT } from '../../i18n/lang';
import { Layout } from '../components/Layout';
import { useShop } from '../session';

declare const __APP_VERSION__: string;

export function More() {
  const t = useT();
  const lang = useLang();
  const { me, pending, signOut } = useShop();

  function doSignOut() {
    if (pending > 0 && !window.confirm(fill(t.more.signOutPending, { n: pending }))) return;
    void signOut();
  }

  const links = [
    { to: '/katalog', label: t.more.catalogue },
    { to: '/terima', label: t.more.receive },
    { to: '/tetapan', label: t.more.settings },
  ];

  return (
    <Layout title={t.more.title} nav>
      <ul className="card divide-y divide-border p-0">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="flex min-h-14 items-center justify-between px-4 font-semibold hover:bg-canvas">
              {l.label}
              <span aria-hidden className="text-subtle">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="card mt-3">
        <p className="label">{t.more.language}</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.more.language}>
          {(['ms', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={lang === l}
              onClick={() => setLang(l)}
              className={`min-h-12 rounded-xl border-[1.5px] font-bold ${lang === l ? 'border-primary bg-primary text-white' : 'border-border-strong text-muted'}`}
            >
              {l === 'ms' ? 'Bahasa Melayu' : 'English'}
            </button>
          ))}
        </div>
      </section>

      <section className="card mt-3">
        <p className="text-sm text-muted">{fill(t.more.signedInAs, { email: me.user.email })}</p>
        <button type="button" className="btn-danger mt-3 w-full" onClick={doSignOut}>
          {t.more.signOut}
        </button>
      </section>
      <p className="mt-4 text-center text-xs text-subtle">{fill(t.more.version, { v: __APP_VERSION__ })}</p>
    </Layout>
  );
}
