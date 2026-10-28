import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang, useT, type Lang } from '../../i18n/lang';
import { Layout } from '../components/Layout';
import { Sheet } from '../components/Sheet';

/** The manual follows the app language (manual/build.mjs writes both PDFs into public/manual). */
export const manualFile = (lang: Lang) => (lang === 'en' ? 'JualanLab-Manual-EN.pdf' : 'JualanLab-Manual.pdf');

export function Manual() {
  const t = useT();
  const lang = useLang();
  const file = manualFile(lang);
  const url = `/manual/${file}`;
  return (
    <Layout title={t.manual.title} back="/lagi">
      <section className="card">
        <p className="text-sm text-muted">{t.manual.intro}</p>
        <div className="mt-4 grid gap-2">
          <a href={url} target="_blank" rel="noopener" className="btn-primary">
            {t.manual.open}
          </a>
          <a href={url} download={file} className="btn-secondary">
            {t.manual.download}
          </a>
        </div>
        <p className="mt-3 text-xs text-subtle">{t.manual.note}</p>
        <p className="mt-3 text-sm">
          <a href="mailto:admin@digitalsambal.space" className="font-semibold text-primary underline">
            {t.manual.contact}
          </a>
        </p>
      </section>
    </Layout>
  );
}

const SEEN = 'jl-manual-seen';
function seen(): boolean {
  try {
    return localStorage.getItem(SEEN) === '1';
  } catch {
    return true;
  }
}

/** One-time note on Home that the manual exists (Mamu, 24 Oct). Remembered per phone. */
export function ManualNotice() {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => !seen());
  const close = (then?: () => void) => {
    try {
      localStorage.setItem(SEEN, '1');
    } catch {
      /* storage blocked: shown again next time */
    }
    setOpen(false);
    then?.();
  };
  return (
    <Sheet open={open} title={t.manual.popTitle} onClose={() => close()}>
      <p className="text-sm text-muted">{t.manual.popText}</p>
      <div className="mt-4 grid gap-2">
        <button type="button" className="btn-primary" onClick={() => close(() => navigate('/manual'))}>
          {t.manual.popOpen}
        </button>
        <button type="button" className="btn-secondary" onClick={() => close()}>
          {t.manual.popLater}
        </button>
      </div>
    </Sheet>
  );
}
