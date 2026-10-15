import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { lineTotal } from '../../domain/cart';
import { formatRM } from '../../domain/money';
import { MAX_VOID_REASON, methodLabel, receiptText, validVoidReason, type Sale } from '../../domain/sale';
import { normaliseMyPhone, whatsappLink } from '../../domain/whatsapp';
import { receiptDoc, receiptFileName } from '../../domain/receiptDoc';
import { fill, formatWhen, useLang, useT } from '../../i18n/lang';
import { Api, ApiError } from '../api';
import { Layout } from '../components/Layout';
import { ErrorNote, Sheet } from '../components/Sheet';
import { errorText } from '../errors';
import { getLocalSale, retrySale, voidLocalSale } from '../sales';
import { downloadBlob } from '../download';
import { receiptImage } from '../receiptImage';
import { useShop } from '../session';

export function Receipt() {
  const t = useT();
  const lang = useLang();
  const { id = '' } = useParams();
  const { shop, online, syncNow } = useShop();
  const row = useLiveQuery(() => getLocalSale(id).then((r) => r ?? null), [id]);
  const [remote, setRemote] = useState<Sale | null | 'missing'>(null);
  const [phone, setPhone] = useState('');
  const [voidOpen, setVoidOpen] = useState(false);
  const [picture, setPicture] = useState<File | null>(null);

  const local = row && row.shopId === shop.id ? row : null;

  // Not made on this phone: read it from the server (another phone's sale, opened from Sales Today).
  const loadRemote = async () => {
    try {
      setRemote((await Api.getSale(id)).sale);
    } catch (e) {
      setRemote(e instanceof ApiError && e.status === 404 ? 'missing' : null);
    }
  };
  useEffect(() => {
    if (row === null && online) void loadRemote();
  }, [row, online, id]);

  const s: Sale | null = local?.sale ?? (remote && remote !== 'missing' ? remote : null);

  // The picture is made as soon as the receipt shows, so sharing starts straight from the tap
  // (phones only open the share sheet right after a tap).
  useEffect(() => {
    setPicture(null);
    if (!s || s.status === 'void') return;
    let live = true;
    receiptImage(receiptDoc(shop.name, s, lang), receiptFileName(s, lang)).then(
      (f) => live && setPicture(f),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [s?.id, s?.status, shop.name, lang]);
  // Back to the business day this sale belongs to.
  const backTo = s?.dayId ? `/jualan/${s.dayId}` : '/jualan';

  if (row === undefined || (row === null && remote === null && online)) return <Layout title={t.receipt.title} back="/jualan">{null}</Layout>;
  if (!s) {
    return (
      <Layout title={t.receipt.title} back="/jualan">
        <p className="card text-muted">{t.receipt.notFound}</p>
      </Layout>
    );
  }

  const voided = s.status === 'void';
  const text = receiptText(shop.name, s, lang);
  const phoneOk = phone.trim() === '' || normaliseMyPhone(phone) !== null;
  const canSharePicture = picture !== null && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [picture] });

  function sharePicture() {
    if (!picture) return;
    if (!canSharePicture) return downloadBlob(picture.name, picture);
    navigator.share({ files: [picture] }).catch((e: unknown) => {
      // Closing the share sheet is fine; any other failure saves the picture instead.
      if (!(e instanceof DOMException && e.name === 'AbortError')) downloadBlob(picture.name, picture);
    });
  }

  return (
    <Layout title={t.receipt.title} back={backTo}>
      {voided ? (
        <div className="rounded-2xl bg-bad p-4 text-center font-bold text-white" role="status">
          {fill(t.receipt.voidedBanner, { reason: s.voidReason ?? '' })}
        </div>
      ) : (
        <div className="rounded-2xl bg-brand-ink p-4 text-center text-white">
          <p className="font-bold text-brand-neon">{t.receipt.recorded}</p>
          {s.changeSen !== null && s.changeSen > 0 && (
            <p className="num mt-1 text-2xl font-extrabold">{fill(t.receipt.changeLine, { amount: formatRM(s.changeSen), method: methodLabel(s.method, lang) })}</p>
          )}
        </div>
      )}

      <article className={`card num mt-3 ${voided ? 'opacity-60' : ''}`} aria-label={t.receipt.title}>
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

      <p className={`mt-2 text-center text-xs ${local?.sync === 'rejected' ? 'font-semibold text-bad' : 'text-subtle'}`}>
        {!local
          ? t.receipt.otherPhone
          : local.sync === 'sent' && !local.voidPending
            ? t.receipt.savedServer
            : local.sync === 'rejected'
              ? fill(t.receipt.syncProblem, { code: local.syncError ?? '?' })
              : t.receipt.savedPhone}
      </p>
      {local?.sync === 'rejected' && (
        <button
          type="button"
          className="btn-secondary mt-2 w-full"
          onClick={() => {
            void retrySale(local.id).then(() => syncNow());
          }}
        >
          {t.voidSale.retry}
        </button>
      )}

      {!voided && (
        <section className="card mt-3">
          <button type="button" className="btn mt-0 w-full bg-[#1FAF5A] text-white" disabled={!picture} onClick={sharePicture}>
            {!picture ? t.receipt.preparing : canSharePicture ? t.receipt.shareImage : t.receipt.saveImage}
          </button>
          {canSharePicture && <p className="mt-2 text-center text-xs text-subtle">{t.receipt.imageHint}</p>}
          <p className="label mt-4">{t.receipt.orText}</p>
          <label className="label" htmlFor="phone">
            {t.receipt.phone}
          </label>
          <input id="phone" className="field num" type="tel" inputMode="tel" autoComplete="off" placeholder={t.receipt.phonePlaceholder} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <a
            href={phoneOk ? whatsappLink(text, phone) : undefined}
            aria-disabled={!phoneOk}
            target="_blank"
            rel="noopener noreferrer"
            className={`btn-secondary mt-3 w-full ${phoneOk ? '' : 'pointer-events-none opacity-50'}`}
          >
            {t.receipt.whatsapp}
          </a>
        </section>
      )}

      <Link to="/kaunter" className="btn-primary mt-4 w-full">
        {t.receipt.newSale}
      </Link>
      {!voided && (
        <button type="button" className="btn-danger mt-3 w-full" onClick={() => setVoidOpen(true)}>
          {t.voidSale.button}
        </button>
      )}

      <Sheet open={voidOpen} title={t.voidSale.title} onClose={() => setVoidOpen(false)}>
        {voidOpen && (
          <VoidForm
            onVoid={async (reason) => {
              if (local) {
                await voidLocalSale(local.id, reason);
                void syncNow();
              } else {
                if (!online) throw new Error('needs_online');
                await Api.voidSale(s.id, reason, new Date().toISOString());
                await loadRemote();
              }
              setVoidOpen(false);
            }}
          />
        )}
      </Sheet>
    </Layout>
  );
}

function VoidForm({ onVoid }: { onVoid: (reason: string) => Promise<void> }) {
  const t = useT();
  const presets = t.voidSale.reasons.split('|');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!validVoidReason(reason)) return setError(t.voidSale.badReason);
    setBusy(true);
    setError('');
    try {
      await onVoid(reason.trim());
    } catch (e) {
      setError(e instanceof Error && e.message === 'needs_online' ? t.voidSale.needsOnline : errorText(e, t));
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-muted">{t.voidSale.hint}</p>
      <p className="label mt-3">{t.voidSale.reason}</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button key={p} type="button" className={`chip ${reason === p ? 'chip-on' : ''}`} onClick={() => setReason(p)}>
            {p}
          </button>
        ))}
      </div>
      <input className="field mt-3" maxLength={MAX_VOID_REASON} placeholder={t.voidSale.other} aria-label={t.voidSale.other} value={reason} onChange={(e) => setReason(e.target.value)} />
      <button type="button" className="btn mt-3 w-full bg-bad text-white" disabled={busy || !reason.trim()} onClick={() => void submit()}>
        {t.voidSale.confirm}
      </button>
      <ErrorNote>{error}</ErrorNote>
    </div>
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
