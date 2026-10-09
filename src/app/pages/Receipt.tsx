import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { lineTotal } from '../../domain/cart';
import { formatRM } from '../../domain/money';
import { methodLabel, receiptText } from '../../domain/sale';
import { normaliseMyPhone, whatsappLink } from '../../domain/whatsapp';
import { fill, formatWhen, useLang, useT } from '../../i18n/lang';
import { Layout } from '../components/Layout';
import { getLocalSale } from '../sales';
import { useShop } from '../session';

export function Receipt() {
  const t = useT();
  const lang = useLang();
  const { id = '' } = useParams();
  const { shop } = useShop();
  const row = useLiveQuery(() => getLocalSale(id).then((r) => r ?? null), [id]);
  const [phone, setPhone] = useState('');

  if (row === undefined) return <Layout title={t.receipt.title} back="/kaunter">{null}</Layout>;
  if (row === null || row.shopId !== shop.id) {
    return (
      <Layout title={t.receipt.title} back="/jualan">
        <p className="card text-muted">{t.receipt.notFound}</p>
      </Layout>
    );
  }

  const s = row.sale;
  const text = receiptText(shop.name, s, lang);
  const phoneOk = phone.trim() === '' || normaliseMyPhone(phone) !== null;
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <Layout title={t.receipt.title} back="/jualan">
      <div className="rounded-2xl bg-brand-ink p-4 text-center text-white">
        <p className="font-bold text-brand-neon">{t.receipt.recorded}</p>
        {s.changeSen !== null && s.changeSen > 0 && (
          <p className="num mt-1 text-2xl font-extrabold">{fill(t.receipt.changeLine, { amount: formatRM(s.changeSen), method: methodLabel(s.method, lang) })}</p>
        )}
      </div>

      <article className="card num mt-3" aria-label={t.receipt.title}>
        <p className="text-center text-lg font-extrabold">{shop.name}</p>
        <p className="text-center text-sm text-subtle">
          {fill(t.receipt.receipt, { number: s.number })} · {formatWhen(s.createdAt, lang)}
        </p>
        <ul className="mt-3 space-y-1.5 border-y border-dashed border-border-strong py-3">
          {s.lines.map((l, i) => (
            <li key={i}>
              <div className="flex justify-between gap-3">
                <span>
                  {l.name} × {l.quantity}
                </span>
                <span>{formatRM(lineTotal(l))}</span>
              </div>
              {l.note && <p className="text-sm text-subtle">({l.note})</p>}
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1">
          {s.discountSen > 0 && <Line k={t.receipt.discount} v={formatRM(-s.discountSen)} />}
          <div className="flex justify-between text-lg font-extrabold">
            <dt>{t.receipt.total}</dt>
            <dd>{formatRM(s.totalSen)}</dd>
          </div>
          {s.cashReceivedSen !== null ? (
            <>
              <Line k={t.receipt.cashReceived} v={formatRM(s.cashReceivedSen)} />
              <Line k={t.receipt.change} v={formatRM(s.changeSen ?? 0)} />
            </>
          ) : (
            <p className="text-sm text-muted">{fill(t.receipt.paidBy, { method: methodLabel(s.method, lang) })}</p>
          )}
        </dl>
        <p className="mt-3 text-center font-semibold">{t.receipt.thanks}</p>
      </article>

      <p className={`mt-2 text-center text-xs ${row.sync === 'rejected' ? 'font-semibold text-bad' : 'text-subtle'}`}>
        {row.sync === 'sent' ? t.receipt.savedServer : row.sync === 'rejected' ? fill(t.receipt.syncProblem, { code: row.syncError ?? '?' }) : t.receipt.savedPhone}
      </p>

      <section className="card mt-3">
        <label className="label" htmlFor="phone">
          {t.receipt.phone}
        </label>
        <input id="phone" className="field num" type="tel" inputMode="tel" autoComplete="off" placeholder={t.receipt.phonePlaceholder} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <a
          href={phoneOk ? whatsappLink(text, phone) : undefined}
          aria-disabled={!phoneOk}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn mt-3 w-full bg-[#1FAF5A] text-white ${phoneOk ? '' : 'pointer-events-none opacity-50'}`}
        >
          {t.receipt.whatsapp}
        </a>
        {canShare && (
          <button type="button" className="btn-secondary mt-2 w-full" onClick={() => void navigator.share({ text }).catch(() => undefined)}>
            {t.receipt.share}
          </button>
        )}
      </section>

      <Link to="/kaunter" className="btn-primary mt-4 w-full">
        {t.receipt.newSale}
      </Link>
    </Layout>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-sm text-muted">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
