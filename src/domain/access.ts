/**
 * What a shop may use right now (DECISIONS FT-01, FT-02). The stored plan is what was bought ('free' or 'pos');
 * a new shop also gets the full version free for its first 30 days. After that, a shop that has not bought the full
 * POS is on Free: the counter with 10 items, no UntungLab link, no Laporan and no online store.
 * The online store itself needs Kedai Online after the free month, bought or not (KS-01, hasStore).
 */
export const TRIAL_DAYS = 30;
const DAY_MS = 864e5;

export interface AccessFields {
  plan?: 'free' | 'pos';
  /** Kedai Online paid up to (KS-01); far future = for life; null = none. */
  kedaiUntil?: string | null;
  /** When the free month ends; null for shops from before the free month (DECISIONS FT-01). */
  trialEndsAt?: string | null;
}

/** The end of the free month for a shop created at `createdAt`. */
export function trialEnd(createdAt: string, days = TRIAL_DAYS): string {
  return new Date(Date.parse(createdAt) + days * DAY_MS).toISOString();
}

/** True while the free month runs (and the full POS was not bought). */
export function onTrial(shop: AccessFields, nowIso: string): boolean {
  return (shop.plan ?? 'free') !== 'pos' && !!shop.trialEndsAt && Date.parse(nowIso) < Date.parse(shop.trialEndsAt);
}

/** Full version: bought, or still in the free month. */
export function hasFull(shop: AccessFields, nowIso: string): boolean {
  return (shop.plan ?? 'free') === 'pos' || onTrial(shop, nowIso);
}

/** The plan the app works with: 'pos' while the free month runs. */
export function effectivePlan(shop: AccessFields, nowIso: string): 'free' | 'pos' {
  return hasFull(shop, nowIso) ? 'pos' : 'free';
}

/** Whole days left in the free month, rounded up (1 on the last day); 0 when it is over or there is none. */
export function trialDaysLeft(shop: AccessFields, nowIso: string): number {
  if (!onTrial(shop, nowIso)) return 0;
  return Math.max(1, Math.ceil((Date.parse(shop.trialEndsAt!) - Date.parse(nowIso)) / DAY_MS));
}

/** KS-01: the free month (bought or not), as a window in time. */
export function inFreeMonth(shop: AccessFields, nowIso: string): boolean {
  return !!shop.trialEndsAt && Date.parse(nowIso) < Date.parse(shop.trialEndsAt);
}

/** KS-01: the online store takes orders during the free month, or with Kedai Online (subscription, early buyer, owner). */
export function hasStore(shop: AccessFields, nowIso: string): boolean {
  return inFreeMonth(shop, nowIso) || (!!shop.kedaiUntil && Date.parse(nowIso) < Date.parse(shop.kedaiUntil));
}

/** For life (early buyers, owner accounts) versus a paid period. */
export const KEDAI_FOR_LIFE = '9999-12-31T00:00:00.000Z';
