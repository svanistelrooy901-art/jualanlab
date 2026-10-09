import { useState } from 'react';
import { useT } from '../../i18n/lang';
import { Api, ApiError } from '../api';
import { ErrorNote } from '../components/Sheet';
import { Logo } from '../components/Logo';
import { errorText } from '../errors';
import { useSession } from '../session';

export function ShopSetup() {
  const t = useT();
  const { signedIn } = useSession();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signedIn(await Api.saveShop(name));
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'bad_name' ? t.shopSetup.badName : errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-brand-ink">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10">
        <div className="mb-6 flex justify-center">
          <Logo size={56} />
        </div>
        <form onSubmit={submit} className="rounded-3xl bg-surface p-5">
          <h1 className="text-xl font-extrabold">{t.shopSetup.title}</h1>
          <p className="mb-4 mt-1 text-sm text-muted">{t.shopSetup.hint}</p>
          <input className="field" maxLength={60} autoFocus required placeholder={t.shopSetup.placeholder} value={name} onChange={(e) => setName(e.target.value)} aria-label={t.shopSetup.title} />
          <button className="btn-primary mt-3 w-full" disabled={busy || !name.trim()}>
            {busy ? t.app.saving : t.shopSetup.create}
          </button>
          <ErrorNote>{error}</ErrorNote>
        </form>
      </div>
    </div>
  );
}
