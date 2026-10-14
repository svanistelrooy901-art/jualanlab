import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatRM } from '../../domain/money';
import { fill, formatWhen, useLang, useT, type Dict } from '../../i18n/lang';
import { Api, ApiError, type Billing } from '../api';
import { Layout } from '../components/Layout';
import { ErrorNote } from '../components/Sheet';
import { errorText } from '../errors';
import { useShop } from '../session';

function billingError(e: unknown, t: Dict): string {
  if (e instanceof ApiError && e.code in t.plans.err) return t.plans.err[e.code as keyof Dict['plans']['err']];
  return errorText(e, t);
}

export function Plans() {
  const t = useT();
  const lang = useLang();
  const { me, signedIn } = useShop();
  const [params, setParams] = useSearchParams();
  const returnedOrder = params.get('order_id');
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ state: 'waiting' | 'paid' | 'pending'; ulCode?: string | null } | null>(returnedOrder ? { state: 'waiting' } : null);

  const load = () =>
    Api.billing().then(setBilling, (e) => setError(errorText(e, t)));

  useEffect(() => {
    void load();
  }, []);

  // Back from ToyyibPay: ask the server (which asks ToyyibPay) until the payment is confirmed.
  useEffect(() => {
    if (!returnedOrder || !/^[0-9a-f]{32}$/.test(returnedOrder)) return;
    let stop = false;
    void (async () => {
      for (let i = 0; i < 20 && !stop; i++) {
        try {
          const o = await Api.order(returnedOrder);
          if (o.status === 'paid') {
            setResult({ state: 'paid', ulCode: o.ulIssuedCode });
            await signedIn(await Api.me());
            await load();
            return;
          }
        } catch {
          /* keep trying */
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!stop) setResult({ state: 'pending' });
    })();
    return () => {
      stop = true;
    };
  }, [returnedOrder]);

  const plan = billing?.plan ?? me.shop?.plan ?? 'free';

  return (
    <Layout title={t.plans.title} back="/lagi">
      {result && (
        <div className={`mb-3 rounded-2xl p-4 font-bold ${result.state === 'paid' ? 'bg-good-soft text-good' : result.state === 'waiting' ? 'bg-primary-soft text-primary' : 'bg-warn-soft text-warn'}`} role="status">
          {result.state === 'paid' ? t.plans.paid : result.state === 'waiting' ? t.plans.waiting : t.plans.notPaid}
          {result.state === 'paid' && result.ulCode && <p className="num mt-1 font-semibold">{fill(t.plans.paidBundle, { code: result.ulCode })}</p>}
          {result.state !== 'waiting' && (
            <button type="button" className="mt-2 block text-sm underline" onClick={() => { setResult(null); setParams({}); }}>
              {t.app.close}
            </button>
          )}
        </div>
      )}

      <section className="rounded-2xl bg-brand-ink p-4 text-white">
        <p className="text-sm text-brand-muted">{t.plans.current}</p>
        <p className="text-2xl font-extrabold text-brand-neon">{plan === 'pos' ? t.plans.pos : t.plans.free}</p>
        {billing && plan === 'free' && <p className="num mt-1 text-sm">{fill(t.plans.freeUsage, { n: billing.activeItems, max: billing.freeItemLimit })}</p>}
        {billing && plan === 'pos' && billing.planSince && <p className="mt-1 text-sm">{fill(t.plans.posSince, { when: formatWhen(billing.planSince, lang, false) })}</p>}
        {plan === 'free' && <p className="mt-2 text-xs text-brand-muted">{fill(t.plans.freeFeatures, { max: billing?.freeItemLimit ?? 10 })}</p>}
      </section>

      {plan === 'free' && billing && !billing.buyingOpen && <p className="card mt-3 text-muted">{t.plans.closed}</p>}
      {plan === 'free' && billing?.buyingOpen && billing.prices && <BuyPos billing={billing} email={me.user.email} />}

      <section className="card mt-3 opacity-80">
        <p className="font-bold">{t.plans.kedaiPlusTitle}</p>
        <p className="mt-1 text-sm text-muted">{t.plans.kedaiPlusText}</p>
      </section>
      <ErrorNote>{error}</ErrorNote>
    </Layout>
  );
}

function BuyPos({ billing, email }: { billing: Billing; email: string }) {
  const t = useT();
  const p = billing.prices!;
  const base = p.early ? p.early.priceSen : p.normalSen;
  const [open, setOpen] = useState<null | 'pos' | 'bundle'>(null);
  const [ulText, setUlText] = useState('');
  const [ulCode, setUlCode] = useState<string | null>(null);
  const [ulMsg, setUlMsg] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const amount = open === 'bundle' ? p.bundleSen! : ulCode && p.untungLabSen ? p.untungLabSen : base;

  async function checkUl() {
    setUlMsg('');
    setUlCode(null);
    try {
      const r = await Api.checkUl(ulText);
      if (r.ok) {
        setUlCode(r.code);
        setUlText(r.code);
        setUlMsg(fill(t.plans.ulOk, { price: formatRM(p.untungLabSen!) }));
      } else setUlMsg(t.plans.err[r.error as keyof Dict['plans']['err']] ?? t.errors.generic);
    } catch (e) {
      setUlMsg(billingError(e, t));
    }
  }

  async function pay() {
    setBusy(true);
    setError('');
    try {
      const r = await Api.checkout({ product: open === 'bundle' ? 'bundle' : 'pos', name, phone, ...(open === 'pos' && ulCode ? { ulCode } : {}) });
      window.location.href = r.payUrl;
    } catch (e) {
      setError(billingError(e, t));
      setBusy(false);
    }
  }

  const form = (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <div>
        <label className="label" htmlFor="bname">{t.plans.name}</label>
        <input id="bname" className="field" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="bphone">{t.plans.phone}</label>
        <input id="bphone" className="field num" type="tel" inputMode="tel" autoComplete="tel" placeholder="012-345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <p className="text-xs text-subtle">{fill(t.plans.checkoutHint, { email })}</p>
      <button type="button" className="btn-primary w-full" disabled={busy || name.trim().length < 2 || phone.replace(/\D/g, '').length < 9} onClick={() => void pay()}>
        {busy ? t.plans.paying : fill(t.plans.payWith, { price: formatRM(amount) })}
      </button>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );

  return (
    <>
      <section className="card mt-3 border-primary">
        <p className="font-bold">{t.plans.posTitle}</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="num text-3xl font-extrabold">{formatRM(base)}</span>
          {p.early && <span className="num text-muted line-through">{formatRM(p.normalSen)}</span>}
        </p>
        {p.early && <p className="text-sm font-bold text-primary">{fill(t.plans.earlyBird, { n: p.early.left })}</p>}
        <ul className="mt-3 space-y-1 text-sm">
          {[t.plans.posFeature1, t.plans.posFeature2, t.plans.posFeature3].map((f) => (
            <li key={f} className="flex gap-2">
              <span className="text-good" aria-hidden>✓</span>
              {f}
            </li>
          ))}
        </ul>

        {p.untungLabSen !== null && (
          <div className="mt-4 rounded-xl bg-primary-soft p-3">
            <p className="font-bold text-primary">{fill(t.plans.ulTitle, { price: formatRM(p.untungLabSen) })}</p>
            <p className="mt-1 text-xs text-muted">{t.plans.ulHint}</p>
            <div className="mt-2 flex gap-2">
              <input className="field num min-w-0 flex-1 uppercase" aria-label={t.plans.ulCode} placeholder="UL-XXXX-XXXX-XXXX" value={ulText} onChange={(e) => { setUlText(e.target.value); setUlCode(null); setUlMsg(''); }} />
              <button type="button" className="btn-secondary shrink-0" disabled={!ulText.trim()} onClick={() => void checkUl()}>
                {t.plans.ulCheck}
              </button>
            </div>
            {ulMsg && <p className={`mt-2 text-sm font-semibold ${ulCode ? 'text-good' : 'text-bad'}`}>{ulMsg}</p>}
          </div>
        )}

        {open === 'pos' ? form : (
          <button type="button" className="btn-primary mt-4 w-full" onClick={() => setOpen('pos')}>
            {t.plans.buy} · {formatRM(ulCode && p.untungLabSen ? p.untungLabSen : base)}
          </button>
        )}
      </section>

      {p.bundleSen !== null && (
        <section className="card mt-3">
          <p className="font-bold">{t.plans.bundleTitle}</p>
          <p className="mt-1 text-sm text-muted">{fill(t.plans.bundleText, { price: formatRM(p.bundleSen) })}</p>
          {open === 'bundle' ? form : (
            <button type="button" className="btn-secondary mt-3 w-full" onClick={() => setOpen('bundle')}>
              {t.plans.bundleBuy} · {formatRM(p.bundleSen)}
            </button>
          )}
        </section>
      )}
    </>
  );
}
