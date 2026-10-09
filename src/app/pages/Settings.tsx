import { useEffect, useState } from 'react';
import { deleteMeta, getMeta, setMeta } from '../../db/db';
import { useT } from '../../i18n/lang';
import { Api, ApiError } from '../api';
import { Layout } from '../components/Layout';
import { ErrorNote } from '../components/Sheet';
import { errorText } from '../errors';
import { useShop } from '../session';

const QR_MAX_SIDE = 900;

/** Shrinks a photo of the QR to a sensible size and stores it as a data URL on this phone. */
async function readQrImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, QR_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export function Settings() {
  const t = useT();
  const { shop, signedIn } = useShop();
  const [name, setName] = useState(shop.name);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const qrKey = `qrImage:${shop.id}`;

  useEffect(() => {
    void getMeta<string>(qrKey).then((v) => setQr(v ?? null));
  }, [qrKey]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await signedIn(await Api.saveShop(name));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'bad_name' ? t.shopSetup.badName : errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function pickQr(file: File | undefined) {
    if (!file) return;
    try {
      const url = await readQrImage(file);
      await setMeta(qrKey, url);
      setQr(url);
    } catch {
      setError(t.errors.generic);
    }
  }

  return (
    <Layout title={t.settings.title} back="/lagi">
      <form onSubmit={saveName} className="card">
        <label className="label" htmlFor="shopName">
          {t.settings.shopName}
        </label>
        <input id="shopName" className="field" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary mt-3 w-full" disabled={busy || !name.trim() || name.trim() === shop.name}>
          {busy ? t.app.saving : t.app.save}
        </button>
        {saved && <p className="mt-2 text-sm font-semibold text-good">{t.settings.saved}</p>}
      </form>

      <section className="card mt-3">
        <p className="label">{t.settings.qr}</p>
        <p className="mb-3 text-sm text-muted">{t.settings.qrHint}</p>
        {qr && <img src={qr} alt={t.settings.qr} className="mx-auto mb-3 max-h-64 rounded-xl border border-border" />}
        <label className="btn-secondary w-full">
          {t.settings.qrPick}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pickQr(e.target.files?.[0])} />
        </label>
        {qr && (
          <button
            type="button"
            className="btn-ghost mt-2 w-full"
            onClick={() => {
              void deleteMeta(qrKey);
              setQr(null);
            }}
          >
            {t.settings.qrRemove}
          </button>
        )}
      </section>
      <ErrorNote>{error}</ErrorNote>
    </Layout>
  );
}
