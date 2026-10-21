/**
 * Semak stok sebelum tutup (OM-04): every item that counts stock, with its current number. "Kekalkan semua" keeps
 * them; or change any and save. Orders placed after closing (next-day pre-orders) take from these numbers.
 */
import { clockText } from '../dayLabel';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupByCategory } from '../../domain/items';
import { fill, useT } from '../../i18n/lang';
import { Api, type KedaiInfo } from '../api';
import { Layout } from '../components/Layout';
import { ErrorNote } from '../components/Sheet';
import { errorText } from '../errors';
import { useShop } from '../session';

export function StockCheck() {
  const t = useT();
  const navigate = useNavigate();
  const { items, kedai, refreshKedai } = useShop();
  const [info, setInfo] = useState<KedaiInfo | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void Api.kedai()
      .then((k) => {
        setInfo(k);
        setVals(Object.fromEntries(Object.entries(k.itemStore).filter(([, v]) => v.stock !== null).map(([id, v]) => [id, String(v.stock)])));
      })
      .catch((e) => setError(errorText(e, t)));
  }, [t]);
  const counted = useMemo(() => groupByCategory(items.filter((i) => i.active)).flatMap((g) => g.items).filter((i) => info?.itemStore[i.id]?.stock != null), [items, info]);

  async function send(keep: boolean) {
    setBusy(true);
    setError('');
    try {
      await Api.stockCheck(keep ? { keep: true } : { stock: Object.fromEntries(counted.map((i) => [i.id, Math.min(99_999, Number(vals[i.id] || '0'))])) });
      await refreshKedai();
      navigate('/pesanan');
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout title={t.stockCheck.title} back="/kedai">
      <p className="text-sm text-muted">
        {kedai?.stockCheck ? fill(t.stockCheck.lead, { time: clockText(kedai.stockCheck.closesAt) }) : t.stockCheck.leadAny}
      </p>
      {info && counted.length === 0 && <p className="card mt-3 text-center text-muted">{t.stockCheck.none}</p>}
      {counted.length > 0 && (
        <>
          <button type="button" className="btn-primary mt-3 w-full" disabled={busy} onClick={() => void send(true)}>
            {t.stockCheck.keep}
          </button>
          <ul className="card mt-3 divide-y divide-border p-0">
            {counted.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 truncate font-semibold">{i.name}</span>
                <input
                  inputMode="numeric"
                  aria-label={`${t.kedai.stock} ${i.name}`}
                  className="field num h-12 w-24 text-center text-lg font-extrabold"
                  value={vals[i.id] ?? ''}
                  onChange={(e) => setVals({ ...vals, [i.id]: e.target.value.replace(/[^0-9]/g, '') })}
                />
              </li>
            ))}
          </ul>
          <ErrorNote>{error}</ErrorNote>
          <button type="button" className="btn-secondary mt-3 w-full" disabled={busy} onClick={() => void send(false)}>
            {busy ? t.app.saving : t.stockCheck.save}
          </button>
        </>
      )}
    </Layout>
  );
}
