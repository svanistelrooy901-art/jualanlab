import { useNavigate } from 'react-router-dom';
import { setLang, useLang, useT } from '../../i18n/lang';
import { PRIVACY, TERMS, type LegalDoc } from '../legal';

/** Privacy notice (/privasi) and terms (/terma): readable signed in or not, in either language. */
export function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const d: LegalDoc = (doc === 'privacy' ? PRIVACY : TERMS)[lang];

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-canvas">
      <header className="sticky top-0 z-20 bg-brand-ink text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex min-h-14 items-center gap-2 px-3">
          <button
            type="button"
            aria-label={t.app.back}
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="flex size-11 items-center justify-center rounded-lg text-2xl text-brand-neon"
          >
            ‹
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold">{d.title}</h1>
          <div className="flex rounded-lg border border-brand-line text-xs font-bold" role="radiogroup" aria-label={t.more.language}>
            {(['ms', 'en'] as const).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={`px-2.5 py-1.5 ${lang === l ? 'text-brand-neon' : 'text-brand-muted'}`}>
                {l === 'ms' ? 'BM' : 'EN'}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="px-5 pb-12 pt-5 leading-relaxed text-ink">
        <p className="text-sm text-subtle">{d.updated}</p>
        <p className="mt-3">{d.intro}</p>
        {d.sections.map((s) => (
          <section key={s.heading} className="mt-6">
            <h2 className="text-lg font-extrabold">{s.heading}</h2>
            {s.bullets && (
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {s.paragraphs?.map((p) => (
              <p key={p} className="mt-2">
                {p}
              </p>
            ))}
          </section>
        ))}
        <p className="mt-10 text-center text-sm text-subtle">JualanLab · Digital Sambal</p>
      </main>
    </div>
  );
}
