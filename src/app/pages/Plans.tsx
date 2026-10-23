import { useEffect, useState } from 'react';
import { fill, formatWhen, useLang, useT } from '../../i18n/lang';
import { trialDaysLeft } from '../../domain/access';
import { Api, type Billing } from '../api';
import { Layout } from '../components/Layout';
import { ErrorNote } from '../components/Sheet';
import { errorText } from '../errors';
import { useShop } from '../session';

/** The shop's plan. The full POS is bought at smeLab with the same account (DECISIONS A-06); the plan follows it. */
export function Plans() {
  const t = useT();
  const lang = useLang();
  const { signedIn } = useShop();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function load() {
    setChecking(true);
    setError('');
    try {
      const b = await Api.billing();
      setBilling(b);
      // The plan may have changed at smeLab: refresh the shop everywhere in the app.
      await signedIn(await Api.me());
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const pos = billing?.plan === 'pos';
  // FT-01: the free month, shown above the plan until it ends (then the shop is on Free).
  const daysLeft = billing?.onTrial ? trialDaysLeft({ plan: 'free', trialEndsAt: billing.trialEndsAt }, new Date().toISOString()) : 0;
  return (
    <Layout title={t.plans.title} back="/lagi">
      {billing && !pos && daysLeft > 0 && (
        <section className="mb-3 rounded-2xl bg-brand-ink p-5 text-white">
          <p className="text-sm font-semibold text-brand-muted">{t.plans.trialTitle}</p>
          <p className="text-2xl font-extrabold text-brand-neon">{fill(t.plans.trialDays, { n: daysLeft })}</p>
          <p className="mt-1 text-sm text-white/80">{fill(t.plans.trialEnds, { when: formatWhen(billing.trialEndsAt!, lang, false) })}</p>
          <p className="mt-2 text-xs text-white/70">{t.plans.trialAfter}</p>
        </section>
      )}
      {billing && (
        <section className={`rounded-2xl p-5 ${pos ? 'bg-brand-ink text-white' : 'card'}`}>
          <p className={`text-sm font-semibold ${pos ? 'text-brand-muted' : 'text-muted'}`}>{t.plans.current}</p>
          <p className={`text-2xl font-extrabold ${pos ? 'text-brand-neon' : ''}`}>{pos ? t.plans.pos : t.plans.free}</p>
          <p className={`num mt-1 text-sm ${pos ? 'text-white/80' : 'text-muted'}`}>
            {pos
              ? billing.planSince
                ? fill(t.plans.posSince, { when: formatWhen(billing.planSince, lang, false) })
                : ''
              : fill(t.plans.freeUsage, { n: billing.activeItems, max: billing.freeItemLimit })}
          </p>
          {!pos && <p className="mt-2 text-xs text-subtle">{fill(t.plans.freeFeatures, { max: billing.freeItemLimit })}</p>}
        </section>
      )}

      {billing && !pos && (
        <section className="card mt-3">
          <h2 className="text-lg font-extrabold">{t.plans.posTitle}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>{t.plans.posFeature1}</li>
            <li>{t.plans.posFeature2}</li>
            <li>{t.plans.posFeature3}</li>
          </ul>
          {billing.buyUrl ? (
            <>
              <a href={billing.buyUrl} className="btn-primary mt-4 w-full">
                {t.plans.buy}
              </a>
              <p className="mt-2 text-xs text-subtle">{t.plans.smelabHint}</p>
              {billing.pricesUrl && (
                <a href={billing.pricesUrl} className="mt-2 inline-block text-sm font-semibold text-primary">
                  {t.plans.seePrices} ›
                </a>
              )}
              <button type="button" className="btn-secondary mt-3 w-full" disabled={checking} onClick={() => void load()}>
                {checking ? t.plans.checking : t.plans.refresh}
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">{t.plans.closed}</p>
          )}
        </section>
      )}

      <section className="card mt-3 opacity-80">
        <h2 className="font-bold">{t.plans.kedaiPlusTitle}</h2>
        <p className="text-sm text-muted">{t.plans.kedaiPlusText}</p>
      </section>
      <ErrorNote>{error}</ErrorNote>
    </Layout>
  );
}
