import { useEffect, useRef, useState } from 'react';
import { fill, useLang, useT } from '../../i18n/lang';
import { Api, ApiError } from '../api';
import { ErrorNote } from '../components/Sheet';
import { Logo } from '../components/Logo';
import { errorText } from '../errors';
import { useSession } from '../session';
import { hasPendingLink } from '../pendingLink';

interface GoogleId {
  accounts: {
    id: {
      initialize(o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup'; use_fedcm_for_prompt?: boolean }): void;
      renderButton(el: HTMLElement, o: Record<string, unknown>): void;
    };
  };
}

function loadGoogle(): Promise<GoogleId> {
  const w = window as unknown as { google?: GoogleId };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (w.google ? resolve(w.google) : reject(new Error('no google')));
    s.onerror = () => reject(new Error('google script failed'));
    document.head.appendChild(s);
  });
}

export function SignIn() {
  const t = useT();
  const lang = useLang();
  const { signedIn } = useSession();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');
  const [googleId, setGoogleId] = useState<string | null>(null);
  const googleBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Api.config().then((c) => setGoogleId(c.googleClientId), () => setGoogleId(null));
  }, []);

  useEffect(() => {
    if (!googleId || !googleBox.current) return;
    let live = true;
    loadGoogle()
      .then((g) => {
        if (!live || !googleBox.current) return;
        g.accounts.id.initialize({
          client_id: googleId,
          ux_mode: 'popup',
          callback: async ({ credential }) => {
            setError('');
            setBusy(true);
            try {
              await signedIn(await Api.google(credential));
            } catch (e) {
              setError(e instanceof ApiError && e.code === 'google_rejected' ? t.signIn.googleRejected : errorText(e, t));
            } finally {
              setBusy(false);
            }
          },
        });
        g.accounts.id.renderButton(googleBox.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 320, locale: lang });
      })
      .catch(() => setGoogleId(null));
    return () => {
      live = false;
    };
  }, [googleId, lang, signedIn, t]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await Api.startEmail(email.trim(), lang);
      setDevCode(r.devCode ?? '');
      setStep('code');
      setCode('');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'bad_email') setError(t.signIn.badEmail);
      else if (err instanceof ApiError && err.code === 'email_failed') setError(t.signIn.emailFailed);
      else setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signedIn(await Api.verifyEmail(email.trim(), code));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'wrong_code') setError(fill(t.signIn.wrongCode, { n: Number(err.extra.attemptsLeft ?? 0) }));
      else if (err instanceof ApiError && err.code === 'code_expired') setError(t.signIn.codeExpired);
      else setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-brand-ink text-white">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={72} />
          <p className="mt-3 text-3xl font-extrabold tracking-tight">
            Jualan<span className="text-brand-neon">Lab</span>
          </p>
          <p className="mt-1 text-sm text-brand-muted">{t.app.tagline}</p>
        </div>

        <div className="rounded-3xl bg-surface p-5 text-ink">
          <h1 className="mb-4 text-xl font-extrabold">{t.signIn.title}</h1>
          {hasPendingLink() && <p className="mb-4 rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">{t.signIn.linkWaiting}</p>}

          {step === 'email' ? (
            <>
              {googleId && (
                <>
                  <div ref={googleBox} className="flex min-h-11 justify-center" />
                  <div className="my-4 flex items-center gap-3 text-sm text-subtle">
                    <span className="h-px flex-1 bg-border" />
                    {t.signIn.or}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}
              <form onSubmit={sendCode}>
                <label className="label" htmlFor="email">
                  {t.signIn.email}
                </label>
                <input
                  id="email"
                  className="field"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  placeholder={t.signIn.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button className="btn-primary mt-3 w-full" disabled={busy || !email.trim()}>
                  {busy ? t.signIn.sending : t.signIn.sendCode}
                </button>
                <p className="mt-3 text-center text-sm text-muted">{t.signIn.noPassword}</p>
              </form>
            </>
          ) : (
            <form onSubmit={verify}>
              <p className="mb-3 text-sm text-muted">{fill(t.signIn.codeSent, { email: email.trim() })}</p>
              {devCode && <p className="mb-3 rounded-xl bg-warn-soft px-3 py-2 text-sm font-bold text-warn">{fill(t.signIn.devCode, { code: devCode })}</p>}
              <label className="label" htmlFor="code">
                {t.signIn.code}
              </label>
              <input
                id="code"
                className="field num text-center text-2xl font-bold tracking-[0.4em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="\d{6}"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <button className="btn-primary mt-3 w-full" disabled={busy || code.length !== 6}>
                {busy ? t.signIn.verifying : t.signIn.verify}
              </button>
              <div className="mt-2 flex justify-between">
                <button type="button" className="btn-ghost px-2 text-sm" onClick={() => setStep('email')}>
                  {t.signIn.otherEmail}
                </button>
                <button type="button" className="btn-ghost px-2 text-sm" disabled={busy} onClick={() => void sendCode()}>
                  {t.signIn.resend}
                </button>
              </div>
            </form>
          )}
          <ErrorNote>{error}</ErrorNote>
        </div>
      </div>
    </div>
  );
}
